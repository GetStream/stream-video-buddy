# Description

*stream-video-buddy* is a CLI tool for automated testing of Stream Video Front-End SDKs. It acts as a participant in a video call and performs a series of actions to emulate a real user.

Even though the tool's primary purpose is automated testing, it can be pretty helpful for debugging and manual testing as well.

## Installation

```bash
npm install -g "https://github.com/GetStream/stream-video-buddy#1.6.7"
```

## Requirements

```bash
export STREAM_SDK_TEST_APP="..."
export STREAM_SDK_TEST_ACCOUNT_EMAIL="..."
export STREAM_SDK_TEST_ACCOUNT_PASSWORD="..."
export STREAM_SDK_TEST_ACCOUNT_OTP_SECRET="..."
```

## Authorization

First of all, *stream-video-buddy* needs to be authorized in Dogfooding app:

```bash
$ stream-video-buddy auth
⏳ Going through Google OAuth
✅ Google OAuth has passed
```

As soon as authorization passes, *stream-video-buddy* is ready to use.
In case you constantly see something like this…

```bash
❌ Google OAuth has declined OTP. Trying again...
❌ Google OAuth has declined OTP. Trying again...
❌ Google OAuth has declined OTP. Trying again...
```

…ensure you exported [all required credentials](#requirements).

## ⚠️ Warning

By default, *stream-video-buddy* uses a test Stream account to join video calls. To speed things up, it saves cookies after the very first authorization to bypass the OAuth flow on the subsequent ones. Make sure you add `video-buddy-session.json` to your `.gitignore` file.

## Usage

*stream-video-buddy* can be executed in two ways

1. From the command line:

    ```bash
    stream-video-buddy auth
    stream-video-buddy join --call-id test123 --user-count 2 --duration 10
    ```

2. Through the local web server:

    1. Run the server instance:

        ```bash
        stream-video-buddy server --port 4567
        ```

    2. Execute `stream-video-buddy join` command via the POST request, e.g.:

        ```bash
        curl "http://localhost:4567/stream-video-buddy?async=true" \
          -X POST \
          -H "Content-Type: application/json" \
          -d '{"call-id": "test123", "user-count": 2, "duration": 10}'
        ```

### Options reference

The table below lists all options you can include on the `stream-video-buddy` command line.

| Category | Option | Description | Default |
| --- | --- | --- | --- |
| **General** | `-h, --help` | Display help documentation | |
| | `-V, --version` | Display version information | |
| **Events** | `-i, --call-id <string>` | Which call should participant join? | |
| | `-d, --duration <seconds>` | How long should participant stay on the call? | `∞` |
| | `-c, --user-count <number>` | How many participants should join the call? | `1` |
| | `-m, --message <string>` | What message should participant send? | |
| | `--message-count <number>` | How many messages should participant send? | `1` |
| | `--camera` | Should participant turn on the camera? | `false` |
| | `--mic` | Should participant turn on the microphone? | `false` |
| | `--silent` | Should participant be silent when the mic is on? | `false` |
| | `--screen-share` | Should participant share the screen? | `false` |
| | `--screen-sharing-duration <seconds>` | How long should participant share the screen? | `∞` |
| | `--record` | Should participant record the call? | `false` |
| | `--recording-duration <seconds>` | How long should participant record the call? | `∞` |
| **Debugging** | `--show-window` | Should browser window be visible? | `false` |
|  | `--record-session` | Should buddy record the session? | `false` |

## Release

To release a new version of *stream-video-buddy*:

1. Update the package version in `package.json` file
2. Run the following command:

```bash
bundle install
bundle exec fastlane release version:"${VERSION_NUMBER}"
```

### Internal docs

- [Notion](https://notion.so/18adf69c5393493e8bab4e8798326155)
