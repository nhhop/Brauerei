# Injects BREWCTL_VERSION (= git tag) and BREWCTL_VARIANT (= PlatformIO env name)
# as compile-time string macros. In CI, BREWCTL_VERSION_OVERRIDE (set from the
# release tag) takes precedence over `git describe`.
Import("env")  # noqa: F821  (provided by PlatformIO/SCons)
import os
import subprocess


def git_describe():
    try:
        out = subprocess.check_output(
            ["git", "describe", "--tags", "--always", "--dirty"],
            cwd=env["PROJECT_DIR"],
            stderr=subprocess.DEVNULL,
        )
        return out.decode().strip()
    except Exception:
        return "v0.0.0-dev"


version = os.environ.get("BREWCTL_VERSION_OVERRIDE") or git_describe()
variant = env["PIOENV"]

env.Append(CPPDEFINES=[
    ("BREWCTL_VERSION", env.StringifyMacro(version)),
    ("BREWCTL_VARIANT", env.StringifyMacro(variant)),
])
print("BrewControl build: version=%s variant=%s" % (version, variant))
