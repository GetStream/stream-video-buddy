const express = require('express');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

/**
 * Serves the bot viewer page off localhost for the duration of a run.
 *
 * The bots need a real origin - `file://` pages get no secure context, which
 * WebRTC and the Stream SDKs both require - and serving it ourselves keeps the
 * benchmark independent of any deployed app.
 */
/**
 * Bundles the viewer entry point if it is missing or stale.
 *
 * The repo has no build step and should keep not having one, so this runs on
 * demand when the bench command starts rather than at install or commit time.
 */
function ensureBundle() {
  const dir = path.join(__dirname, 'viewer');
  const entry = path.join(dir, 'main.js');
  const bundle = path.join(dir, 'bundle.js');

  const fresh = fs.existsSync(bundle) && fs.statSync(bundle).mtimeMs >= fs.statSync(entry).mtimeMs;
  if (fresh) return;

  console.log('Building the viewer bundle...');
  execFileSync(
    path.join(__dirname, '..', '..', 'node_modules', '.bin', 'esbuild'),
    [entry, '--bundle', '--format=esm', `--outfile=${bundle}`],
    { stdio: 'inherit' },
  );
}

async function startViewerServer(port = 0) {
  ensureBundle();
  const app = express();
  app.use(express.static(path.join(__dirname, 'viewer')));

  return await new Promise((resolve, reject) => {
    const server = app.listen(port, '127.0.0.1');
    server.on('error', reject);
    server.on('listening', () => {
      resolve({
        close: () => new Promise((done) => server.close(done)),
        url: `http://127.0.0.1:${server.address().port}/page.html`,
      });
    });
  });
}

module.exports = { startViewerServer };
