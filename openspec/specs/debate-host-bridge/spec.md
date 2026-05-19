# debate-host-bridge Specification

## Purpose

TBD - created by archiving change 'bootstrap-debate-mvp'. Update Purpose after archive.

## Requirements

### Requirement: Bridge Binds Only to Loopback Interface

The Node bridge SHALL listen on `127.0.0.1` and SHALL NOT accept connections from any other network interface. The default port SHALL be 7456. The bridge SHALL read environment variable `BRIDGE_PORT` if set and use that value instead of the default.

#### Scenario: External connection refused

- **WHEN** a process on a different machine attempts to connect to the bridge port on the host's LAN IP
- **THEN** the connection is refused at the TCP layer

#### Scenario: Loopback connection accepted

- **WHEN** the browser running on the same host issues a request to `http://127.0.0.1:7456/turn`
- **THEN** the bridge accepts the connection and processes the request

---
### Requirement: Bridge Permits Cross-Origin Requests via Wildcard

The bridge SHALL respond with HTTP header `Access-Control-Allow-Origin: *` on all responses to permit both `file://` and `http://127.0.0.1` frontend origins.

#### Scenario: file:// origin request accepted

- **WHEN** the frontend is loaded from `file:///` and issues a fetch to `http://127.0.0.1:7456/turn`
- **THEN** the bridge responds with the wildcard CORS header and the browser accepts the response

---
### Requirement: Bridge Spawns CLIs Without Shell Interpretation

The bridge SHALL invoke `codexCli` and `claudeCli` using `child_process.spawn` with option `shell: false`. The bridge MUST NOT pass user-supplied input through any shell expansion, command substitution, or argument string concatenation.

#### Scenario: Topic containing shell metacharacters does not execute shell

- **WHEN** the user submits a topic equal to `"; rm -rf /` and the bridge invokes a CLI with that string in arguments or stdin
- **THEN** no shell command interpretation occurs and the literal string is delivered to the CLI process

---
### Requirement: POST /turn Launches a CLI Subprocess and Returns a Turn ID

The bridge SHALL expose endpoint `POST /turn` accepting JSON body containing `cli`, `stance`, `prompt`, and `effortLevel`. The bridge MUST spawn the requested CLI subprocess with translated effort flags, deliver the prompt via stdin, and respond with JSON containing a non-empty `turnId` string identifying the running turn.

#### Scenario: Valid request returns turnId

- **WHEN** the frontend issues `POST /turn` with body containing cli="codex", stance="pro", prompt="topic content", effortLevel="medium"
- **THEN** the bridge spawns the codex subprocess with the translated effort flags
- **AND** the response body is JSON containing a non-empty `turnId` string

---
### Requirement: GET /turn/:turnId/stream Streams Output via Server-Sent Events

The bridge SHALL expose endpoint `GET /turn/:turnId/stream` returning content type `text/event-stream`. Each segment of CLI stdout SHALL be emitted as one event with payload `{"chunk": "..."}`. On normal completion the bridge SHALL emit exactly one event with payload `{"done": true}`. On any failure mode the bridge SHALL emit exactly one event with payload `{"error": "..."}`. After emitting `done` or `error` the bridge SHALL close the connection.

#### Scenario: Successful streaming completes with done event

- **WHEN** a CLI subprocess writes "Hello" then " World" to stdout and exits with code 0
- **THEN** the bridge emits an event with payload containing chunk "Hello"
- **AND** then an event with payload containing chunk " World"
- **AND** then an event with payload `{"done": true}`
- **AND** then closes the connection

#### Scenario: Non-zero exit emits error event

- **WHEN** a CLI subprocess exits with a non-zero exit code
- **THEN** the bridge emits exactly one event with payload `{"error": "..."}` whose error string contains the first 200 characters of stderr
- **AND** then closes the connection

---
### Requirement: POST /turn/:turnId/abort Terminates the Running Subprocess

The bridge SHALL expose endpoint `POST /turn/:turnId/abort`. The bridge MUST send `SIGTERM` to the corresponding child process and respond with JSON `{"ok": true}`. The associated SSE stream MUST then emit an error event and close.

#### Scenario: Abort terminates running CLI

- **WHEN** the frontend issues `POST /turn/abc123/abort` while the CLI process for turn abc123 is still running
- **THEN** the bridge sends SIGTERM to that process
- **AND** the response body is `{"ok": true}`
- **AND** the open SSE stream for that turn emits an error event and closes

---
### Requirement: 90-Second Per-Turn Timeout Terminates Stuck CLIs

The bridge SHALL enforce a 90-second timeout per turn measured from subprocess spawn. On timeout, the bridge MUST send `SIGTERM` to the subprocess and emit one error event whose error string identifies the cause as timeout.

#### Scenario: Stuck CLI is killed at 90 seconds

- **WHEN** a CLI subprocess produces no termination signal within 90 seconds of spawn
- **THEN** the bridge sends SIGTERM to the subprocess at the 90-second mark
- **AND** emits exactly one error event whose error string identifies timeout as the cause

---
### Requirement: Effort Translation Uses Two Distinct Per-CLI Maps With Verified Literal Values

The bridge SHALL maintain two effort translation maps with distinct literal flag values: one for codex and one for claude. The codex map SHALL translate UI level `xhigh` to literal string `xhigh` and UI level `max` to literal string `xhigh` (codex has no `max` — capped at `xhigh`). The claude map SHALL translate UI level `xhigh` to literal string `xhigh` and UI level `max` to literal string `max`. The bridge SHALL include unit tests asserting these literal values at code level.

Note: an earlier draft of this spec recorded claude's fourth level as `xigh` (without `h`); querying `claude --help` directly during apply confirmed the actual literal is `xhigh` (with `h`). The maps were updated accordingly.

#### Scenario: claude xhigh translates to literal xhigh

- **WHEN** the translation function is invoked with level `xhigh` and cli `claude`
- **THEN** the returned argument list contains the literal string `xhigh`

#### Scenario: codex max falls back to xhigh

- **WHEN** the translation function is invoked with level `max` and cli `codex`
- **THEN** the returned argument list contains the literal string `xhigh`

##### Example: full mapping matrix

| UI level | codex value | claude value |
| -------- | ----------- | ------------ |
| low      | low         | low          |
| medium   | medium      | medium       |
| high     | high        | high         |
| xhigh    | xhigh       | xhigh        |
| max      | xhigh       | max          |
