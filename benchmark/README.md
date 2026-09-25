# Join-rate harness

Measures how fast viewers can join a Stream call. It runs the Stream WebRTC
stack with no application on top of it, so a reported join time is the SDK's
join time rather than a web app's render time.

This is deliberately *not* stream-video-buddy. Buddy drives a real app through a
real UI, which is what you want for end-to-end SDK behaviour with a handful of
participants. It is the wrong tool for join-rate and capacity testing, because
most of its per-participant cost is the app: on `getstream.io/video/demos` the
lobby takes ~4.1s to render and another ~2.9s to reach the call screen, none of
which tells you anything about how fast the SFU admits a viewer.

## Usage

```bash
node benchmark/load-test.js --api-key <key> --call-id <id> --participants 50 --tabs 5 --guest
```

The first run bundles `@stream-io/video-client` and `stream-chat` into
`benchmark/vendor/` (gitignored). That needs network access once; afterwards it
is local.

### Authentication

Two modes, and the right one depends on your app's role permissions:

- `--guest` — viewers join as guest users. No token, no API secret, nothing to
  mint. This is usually what a livestream viewer is, and it is the cheapest way
  to run the harness. Your app must grant the `guest` role `JoinCall` on the
  call type you are testing.
- Authenticated — set `STREAM_API_SECRET` (or pass `--api-secret`) and the
  harness mints one token per user via `@stream-io/node-sdk`. Alternatively
  point `--token-url` at an endpoint that returns `{ token }` for `?user_id=`.

The secret is read from the environment and never logged.

### Options

| Flag | Meaning |
| --- | --- |
| `--participants <n>` | How many viewers to join. |
| `--tabs <n>` | Spread them across this many tabs. One tab holds many clients; tabs are the expensive unit, not clients. |
| `--ramp <ms>` | Stagger joins inside a tab. `0` fires them all at once. |
| `--hold <seconds>` | Stay on the call after joining. |
| `--create` | Create the call if missing. Guests usually may not do this. |
| `--json <path>` | Write raw per-participant results. |
| `--show-window` | Run headed. |

### Chat

Passing `--chat-channel-id` makes each participant also connect a chat client
and send a message after joining the call, so a run exercises write load next to
join load:

```bash
node benchmark/load-test.js --api-key <key> --call-id <id> --participants 50 \
  --chat-channel-id <channel> --message-count 3
```

| Flag | Meaning |
| --- | --- |
| `--chat-channel-id <id>` | Channel to post in. Enables the chat leg. |
| `--chat-channel-type <type>` | Channel type, default `messaging`. A channel is identified by type *and* id, not id alone. |
| `-m, --message <text>` | Message body. |
| `--message-count <n>` | Messages per participant, sent sequentially. |

Chat is a separate client and a separate WebSocket, timed separately so a slow
send never hides inside the join number.

Chat only runs for participants that joined successfully. If the joins fail, no
messages are sent at all.

## Output

```
- 50/50 joined in 4820ms wall clock

        metric  min  p50  p90  p95  p99  max  mean
--------------  ---  ---  ---  ---  ---  ---  ----
call.join() ms  ...
client+join ms  ...

  throughput: 10.4 joins/sec
```

`call.join() ms` is the join call itself. `client+join ms` adds client
construction and device teardown.

## Notes

- Viewers never open a camera or microphone: the page explicitly disables both
  before joining, and the browser is launched without
  `--use-file-for-fake-video-capture`. Pointing Chrome at `mocks/video.y4m`
  (1.7GB, 1080x1920) would turn this into an encode benchmark.
- Failures are grouped and counted rather than thrown, so a permissions problem
  shows up as one readable line instead of 50 stack traces.
- If your viewers watch over HLS rather than WebRTC, do not use this harness at
  all. HLS viewers pull `call.state.egress?.hls?.playlist_url` over plain HTTP,
  so `k6` or `vegeta` against the playlist simulates thousands of them for a
  fraction of the cost.
