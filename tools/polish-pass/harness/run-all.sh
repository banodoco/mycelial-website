#!/bin/bash
# Runs each transition in its own browser process, with a hard timeout and retries.
# A stalled CDP call under host contention costs one attempt, not the whole run.
OUT=/tmp/claude-0/-home-user/62a00d20-ec8d-551d-aa8b-33233b07a42e/scratchpad/captures/H1-motion
VP=${VP:-640x400}
MODE=${MODE:-desktop}
shift_args=""
[ "$MODE" = mobile ] && shift_args="--mobile"
for T in "$@"; do
  for attempt in 1 2 3; do
    echo "== $T attempt $attempt $(date +%T)"
    timeout 1200 node /tmp/claude-0/-home-user/62a00d20-ec8d-551d-aa8b-33233b07a42e/scratchpad/harness/motion-capture.js $shift_args --only "$T" --viewport $VP --max-sec 6 --out "$OUT" && { echo "== $T ok"; break; }
    echo "== $T failed attempt $attempt"
  done
done
echo ALLDONE
