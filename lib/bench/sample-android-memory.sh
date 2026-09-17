#!/usr/bin/env bash
# Samples a Flutter app's real process memory on an Android device, to CSV.
#
# The Dart heap tells you almost nothing for a video app - native decode and
# GPU buffers dominate - so this reads `dumpsys meminfo`, which is where the
# video pipeline actually shows up.
#
# Usage:
#   ./sample-android-memory.sh <serial> [package] [interval-seconds] [out.csv]
#
# Find the serial with `adb devices`. Run it against the *measured* phone while
# `livestream-bench` drives the load from the Mac.

set -euo pipefail

SERIAL="${1:?usage: sample-android-memory.sh <serial> [package] [interval] [out.csv]}"
PACKAGE="${2:-com.example.chat_rooms_with_livestream}"
INTERVAL="${3:-2}"
OUT="${4:-android-memory.csv}"

echo "elapsed_s,total_pss_kb,java_heap_kb,native_heap_kb,graphics_kb,gl_mtrack_kb" > "$OUT"
echo "Sampling $PACKAGE on $SERIAL every ${INTERVAL}s -> $OUT (Ctrl-C to stop)"

START=$(date +%s)
while true; do
  DUMP=$(adb -s "$SERIAL" shell dumpsys meminfo "$PACKAGE" 2>/dev/null || true)

  if [ -z "$DUMP" ]; then
    echo "waiting for $PACKAGE to start..."
    sleep "$INTERVAL"
    continue
  fi

  ELAPSED=$(( $(date +%s) - START ))

  # All of these come from the "App Summary" block, whose rows are
  # "<label>: <pss>". The detail table above it has a "Native Heap" row with no
  # colon, which is why every pattern here keeps its colon.
  TOTAL=$(echo "$DUMP"   | awk '/TOTAL PSS:/ {print $3; exit}' | tr -dc '0-9')
  JAVA=$(echo "$DUMP"    | awk '/Java Heap:/ {print $3; exit}' | tr -dc '0-9')
  NATIVE=$(echo "$DUMP"  | awk '/Native Heap:/ {print $3; exit}' | tr -dc '0-9')
  GRAPHICS=$(echo "$DUMP"| awk '/Graphics:/ {print $2; exit}' | tr -dc '0-9')
  # "GL mtrack" is in the detail table, not the summary, so the value is $3.
  # Matched on fields rather than as a substring, because a plain /GL mtrack/
  # also matches the "EGL mtrack" row directly above it.
  GL=$(echo "$DUMP"      | awk '$1 == "GL" && $2 == "mtrack" {print $3; exit}' | tr -dc '0-9')

  echo "${ELAPSED},${TOTAL:-},${JAVA:-},${NATIVE:-},${GRAPHICS:-},${GL:-}" >> "$OUT"
  echo "t+${ELAPSED}s  total_pss=${TOTAL:-?}kB  native=${NATIVE:-?}kB  graphics=${GRAPHICS:-?}kB"

  sleep "$INTERVAL"
done
