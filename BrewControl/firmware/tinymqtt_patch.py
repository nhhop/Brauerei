# Patches hsaturn/TinyMqtt (broker-only usage, see MqttService) to make its
# hardcoded "guest"/"guest" broker credentials configurable, and to close a
# security hole the library's own source flags as a FIXME: a CONNECT packet
# that omits the username/password flags entirely is accepted unauthenticated
# even when credentials were set, because checkUser()/checkPassword() are
# never called for it. Verified against TinyMqtt 1.1.3 source; both edits are
# additive (new public setter + one new private bool), no existing behavior
# changes for callers that never call setAuth().
#
# No-op on envs that don't depend on TinyMqtt (nothing to patch). Idempotent
# via a sentinel comment, since PlatformIO re-runs extra_scripts on every
# build even when the lib is already cached from a previous run.
Import("env")  # noqa: F821  (provided by PlatformIO/SCons)
import os

SENTINEL = "BREWCTL_PATCHED_AUTH"

lib_dir = os.path.join(env.subst("$PROJECT_LIBDEPS_DIR"), env["PIOENV"], "TinyMqtt", "src")
header = os.path.join(lib_dir, "TinyMqtt.h")
source = os.path.join(lib_dir, "TinyMqtt.cpp")

if not os.path.exists(header):
    Return()  # TinyMqtt not a dependency for this env — nothing to do


def apply_edits(path, edits, label):
    """edits: list of (old, new) pairs, all applied in one read/write pass."""
    text = open(path, "r", encoding="utf-8").read()
    if SENTINEL in text:
        return False  # already patched (cached from a prior build)
    for old, new in edits:
        if old not in text:
            raise SystemExit(
                "tinymqtt_patch.py: anchor not found in %s (%s) — "
                "TinyMqtt source changed, patch needs updating" % (path, label)
            )
        text = text.replace(old, new, 1)
    open(path, "w", encoding="utf-8").write(text)
    return True


patched = False
patched |= apply_edits(
    header,
    [
        (
            "    void begin() { server->begin(); }\n",
            "    void begin() { server->begin(); }\n"
            "    // %s\n"
            "    void setAuth(const char* user, const char* pass)\n"
            "    { auth_user = user; auth_password = pass; auth_required = true; }\n"
            % SENTINEL,
        ),
        (
            '    const char* auth_user = "guest";\n'
            '    const char* auth_password = "guest";\n',
            '    const char* auth_user = "guest";\n'
            '    const char* auth_password = "guest";\n'
            '    bool auth_required = false;\n',
        ),
    ],
    "MqttBroker::setAuth + auth_required",
)

patched |= apply_edits(
    source,
    [
        (
            "      if (mqtt_flags & FlagPassword)\n"
            "      {\n"
            "        mesg->getString(payload, len);\n"
            "        if (not local_broker->checkPassword(payload, len)) break;\n"
            "        payload += len;\n"
            "      }\n",
            "      if (mqtt_flags & FlagPassword)\n"
            "      {\n"
            "        mesg->getString(payload, len);\n"
            "        if (not local_broker->checkPassword(payload, len)) break;\n"
            "        payload += len;\n"
            "      }\n"
            "      // %s: reject if auth is required but either credential was omitted\n"
            "      if (local_broker->auth_required &&\n"
            "          !((mqtt_flags & FlagUserName) && (mqtt_flags & FlagPassword)))\n"
            "      {\n"
            "        break;\n"
            "      }\n"
            % SENTINEL,
        ),
    ],
    "MqttClient::processMessage auth-required check",
)

if patched:
    print("tinymqtt_patch.py: TinyMqtt auth patch applied (%s)" % env["PIOENV"])
