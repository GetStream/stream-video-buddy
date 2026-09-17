#!/usr/bin/env node
/**
 * Records Flutter frame timings and Dart heap from a running app's VM Service.
 *
 * This is the authoritative source for "does the UI keep up": the engine emits a
 * `Flutter.Frame` event per frame carrying the build (UI thread) and raster (GPU
 * thread) times that DevTools plots. Nothing else on the device reports that
 * split.
 *
 * Two Android tools that look like they should work, do not:
 *   - `dumpsys gfxinfo` instruments Android's HWUI pipeline, and Flutter renders
 *     with Skia/Impeller onto its own Surface, so it reports zero frames for a
 *     Flutter app no matter how hard it is working.
 *   - `dumpsys SurfaceFlinger --latency` does see presented frames, but only
 *     tells you when they appeared, not whether UI or raster was the bottleneck.
 *
 * Process-level memory still has to come from `dumpsys meminfo`, because for a
 * video app the Dart heap is a small fraction of the real footprint - decode and
 * GPU buffers dominate. Run sample-android.sh alongside this for that.
 *
 * Usage:
 *   node sample-flutter.js <ws-or-http-vm-uri> [--out frames.csv] [--interval 2]
 *
 * Get the URI from `adb logcat | grep "Dart VM service"` on a --profile build,
 * then `adb forward tcp:PORT tcp:PORT`.
 */

const fs = require('fs');

function toWs(uri) {
  return uri.replace(/^http/, 'ws').replace(/\/$/, '') + '/ws';
}

class VmService {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.pending = new Map();
    this.nextId = 1;
    this.onFrame = () => {};

    this.socket.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);

      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
        return;
      }

      const e = msg.params && msg.params.event;
      if (e && e.extensionKind === 'Flutter.Frame') this.onFrame(e.extensionData);
    });
  }

  ready() {
    return new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve);
      this.socket.addEventListener('error', () => reject(new Error('could not reach the VM Service')));
    });
  }

  call(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { reject, resolve });
      this.socket.send(JSON.stringify({ id, jsonrpc: '2.0', method, params }));
    });
  }
}

function percentile(values, q) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
}

async function main() {
  const [uri, ...rest] = process.argv.slice(2);
  if (!uri) {
    console.error('usage: sample-flutter.js <vm-uri> [--out frames.csv] [--interval 2]');
    process.exit(1);
  }
  const out = rest.includes('--out') ? rest[rest.indexOf('--out') + 1] : 'flutter-frames.csv';
  const interval =
    (rest.includes('--interval') ? Number(rest[rest.indexOf('--interval') + 1]) : 2) * 1000;

  const vm = new VmService(toWs(uri));
  await vm.ready();

  const { isolates } = await vm.call('getVM');
  const isolateId = isolates[0].id;

  // `Extension` is the stream the engine posts Flutter.Frame on.
  await vm.call('streamListen', { streamId: 'Extension' });

  const csv = fs.createWriteStream(out);
  csv.write('elapsed_s,frames,fps,build_p50_ms,build_p95_ms,raster_p50_ms,raster_p95_ms,worst_ms,slow_frames,heap_mb\n');

  let window = [];
  vm.onFrame = (data) => window.push(data);

  console.log(`Recording Flutter frames -> ${out} (Ctrl-C to stop)`);
  const startedAt = Date.now();

  const tick = async () => {
    const batch = window;
    window = [];

    const us = (n) => n / 1000;
    const build = batch.map((f) => us(f.build));
    const raster = batch.map((f) => us(f.raster));
    const total = batch.map((f) => us(f.elapsed));

    let heapMb = null;
    try {
      const mem = await vm.call('getMemoryUsage', { isolateId });
      heapMb = Math.round(((mem.heapUsage + mem.externalUsage) / 1048576) * 10) / 10;
    } catch (error) {
      // The isolate can be busy or gone; a missing heap reading must not stop
      // the frame recording, which is the point of this tool.
    }

    const elapsed = Math.round((Date.now() - startedAt) / 1000);
    const fps = Math.round((batch.length / (interval / 1000)) * 10) / 10;
    // 16.7ms is a 60Hz budget; a frame over it is one the user can feel.
    const slow = total.filter((t) => t > 16.7).length;
    const r = (v) => (v == null ? '' : Math.round(v * 10) / 10);

    csv.write(
      [
        elapsed, batch.length, fps,
        r(percentile(build, 0.5)), r(percentile(build, 0.95)),
        r(percentile(raster, 0.5)), r(percentile(raster, 0.95)),
        r(Math.max(0, ...total)), slow, heapMb ?? '',
      ].join(',') + '\n',
    );

    console.log(
      `t+${elapsed}s  frames=${batch.length} (${fps}/s)  ` +
        `build p50/p95 ${r(percentile(build, 0.5))}/${r(percentile(build, 0.95))}ms  ` +
        `raster p50/p95 ${r(percentile(raster, 0.5))}/${r(percentile(raster, 0.95))}ms  ` +
        `slow ${slow}  heap ${heapMb ?? '?'}MB`,
    );
  };

  setInterval(tick, interval);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
