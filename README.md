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
        export STREAM_VIDEO_BUDDY_SERVER_TOKEN="$(openssl rand -hex 32)"
        stream-video-buddy server --port 4567
        ```

        The server requires this token at startup and listens on `127.0.0.1` by default.
        Keep the token in a local environment variable or CI secret; do not commit it.

    2. Execute `stream-video-buddy join` or `stream-video-buddy ring` command via the POST request, e.g.:

        ```bash
        curl "http://localhost:4567/join?async=true" \
          -X POST \
          -H "Authorization: Bearer ${STREAM_VIDEO_BUDDY_SERVER_TOKEN}" \
          -H "Content-Type: application/json" \
          -d '{"call-id": "test123", "user-count": 2, "duration": 10}'

        curl "http://localhost:4567/ring?async=true" \
          -X POST \
          -H "Authorization: Bearer ${STREAM_VIDEO_BUDDY_SERVER_TOKEN}" \
          -H "Content-Type: application/json" \
          -d '{"user-id": "martin", "duration": 10}'
        ```

    3. Stop the server with the same token:

        ```bash
        curl "http://localhost:4567/stop" \
          -H "Authorization: Bearer ${STREAM_VIDEO_BUDDY_SERVER_TOKEN}"
        ```

### Migrating existing HTTP clients

All HTTP requests, including `/stop`, now require `Authorization: Bearer <server-token>`.
Configure the same `STREAM_VIDEO_BUDDY_SERVER_TOKEN` secret for the server and your Android,
iOS, Flutter, or other test client. This server credential is separate from the Stream call
token supplied in a `/join` body. Direct CLI `join` and `ring` commands do not require a
server token.

For clients on another machine or a device that cannot reach the server's loopback interface,
explicitly select a private interface with `--host <address>`. Use a trusted, isolated test
network or an authenticated tunnel; the server uses plain HTTP and must not be exposed to
the public internet. See [SECURITY.md](SECURITY.md) for the supported scope.

Request bodies must be JSON objects containing only the options for the selected command.
Use JSON booleans for switches, strings for text, and numbers (or numeric strings) for
durations and counts. Counts must be positive integers and durations must be non-negative.
`call-id` is required for `/join`; `user-id` is required for `/ring`. Unknown options and
invalid values return HTTP 400 without starting a process; missing or incorrect server
credentials return HTTP 401. Values are passed literally, so shell quoting is unnecessary.
`?async=true` acknowledges a validated command with HTTP 200 while it runs; otherwise the
response waits for completion and returns HTTP 500 if the command fails.

### Server regression tests

The HTTP security tests run locally without Chromium, credentials, or calls to a demo app:

```bash
npm ci
npm test -- --runInBand test/server.test.js
```

### Options reference

See [index.js](lib/index.js) for the full list of commands and their options.

## Release

Run the following commands to release a new version of *stream-video-buddy*:

```bash
bundle install
bundle exec fastlane release version:"${VERSION_NUMBER}"
```
