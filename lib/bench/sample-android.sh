#!/usr/bin/env bash
# Samples a Flutter app's memory and UI frame stats on an Android device, to CSV.
#
# Memory: the Dart heap says little for a video app - native decode and GPU
# buffers dominate - so this reads `dumpsys meminfo`, where the video pipeline
# actually shows up.
#
# Frames: `dumpsys gfxinfo` counts *UI* frames. Livestream video arrives on a
# texture and does not go through this path, so these numbers are the cost of
# the Flutter UI itself - the message list repainting as chat floods in, which
# is exactly what a busy room stresses. Stats are reset after every read, so
# each row describes only its own interval rather than the whole run.
#
# Usage:
#   ./sample-android.sh <serial> [package] [interval-seconds] [out.csv]
#
# Find the serial with `adb devices`. Run one per phone - host and viewer are
# both worth measuring, and they stress different things.

set -uo pipefail

SERIAL="${1:?usage: sample-android.sh <serial> [package] [interval] [out.csv]}"
PACKAGE="${2:-com.example.chat_rooms_with_livestream}"
INTERVAL="${3:-2}"
OUT="${4:-android-sample.csv}"

echo "elapsed_s,total_pss_kb,java_heap_kb,native_heap_kb,graphics_kb,gl_mtrack_kb,frames,janky,jank_pct,fps,p50_ms,p90_ms,p95_ms,p99_ms" > "$OUT"
echo "Sampling $PACKAGE on $SERIAL every ${INTERVAL}s -> $OUT (Ctrl-C to stop)"

adb -s "$SERIAL" shell dumpsys gfxinfo "$PACKAGE" reset > /dev/null 2>&1
START=$(date +%s)

while true; do
  sleep "$INTERVAL"

  MEM=$(adb -s "$SERIAL" shell dumpsys meminfo "$PACKAGE" 2>/dev/null)
  GFX=$(adb -s "$SERIAL" shell dumpsys gfxinfo "$PACKAGE" 2>/dev/null)
  adb -s "$SERIAL" shell dumpsys gfxinfo "$PACKAGE" reset > /dev/null 2>&1

  if [ -z "$MEM" ]; then
    echo "waiting for $PACKAGE to start..."
    continue
  fi

  ELAPSED=$(( $(date +%s) - START ))

  # App Summary rows are "<label>: <pss>". The detail table above has a
  # "Native Heap" row with no colon, which is why the patterns keep theirs.
  TOTAL=$(echo "$MEM"    | awk '/TOTAL PSS:/ {print $3; exit}'   | tr -dc '0-9')
  JAVA=$(echo "$MEM"     | awk '/Java Heap:/ {print $3; exit}'   | tr -dc '0-9')
  NATIVE=$(echo "$MEM"   | awk '/Native Heap:/ {print $3; exit}' | tr -dc '0-9')
  GRAPHICS=$(echo "$MEM" | awk '/Graphics:/ {print $2; exit}'    | tr -dc '0-9')
  # Matched on fields, because a plain /GL mtrack/ also catches "EGL mtrack".
  GL=$(echo "$MEM"       | awk '$1 == "GL" && $2 == "mtrack" {print $3; exit}' | tr -dc '0-9')

  FRAMES=$(echo "$GFX" | awk '/Total frames rendered:/ {print $4; exit}' | tr -dc '0-9')
  JANKY=$(echo "$GFX"  | awk '/^Janky frames:/ {print $3; exit}'         | tr -dc '0-9')
  P50=$(echo "$GFX"    | awk '/50th percentile:/ {print $3; exit}'       | tr -dc '0-9')
  P90=$(echo "$GFX"    | awk '/90th percentile:/ {print $3; exit}'       | tr -dc '0-9')
  P95=$(echo "$GFX"    | awk '/95th percentile:/ {print $3; exit}'       | tr -dc '0-9')
  P99=$(echo "$GFX"    | awk '/99th percentile:/ {print $3; exit}'       | tr -dc '0-9')

  FRAMES=${FRAMES:-0}
  JANKY=${JANKY:-0}

  # With no frames drawn in this interval, gfxinfo still reports the previous
  # window's percentiles. Reporting those would invent jank that did not
  # happen, so blank them instead.
  if [ "$FRAMES" -eq 0 ]; then
    P50=""; P90=""; P95=""; P99=""
  fi
  FPS=$(awk -v f="$FRAMES" -v i="$INTERVAL" 'BEGIN {printf "%.1f", f/i}')
  JANK_PCT=$(awk -v j="$JANKY" -v f="$FRAMES" 'BEGIN {printf "%.1f", (f>0 ? 100*j/f : 0)}')

  echo "${ELAPSED},${TOTAL:-},${JAVA:-},${NATIVE:-},${GRAPHICS:-},${GL:-},${FRAMES},${JANKY},${JANK_PCT},${FPS},${P50:-},${P90:-},${P95:-},${P99:-}" >> "$OUT"
  echo "t+${ELAPSED}s  pss=$(( ${TOTAL:-0} / 1024 ))MB  frames=${FRAMES} (${FPS}/s)  jank=${JANK_PCT}%  p95=${P95:-?}ms"
done
