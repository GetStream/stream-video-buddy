# Description

*stream-video-buddy* is a tool for testing video calls in the Stream SDKs. It acts as a participant in a video call and performs a series of actions to emulate a real user.

## Requirements

```bash
export STREAM_SDK_TEST_APP="..." # Dogfooding app url
export STREAM_SDK_TEST_ACCOUNT_PASSWORD="..." # See 1password
export STREAM_SDK_TEST_ACCOUNT_EMAIL="..." # See 1password
```

## Installation

```bash
npm install -g https://github.com/GetStream/stream-video-buddy
```

## Usage

*stream-video-buddy* can be executed in two ways

1. Directly:

    ```bash
    stream-video-buddy join --call-id test321 --users-count 2 --mic --camera
    ```

2. Remotely:

    1. Run a server instance:

        ```bash
        stream-video-buddy server --port 4567
        ```

    2. Send requests to the server from the client:

        ```bash
        curl "http://localhost:4567/stream-video-buddy" \
          -X POST \
          -H "Content-Type: application/json" \
          -d '{"call-id": "test321", "users-count": 5, "duration": 10}'
        ```

### Options reference

The table below lists all options you can include on the `stream-video-buddy` command line.

| Category | Option | Description | Default |
| --- | --- | --- | --- |
| **General** | `-h, --help` | Display help documentation | |
| | `-V, --version` | Display version information | |
| **Events** | `-i, --call-id <string>` | Which call should participant join? | |
| | `-d, --duration <seconds>` | How long should participant stay on the call? | `∞` |
| | `-c, --users-count <number>` | How many participants should join the call? | `1` |
| | `--camera` | Should participant turn on the camera? | `false` |
| | `--frozen` | Should participant be frozen when the camera is on? | `false` |
| | `--mic` | Should participant turn on the microphone? | `false` |
| | `--silent` | Should participant be silent when the mic is on? | `false` |
| | `--screen-share` | Should participant share the screen? | `false` |
| | `--screen-sharing-duration <seconds>` | How long should participant share the screen? | `∞` |
| | `--record` | Should participant record the call? | `false` |
| | `--recording-duration <seconds>` | How long should participant record the call? | `∞` |
| **Debugging** | `--show-window` | Should browser window be visible? | `false` |
