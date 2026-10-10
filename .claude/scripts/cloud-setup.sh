#!/usr/bin/env bash
# SessionStart hook: provisions PlatformIO + pnpm in Claude Code cloud sessions.
# No-op locally (CLAUDE_CODE_REMOTE is only set in the cloud).
[ "$CLAUDE_CODE_REMOTE" = "true" ] || exit 0
set -e
cd "$CLAUDE_PROJECT_DIR"

command -v pio >/dev/null || pip install --quiet platformio
corepack enable 2>/dev/null || npm install -g pnpm
(cd BrewControl/web && pnpm install --frozen-lockfile)
