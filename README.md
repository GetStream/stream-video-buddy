# Stream Video Buddy

## Requirements

```bash
export STREAM_SDK_TEST_APP="..." # Dogfooding app url
export STREAM_SDK_TEST_ACCOUNT_PASSWORD="..." # See 1password
export STREAM_SDK_TEST_ACCOUNT_EMAIL="..." # See 1password
```

## Installation

```bash
npm i -g https://github.com/GetStream/stream-video-buddy
```

## Usage

`stream-video-buddy` can be executed in two ways

1. Directly:

    ```bash
    stream-video-buddy join --call-id test321 --users-count 5 --wait 10
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
          -d '{"call-id": "test321", "users-count": 5, "wait": 10}'
        ```
