# Description

*stream-video-buddy* is a CLI tool for automated testing of Stream Video Front-End SDKs. It acts as a participant in a video call and performs a series of actions to emulate a real user.

Even though the tool's primary purpose is automated testing, it can be pretty helpful for debugging and manual testing as well.

## Installation

```bash
npm install -g "https://github.com/GetStream/stream-video-buddy#1.8.1"
```

## Configuration

By default, the tool uses `https://getstream.io/video/demos` as the test app URL. You can override it in two ways:

1. Setting the `STREAM_SDK_TEST_APP` environment variable:

   ```bash
   export STREAM_SDK_TEST_APP="https://your-custom-app.com"
   ```

2. Using the `--app` command-line argument (overrides the environment variable)

## Usage

*stream-video-buddy* can be executed in two ways

1. From the command line:

    ```bash
    stream-video-buddy join --call-id test123 --user-count 2 --duration 10
    stream-video-buddy ring --user-id martin --duration 10
    ```

2. Through the local web server:

    1. Run the server instance:

        ```bash
        stream-video-buddy server --port 4567
        ```

    2. Execute `stream-video-buddy join` or `stream-video-buddy ring` command via the POST request, e.g.:

        ```bash
        curl "http://localhost:4567/join?async=true" \
          -X POST \
          -H "Content-Type: application/json" \
          -d '{"call-id": "test123", "user-count": 2, "duration": 10}'

        curl "http://localhost:4567/ring?async=true" \
          -X POST \
          -H "Content-Type: application/json" \
          -d '{"user-id": "martin", "duration": 10}'
        ```

### `livestream-bench`

Loads a livestream call with receive-only viewers that also chat, so a real client can be
profiled under that load. Built for benchmarking the Flutter `chat_rooms_with_livestream`
sample, but it works against any livestream call.

```bash
stream-video-buddy livestream-bench \
  --api-key "${STREAM_API_KEY}" \
  --api-secret "${STREAM_API_SECRET}" \
  --call-id backstage-lounge-bench \
  --channel-id backstage-lounge \
  --user-count 50 \
  --duration 300 \
  --churn-interval 30
```

How it differs from `join`, and why:

- **Bots do not publish, and do not decode.** `call.join()` sends no media unless the camera is
  explicitly enabled, and on the `livestream` call type only the `host` role may publish. There
  is no `<video>` element either: the SFU forwards a track because something is *subscribed* to
  it, not because a sink is attached, so rendering would only burn CPU on the machine generating
  the load. `--video-width` / `--video-height` pin which simulcast layer the server sends.
- **Bots are sharded across chromium processes and BrowserContexts**
  (`--pages-per-browser`, `--pages-per-context`). Chromium coalesces same-origin pages in one
  context into a single renderer, and dozens of peer connections in one renderer is the
  configuration behind most "it breaks past 50 participants" reports.
- **One failure never ends the run.** Ramp-up is `Promise.allSettled` with per-bot retry and full
  jitter, unlike `join`'s `Promise.all`.
- **Identities are deterministic**: `<prefix>-<runId>-<n>`, so bots never collide and a run is
  greppable in the dashboard afterwards.
- **Chat bots run in Node**, not in the pages, so a crashed renderer cannot take the chat load
  down with it. They need no `addMembers`, because Stream's `livestream` *channel* type is open
  to the `user` role - which also sidesteps the 100-members-per-call API limit.
- **`--churn-interval`** makes a fraction of viewers leave and rejoin on a timer. Steady-state
  viewers produce one participant event each and then go quiet; churn is what actually exercises
  a client's participant join/leave handling.

Use `--emit-dart-defines bench_env.json` to write the API key, the pinned call id and a token per
sample user, then start the Flutter app with
`flutter run --profile --dart-define-from-file=bench_env.json`.

Results land in `--out` (default `./bench-results.json`). The headline number is
**how many viewers were still live at the end**, not how many joined. Ctrl-C still writes results.

### Options reference

See [index.js](lib/index.js) for the full list of commands and their options.

## Release

Run the following commands to release a new version of *stream-video-buddy*:

```bash
bundle install
bundle exec fastlane release version:"${VERSION_NUMBER}"
```
