#!/usr/bin/env bash
set -euo pipefail
# Compatibility entry point. Package scripts use the portable Node implementation.
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "${script_dir}/portable-build.mjs" "$@"
