# Changelog

All notable changes to `@agilab/react` will be documented here.

## [0.1.0] — 2026-05-17

Initial release. Headless React hooks for the [AG-UI](https://github.com/ag-ui-protocol/ag-ui) protocol.

**`useAgentRun`** — connects to an AG-UI agent over SSE and reduces all incoming events into a single reactive `agentState` object. Supports text streaming, tool calls, extended reasoning, step tracking, custom event handlers, and abort.

**`useUIState`** — lightweight state manager for the UI context sent to the agent on every run. Exposes `update`, `set`, and `reset` helpers.

**Example** — a working chat UI built with [@chatscope/chat-ui-kit-react](https://chatscope.io/) is included under `examples/with-chatscope`.
