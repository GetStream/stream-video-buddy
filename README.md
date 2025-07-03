# Description

*stream-video-buddy* is a CLI tool for automated testing of Stream Video Front-End SDKs. It acts as a participant in a video call and performs a series of actions to emulate a real user.

Even though the tool's primary purpose is automated testing, it can be pretty helpful for debugging and manual testing as well.

## Installation

```bash
npm install -g "https://github.com/GetStream/stream-video-buddy#1.6.32"
```

## Requirements

```bash
export STREAM_SDK_TEST_APP="https://getstream.io/video/demos"
```

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

### Options reference

See [index.js](lib/index.js) for the full list of commands and their options.

## Release

Run the following commands to release a new version of *stream-video-buddy*:

```bash
bundle install
bundle exec fastlane release version:"${VERSION_NUMBER}"
```
