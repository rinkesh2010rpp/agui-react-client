# AgentUI

A monorepo containing `@agentui/react` — a headless React library that converts raw [AG-UI](https://github.com/ag-ui-protocol/ag-ui) SSE events into streaming-aware React state — plus a demo chat application built on top of it.

## Packages

| Package | Description |
|---|---|
| [`src/`](./src) | Headless library source — the publishable package |
| [`examples/with-chatscope`](./examples/with-chatscope) | Demo chat UI using [@chatscope/chat-ui-kit-react](https://chatscope.io/) |

## Getting started

```bash
npm install
npm run dev        # starts demo app on http://localhost:5173
npm run typecheck  # type-check all workspaces
```

Open the app, enter your AG-UI agent's URL in the config panel, and start chatting.

---

## Using `@agentui/react` in your app

Install the package:

```bash
npm install @agentui/react
```

### Hooks

#### `useAgentRun(options)` → `{ agentState, sendMessage, abort }`

The main hook. Manages the SSE connection to your agent and reduces all incoming events into a single `agentState` object.

```tsx
import { useAgentRun, useUIState } from '@agentui/react';

const [uiState, ui] = useUIState({ page: 'home' });

const { agentState, sendMessage, abort } = useAgentRun({
  config: {
    url: 'https://your-agent.example.com/run',
    headers: { Authorization: 'Bearer ...' },
  },
  uiState,   // sent to the agent as `state` on every run
  handlers: {
    // called when the agent emits a CUSTOM event
    navigate: (data) => router.push(data.path),
  },
});
```

Calling `sendMessage` while a run is active cancels it first. Calling `abort` mid-stream stops the current run cleanly.

#### `useUIState(initial)` → `[state, updaters]`

Manages the state your app sends to the agent. The agent can read it to understand current UI context.

```tsx
const [uiState, ui] = useUIState({ page: 'home', selectedIds: [] });

ui.update({ page: 'settings' });          // partial update
ui.set({ page: 'home', selectedIds: [] }); // full replace
ui.reset();                                // back to initial value
```

---

### State

#### `agentState.runs` — completed turns

An array of `AgentRun` objects, one per completed agent turn. Each run holds everything that happened between `RUN_STARTED` and `RUN_FINISHED`:

```typescript
interface AgentRun {
  runId: string;
  source: 'user' | 'agent';   // who initiated the run
  userInput?: string;          // the user's message (when source === 'user')
  response: string;            // the agent's text response, fully accumulated
  toolCalls: ToolCallState[];  // all tool calls in this run, in arrival order
  reasoning?: ReasoningState;  // extended thinking block, if emitted
  isStreaming: boolean;
  status: 'streaming' | 'finished' | 'error';
  timestamp: number;
}
```

#### `agentState.currentRun` — the live run

Same shape as `AgentRun`, but updated in real time while streaming. `undefined` when idle.

```tsx
// Combine completed + in-progress for rendering
const allRuns = [...agentState.runs, ...(agentState.currentRun ? [agentState.currentRun] : [])];

allRuns.map(run => (
  <div key={run.runId}>
    {run.userInput && <Bubble direction="out">{run.userInput}</Bubble>}
    <Bubble direction="in">
      {run.toolCalls.map(tc => <ToolCallCard key={tc.toolCallId} tc={tc} />)}
      {run.response}
    </Bubble>
  </div>
))
```

#### `agentState.status`

```
'idle'       — no active run
'connecting' — request sent, waiting for first event
'streaming'  — events arriving
'finished'   — RUN_FINISHED received
'error'      — stream error or RUN_ERROR event
```

#### `agentState.currentStep`

Set while a `STEP_STARTED` event is active (e.g. a named agent step like `"search"` or `"plan"`). Cleared on `STEP_FINISHED`. Useful for status bars.

---

### Tool call state

Each `ToolCallState` in `run.toolCalls` streams in real time:

```typescript
interface ToolCallState {
  toolCallId: string;
  toolCallName: string;
  argsAccumulated: string; // raw JSON, grows with each TOOL_CALL_ARGS delta
  argsComplete: boolean;   // true after TOOL_CALL_END
  result?: string;         // set on TOOL_CALL_RESULT
  status: 'streaming' | 'done' | 'has-result' | 'error';
}
```

```tsx
function ToolCallCard({ tc }: { tc: ToolCallState }) {
  return (
    <div>
      <strong>{tc.toolCallName}</strong>
      <pre>{tc.argsComplete ? JSON.stringify(JSON.parse(tc.argsAccumulated), null, 2) : tc.argsAccumulated}</pre>
      {tc.result && <pre>Result: {tc.result}</pre>}
    </div>
  );
}
```

---

See the full API reference and data-flow diagram in this README below.
