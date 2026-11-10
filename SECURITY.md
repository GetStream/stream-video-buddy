# Security

`stream-video-buddy` is a development and automated testing tool. It launches browser
participants with the permissions of the developer or CI runner that starts it. It is
not intended to be a production service or a public API.

The HTTP server requires a shared bearer token and binds to `127.0.0.1` by default.
Use a randomly generated `STREAM_VIDEO_BUDDY_SERVER_TOKEN` and treat anyone who holds it
as a trusted operator: they can launch test participants and stop the server. Do not use
production credentials or run the tool on a machine with unnecessary secrets or privileges.

If remote test devices need access, explicitly bind to a private interface with `--host`
and restrict access to a trusted, isolated network or an authenticated tunnel. The built-in
server uses plain HTTP, does not provide TLS or per-user authorization, and must not be
exposed to the public internet.

Report suspected vulnerabilities privately through [Stream support](https://getstream.io/contact/support/).
Include the affected revision, steps to reproduce, and expected impact. Avoid posting
credentials or exploit details in public issues.
