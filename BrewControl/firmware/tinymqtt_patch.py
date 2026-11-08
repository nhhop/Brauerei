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


def apply_edits(path, edits, label, sentinel=SENTINEL):
    """edits: list of (old, new) pairs, all applied in one read/write pass."""
    text = open(path, "r", encoding="utf-8").read()
    if sentinel in text:
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

# Arduino core 3 builds with GCC 14, where two things no longer compile (not
# fixed upstream as of TinyMqtt 1.1.4 / TinyConsole 0.4.7): IPAddress::toString()
# is a String there, so connect(const char*) matches both the string and the
# IPAddress overload; and on Xtensa int32_t became `long`, so TinyString's
# operator+=(int) definition no longer matches its int32_t declaration. Both
# edits are neutral on core 2 (int32_t is int there).
CORE3_SENTINEL = "BREWCTL_PATCHED_CORE3"
core3 = apply_edits(
    header,
    [
        (
            "    { connect(ip.toString().c_str(), port, keep_alive); }\n",
            "    { connect(string(ip.toString().c_str()), port, keep_alive); }  // %s\n"
            % CORE3_SENTINEL,
        ),
    ],
    "MqttClient::connect(IPAddress) ambiguity",
    CORE3_SENTINEL,
)
tiny_string = os.path.join(env.subst("$PROJECT_LIBDEPS_DIR"), env["PIOENV"],
                           "TinyConsole", "src", "TinyString.cpp")
if os.path.exists(tiny_string):
    core3 |= apply_edits(
        tiny_string,
        [
            ("#include <cstdlib>\n",
             "#include <cstdlib>\n#include <utility>  // %s: std::exchange\n" % CORE3_SENTINEL),
            ("TinyString& TinyString::operator +=(int i)\n",
             "TinyString& TinyString::operator +=(int32_t i)\n"),
        ],
        "TinyString std::exchange / operator+=(int32_t)",
        CORE3_SENTINEL,
    )
if core3:
    print("tinymqtt_patch.py: GCC 14 compatibility patch applied (%s)" % env["PIOENV"])

# Every Topic is an IndexedString: a one-byte index into a global, refcounted
# string table (at most 255 strings). Broken there, unchanged upstream as of
# 1.1.4:
# - strToIndex() looks up existing strings with strcmp(), but a topic parsed
#   from a network packet is not NUL-terminated (the payload follows it). So
#   every message from a TCP client got a fresh index, and the broker kept
#   one retained entry per message instead of per topic. Those duplicates
#   evicted the meta topics (published once) from the retained store; once
#   the table ran full, strToIndex() returned 0 for every new topic, and
#   Topic::matches() treats equal indexes as a match — wildcard subscribers
#   then got every message of the remote board and none of the local ones.
#   Seen 2026-10-28 on the LilyGo with the esp32dev publishing to it.
# - The move constructor leaves the source holding the index, so its
#   destructor releases it a second time; operator= never releases the index
#   it overwrites; the count is a uint8_t.
# Index 0 is never handed out, so release(0) is a no-op and marks a
# moved-from string.
INDEX_SENTINEL = "BREWCTL_PATCHED_INDEXER"
string_indexer = os.path.join(lib_dir, "StringIndexer.h")
if apply_edits(
    string_indexer,
    [
        ("    uint8_t used=0;\n",
         "    uint16_t used=0;  // %s\n" % INDEX_SENTINEL),
        ("strcmp(it->second.str.c_str(), str)==0",
         "memcmp(it->second.str.c_str(), str, len)==0"),
        ("    IndexedString(IndexedString&& i) : index(i.index) {}\n",
         "    IndexedString(IndexedString&& i) : index(i.index) { i.index = 0; }\n"),
        ("      StringIndexer::use(source.index);\n"
         "      index = source.index;\n"
         "      return *this;\n",
         "      StringIndexer::use(source.index);\n"
         "      StringIndexer::release(index);\n"
         "      index = source.index;\n"
         "      return *this;\n"),
    ],
    "IndexedString refcounting",
    INDEX_SENTINEL,
):
    print("tinymqtt_patch.py: IndexedString refcount patch applied (%s)" % env["PIOENV"])

# The broker deletes a client it accepted only from MqttBroker::loop(), when
# that client is still in its list and no longer connected. But close() —
# run on a DISCONNECT packet, a keep-alive timeout or a malformed packet —
# took the client out of that list first, so it was never deleted: every
# cleanly disconnecting MQTT client leaked its MqttClient, socket and buffers
# (~270 B; 200 mosquitto_pub runs cost 54 KB of internal heap on the LilyGo,
# 2026-10-28, unchanged upstream as of 1.1.4). Broker-owned clients now stay
# listed until loop() deletes them; the destructor unlists them.
LEAK_SENTINEL = "BREWCTL_PATCHED_LEAK"
if apply_edits(
    source,
    [
        ("  close();\n"
         "  delete tcp_client;\n",
         "  close();\n"
         "  if (local_broker) local_broker->removeClient(this);  // %s\n"
         "  delete tcp_client;\n" % LEAK_SENTINEL),
        ("  if (local_broker)\n"
         "  {\n"
         "    local_broker->removeClient(this);\n"
         "    local_broker = nullptr;\n"
         "  }\n",
         "  if (local_broker and not (cltFlags & CltFlagToDelete))\n"
         "  {\n"
         "    local_broker->removeClient(this);\n"
         "    local_broker = nullptr;\n"
         "  }\n"),
    ],
    "MqttClient::close() leak",
    LEAK_SENTINEL,
):
    print("tinymqtt_patch.py: broker client leak patch applied (%s)" % env["PIOENV"])
