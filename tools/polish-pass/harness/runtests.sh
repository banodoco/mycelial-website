#!/bin/bash
# usage: runtests.sh <repo> <outfile>
cd "$1"
: > "$2"
for f in tools/test-*.mjs journey/structure.test.mjs; do
  case "$f" in *browser*|*epilogue-retire*|*dwell*) continue;; esac
  timeout 180 node "$f" > /dev/null 2>&1 < /dev/null
  echo "$? $f" >> "$2"
done
