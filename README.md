# @agentui/react

A headless React library that converts raw [AG-UI](https://github.com/ag-ui-protocol/ag-ui) SSE events into streaming-aware React state. You bring your own UI — the library handles the protocol.

## Repo structure

| Path | Description |
|---|---|
| [`src/`](./src) | Library source — hooks, types, reducer |
| [`examples/with-chatscope`](./examples/with-chatscope) | Demo chat UI using [@chatscope/chat-ui-kit-react](https://chatscope.io/) |

## Run the demo locally

```bash
npm install
npm run dev        # starts demo app on http://localhost:5173
npm run typecheck  # type-check library + example
```

Open the app, enter your AG-UI agent's URL in the config panel, and start chatting.

---

## Using the library

### Installation

> **Note:** The package is not yet published to npm. To use it today, clone this repo and reference it via a local path or npm workspace.

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

Manages the state your app sends to the agent so it can understand current UI context.

```tsx
const [uiState, ui] = useUIState({ page: 'home', selectedIds: [] });

ui.update({ page: 'settings' });           // partial update
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
  items: RunItem[];            // text messages and tool calls in arrival order
  reasoning?: ReasoningState;  // extended thinking block, if emitted
  isStreaming: boolean;
  status: 'streaming' | 'finished' | 'error';
  timestamp: number;
}

// Each item is either a streamed text message or a tool call, in arrival order
type RunItem =
  | {
      kind: 'text';
      messageId: string;
      content: string;
      isComplete: boolean;  // false while tokens are still arriving; true after TEXT_MESSAGE_END
    }
  | {
      kind: 'tool';
      toolCallId: string;
      toolCallName: string;
      argsAccumulated: string;  // raw JSON, grows with each TOOL_CALL_ARGS delta
      argsComplete: boolean;    // true after TOOL_CALL_END
      result?: string;          // set on TOOL_CALL_RESULT
      status: 'streaming' | 'done' | 'has-result' | 'error';
    }
```

#### `agentState.currentRun` — the live run

Same shape as `AgentRun`, updated in real time while streaming. `undefined` when idle.

```tsx
// Combine completed + in-progress for rendering
const allRuns = [...agentState.runs, ...(agentState.currentRun ? [agentState.currentRun] : [])];

allRuns.map(run => (
  <div key={run.runId}>
    {run.userInput && <Bubble direction="out">{run.userInput}</Bubble>}
    <Bubble direction="in">
      {/* reasoning block appears before items if the agent emitted extended thinking */}
      {run.reasoning && <ReasoningBlock reasoning={run.reasoning} />}

      {/* items render in the exact order they arrived from the stream */}
      {run.items.map(item =>
        item.kind === 'tool'
          ? <ToolCallCard key={item.toolCallId} tc={item} />
          : (
            <span key={item.messageId}>
              {item.content}
              {/* streaming cursor — visible while this message is still being typed */}
              {!item.isComplete && <span className="animate-pulse">▊</span>}
            </span>
          )
      )}
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

### Tool call items

Tool call items in `run.items` stream in real time:

```typescript
// item.kind === 'tool'
{
  kind: 'tool';
  toolCallId: string;
  toolCallName: string;
  argsAccumulated: string; // raw JSON, grows with each TOOL_CALL_ARGS delta
  argsComplete: boolean;   // true after TOOL_CALL_END
  result?: string;         // set on TOOL_CALL_RESULT
  status: 'streaming' | 'done' | 'has-result' | 'error';
}
```

```tsx
function ToolCallCard({ tc }: { tc: RunItem & { kind: 'tool' } }) {
  return (
    <div>
      <strong>{tc.toolCallName}</strong>
      <pre>
        {tc.argsComplete
          ? JSON.stringify(JSON.parse(tc.argsAccumulated), null, 2)
          : tc.argsAccumulated}
      </pre>
      {tc.result && <pre>Result: {tc.result}</pre>}
    </div>
  );
}
```

---

### Common patterns

#### Detecting streaming / disabling input

```tsx
const isStreaming =
  agentState.status === 'streaming' || agentState.status === 'connecting';

// Disable send while streaming; show a stop button
<button onClick={abort} disabled={!isStreaming}>Stop</button>
<input disabled={isStreaming} onSubmit={sendMessage} />
```

#### Showing a typing indicator

```tsx
{isStreaming && <TypingIndicator />}
```

#### Handling errors

```tsx
{agentState.status === 'error' && (
  <div className="error">{agentState.error ?? 'Unknown error'}</div>
)}
```

#### Re-sending cancels the active run

`sendMessage` automatically aborts any in-progress run before starting a new one. You don't need to call `abort` first.

---

## License

MIT
