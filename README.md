# @agilab/react

[![npm](https://img.shields.io/npm/v/@agilab/react)](https://www.npmjs.com/package/@agilab/react)
[![license](https://img.shields.io/npm/l/@agilab/react)](./LICENSE)

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

```bash
npm install @agilab/react
```

### Quick start

The two hooks give you everything you need. Here is the minimal pattern — replace the plain HTML with whatever component library you prefer:

```tsx
import { useAgentRun, useUIState } from '@agilab/react';
import type { RunItem } from '@agilab/react';

export function AgentChat() {
  const [uiState] = useUIState({});
  const { agentState, sendMessage, abort } = useAgentRun({
    config: { url: 'https://your-agent.example.com/run', headers: {} },
    uiState,
  });

  const isStreaming =
    agentState.status === 'streaming' || agentState.status === 'connecting';

  const allRuns = [
    ...agentState.runs,
    ...(agentState.currentRun ? [agentState.currentRun] : []),
  ];

  return (
    <div>
      {allRuns.map(run => (
        <div key={run.runId}>
          {run.userInput && <p><strong>You:</strong> {run.userInput}</p>}

          {run.items.map((item: RunItem) =>
            item.kind === 'text'
              ? <p key={item.messageId}>{item.content}{!item.isComplete && '▊'}</p>
              : <pre key={item.toolCallId}>{item.toolCallName}({item.argsAccumulated})</pre>
          )}
        </div>
      ))}

      {agentState.status === 'error' && <p>{agentState.error}</p>}

      <input onKeyDown={e => e.key === 'Enter' && sendMessage(e.currentTarget.value)} />
      {isStreaming && <button onClick={abort}>Stop</button>}
    </div>
  );
}
```

---

### Hooks

#### `useAgentRun(options)` → `{ agentState, sendMessage, abort }`

The main hook. Manages the SSE connection to your agent and reduces all incoming events into a single `agentState` object.

```tsx
import { useAgentRun } from '@agilab/react';

const { agentState, sendMessage, abort } = useAgentRun({
  config: {
    url: 'https://your-agent.example.com/run',
    headers: { Authorization: 'Bearer ...' },
  },
  uiState,    // sent to the agent as `state` on every run
  handlers: {
    // called when the agent emits a CUSTOM event named "navigate"
    navigate: (data) => router.push((data as { path: string }).path),
  },
});
```

**Options**

| Option | Type | Required | Description |
|---|---|---|---|
| `config.url` | `string` | Yes | Endpoint that accepts AG-UI runs |
| `config.headers` | `Record<string, string>` | Yes | HTTP headers (e.g. auth) |
| `uiState` | `TUIState` | Yes | Current UI state sent to the agent on every run |
| `handlers` | `HandlerRegistry` | No | Map of custom event names to handler functions |

**Returns**

| Value | Type | Description |
|---|---|---|
| `agentState` | `AgentState` | Full reactive state — see [State reference](#state) below |
| `sendMessage(text)` | `(text: string) => void` | Start a new run. Cancels any in-progress run first. |
| `abort()` | `() => void` | Stop the current run immediately |

#### `useUIState(initial)` → `[state, updaters]`

Manages the state your app sends to the agent so it can understand current UI context. Anything you want the agent to be aware of (current page, selected items, filters) goes here.

```tsx
import { useUIState } from '@agilab/react';

const [uiState, ui] = useUIState({ page: 'home', selectedIds: [] });

ui.update({ page: 'settings' });           // partial update — merges into current state
ui.set({ page: 'home', selectedIds: [] }); // full replace
ui.reset();                                // back to initial value
```

Pass `uiState` directly into `useAgentRun`. The agent receives it as `state` in every `RunAgentInput` payload.

---

### Custom event handlers

When your agent emits a `CUSTOM` event, the library routes it to the matching handler in `handlers` rather than putting it in state. This is the escape hatch for agent-driven side effects (navigation, toasts, UI mutations) that don't fit the message model.

```tsx
const { agentState, sendMessage } = useAgentRun({
  config,
  uiState,
  handlers: {
    navigate: (data) => {
      // data is the raw `value` field from the CUSTOM event
      router.push((data as { path: string }).path);
    },
    showToast: (data) => {
      toast((data as { message: string }).message);
    },
  },
});
```

The handler type is `(data: unknown) => void`. Cast `data` to the shape your agent sends.

---

### State

#### `agentState.runs` — completed turns

An array of `AgentRun` objects, one per completed agent turn. Each run holds everything that happened between `RUN_STARTED` and `RUN_FINISHED`:

```typescript
import type { AgentRun, RunItem, ReasoningState } from '@agilab/react';

interface AgentRun {
  runId: string;
  source: 'user' | 'agent'; // 'agent' when the agent initiates a run autonomously
  userInput?: string;        // the user's message (when source === 'user')
  items: RunItem[];          // text messages and tool calls in arrival order
  reasoning?: ReasoningState;
  isStreaming: boolean;
  status: 'streaming' | 'finished' | 'error';
  error?: string;            // set when status === 'error'
  timestamp: number;
}

interface ReasoningState {
  content: string;
  isComplete: boolean;       // false while the thinking block is still streaming
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

#### `agentState.error`

Set when `status === 'error'`. Contains the error message string from the agent or the network layer.

#### `agentState.threadId`

The conversation session ID shared across all runs. Automatically generated on first run and kept stable throughout the component's lifetime. Pass it to your own storage layer if you want to persist and resume conversations.

#### `agentState.currentStep`

Set while a `STEP_STARTED` event is active (e.g. a named agent step like `"search"` or `"plan"`). Cleared on `STEP_FINISHED`. Useful for status bars.

```tsx
{agentState.currentStep && (
  <span>Step: {agentState.currentStep.name}</span>
)}
```

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

#### Conversation history is managed automatically

The library maintains the full wire-format message history internally and sends it to the agent on every run. You don't need to build or track a messages array — just render from `agentState.runs`.

---

## Roadmap

| Version | Focus | What ships |
|---|---|---|
| **v0.2** | Foundation | `useMessages`, `useToolCalls`, `useSteps`, `useAgentStatus` — derived hooks so you stop writing boilerplate. `getToken` callback for auth. Reducer fixes: `STATE_SNAPSHOT`/`STATE_DELTA`, multiple reasoning blocks per run. |
| **v0.3** | Interactions | Frontend tool calls — agent calls browser-registered functions directly, no server needed. Human-in-the-loop approval pattern. Optimistic messages. Retry on error. |
| **v0.4** | Differentiation | Browser-compatible MCP tool servers. `useArtifacts` for named agent outputs. Multi-agent routing. |
| **v0.5** | Production | Pluggable thread persistence. Conversation list. File attachments. SSE reconnect. Server-issued `threadId`. |

---

## License

MIT
