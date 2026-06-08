#!/usr/bin/env bash
# Cost-guard: fail if any 'claude-' model identifier appears outside the central map.
# S2-T7: MODEL_BY_AGENT_TIER is the only authorized source of model strings.
set -euo pipefail

ALLOWED_FILES=(
  "src/server/config/models.ts"
  "src/daemon/src/types.ts"
)

# Search src/ for the literal 'claude-' followed by opus/sonnet/haiku in TS source.
matches=$(grep -RnE "'claude-(opus|sonnet|haiku)-[0-9]" \
  src/server src/client src/daemon src/shared 2>/dev/null || true)

if [[ -z "$matches" ]]; then
  echo "cost-guard: OK — no model strings in source."
  exit 0
fi

violations=""
while IFS= read -r line; do
  file="${line%%:*}"
  skip=0
  for allowed in "${ALLOWED_FILES[@]}"; do
    if [[ "$file" == "$allowed" ]]; then skip=1; break; fi
  done
  [[ "$skip" == 0 ]] && violations+="$line"$'\n'
done <<< "$matches"

if [[ -n "$violations" ]]; then
  echo "cost-guard: FAIL — hardcoded model strings outside config/models.ts:"
  echo "$violations"
  exit 1
fi

echo "cost-guard: OK — model strings only in approved files."
