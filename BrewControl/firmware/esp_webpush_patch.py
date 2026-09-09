# Patches ESPToolKit/esp-webPush so it links against the certificate bundle on
# Arduino core 2.x. The library detects the bundle with
# `__has_include(<esp_crt_bundle.h>)` and then calls esp_crt_bundle_attach() —
# the ESP-IDF name. Arduino core 2.x ships its own copy of that header in
# WiFiClientSecure that renames the entry point to
# arduino_esp_crt_bundle_attach(), and because WiFiClientSecure is on the
# include path (MqttService/FirmwareUpdater use it) that copy wins the header
# search over the real IDF one. The IDF symbol itself is present in
# libmbedtls.a, so a forward declaration is all that's missing. Redundant but
# harmless on cores that ship the real header (identical signature).
#
# No-op on envs without the dependency. Idempotent via a sentinel comment,
# since PlatformIO re-runs extra_scripts on every build even when the lib is
# already cached.
Import("env")  # noqa: F821  (provided by PlatformIO/SCons)
import os

SENTINEL = "BREWCTL_PATCHED_CRT_BUNDLE"

source = os.path.join(env.subst("$PROJECT_LIBDEPS_DIR"), env["PIOENV"],
                      "ESPWebPush", "src", "esp_webPush", "webPush_http.cpp")

if not os.path.exists(source):
    Return()  # esp-webPush not a dependency for this env — nothing to do

ANCHOR = """extern "C" {
#include <esp_crt_bundle.h>
}
#define ESPWEBPUSH_HAVE_CRT_BUNDLE 1"""

REPLACEMENT = """extern "C" {
#include <esp_crt_bundle.h>
}
// %s: Arduino core 2.x renames this entry point in its own copy of the
// header, which shadows the IDF one. The IDF symbol is in libmbedtls.a.
extern "C" esp_err_t esp_crt_bundle_attach(void *conf);
#define ESPWEBPUSH_HAVE_CRT_BUNDLE 1""" % SENTINEL

text = open(source, "r", encoding="utf-8").read()
if SENTINEL not in text:
    if ANCHOR not in text:
        raise SystemExit(
            "esp_webpush_patch.py: anchor not found in %s — "
            "esp-webPush source changed, patch needs updating" % source
        )
    open(source, "w", encoding="utf-8").write(text.replace(ANCHOR, REPLACEMENT, 1))
    print("esp_webpush_patch.py: crt-bundle declaration patched (%s)" % env["PIOENV"])
