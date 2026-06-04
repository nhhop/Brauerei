#pragma once

// Normally provided as compile-time macros by version_flags.py. These defaults
// only apply if the build is invoked without the pre-build script.
#ifndef BREWCTL_VERSION
#define BREWCTL_VERSION "v0.0.0-dev"
#endif

#ifndef BREWCTL_VARIANT
#define BREWCTL_VARIANT "unknown"
#endif
