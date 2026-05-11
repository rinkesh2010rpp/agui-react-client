# AgentUI

A monorepo containing `@agentui/react` — a headless React library that converts raw [AG-UI](https://github.com/ag-ui-protocol/ag-ui) SSE events into streaming-aware React state — plus a demo chat application built on top of it.

## Packages

| Package | Description |
|---|---|
| [`packages/agui-react`](./packages/agui-react) | Headless library — the publishable package |
| [`app`](./app) | Demo chat UI using [@chatscope/chat-ui-kit-react](https://chatscope.io/) |

## Getting started

```bash
npm install
npm run dev        # starts demo app on http://localhost:5173
npm run typecheck  # type-check all workspaces
```

Open the app, enter your AG-UI agent's URL in the config panel, and start chatting.

## What this is

Without this library, every AG-UI developer writes ~500 lines of non-trivial event-reduction logic from scratch: tracking in-flight tool calls, accumulating streamed text, handling parentMessageId mismatches, building confirmed message history for multi-turn conversations, etc.

`@agentui/react` absorbs that complexity. You get a single `AgentState` object and call `sendMessage`. See the [package README](./packages/agui-react/README.md) for the full API.
