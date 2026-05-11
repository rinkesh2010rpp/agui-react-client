# @agentui/react

A headless React library that converts raw [AG-UI](https://github.com/ag-ui-protocol/ag-ui) protocol events into streaming-aware, typed React state.

You bring your own UI. The library handles the protocol.

## The problem it solves

AG-UI agents communicate over SSE, emitting 30+ event types: `TEXT_MESSAGE_START`, `TOOL_CALL_ARGS` deltas, `REASONING_MESSAGE_CONTENT`, `RUN_FINISHED`, and so on. Turning that stream into something renderable requires:

- Accumulating streamed text deltas into a coherent response
- Tracking in-flight tool calls with O(1) lookup
- Attaching tool results back to the right call
- Building a valid wire-format message history for multi-turn conversations
- Handling framework-specific quirks (e.g. LangChain's internal run IDs as `parentMessageId`)

This library does all of that. Your component receives `agentState` and renders it.

## Installation

```bash
npm install @agentui/react
```

Peer dependency: `react >= 18`

## Quick start

```tsx
import { useAgentRun, useUIState } from '@agentui/react';

function Chat() {
  const [uiState] = useUIState({ page: 'home' });

  const { agentState, sendMessage, abort } = useAgentRun({
    config: { url: 'https://your-agent.example.com/run', headers: {} },
    uiState,
    handlers: {
      navigate: (data) => router.push(data.path),
    },
  });

  return (
    <>
      {agentState.runs.map(run => (
        <div key={run.runId}>
          {run.userInput && <p className="outgoing">{run.userInput}</p>}
          <p className="incoming">{run.response}</p>
          {run.toolCalls.map(tc => (
            <ToolCallView key={tc.toolCallId} tc={tc} />
          ))}
        </div>
      ))}

      {agentState.currentRun && (
        <div>
          <p>{agentState.currentRun.response}</p>
          <button onClick={abort}>Stop</button>
        </div>
      )}

      <input onKeyDown={e => e.key === 'Enter' && sendMessage(e.currentTarget.value)} />
    </>
  );
}
```

## Core concepts

### AgentRun

The primary UI unit. Everything that happens between `RUN_STARTED` and `RUN_FINISHED` belongs to one `AgentRun`:

```typescript
interface AgentRun {
  runId: string;
  source: 'user' | 'agent';   // who triggered this run
  userInput?: string;          // set when source === 'user'
  toolCalls: ToolCallState[];  // all tool calls, in arrival order
  reasoning?: ReasoningState;  // extended thinking, if the model emits it
  response: string;            // accumulated text response
  isStreaming: boolean;        // true while events are still arriving
  status: 'streaming' | 'finished' | 'error';
  error?: string;
  timestamp: number;
}
```

### AgentState

The object returned by `useAgentRun`:

```typescript
interface AgentState {
  status: 'idle' | 'connecting' | 'streaming' | 'finished' | 'error';
  runs: AgentRun[];            // completed runs
  currentRun?: AgentRun;       // in-progress run (undefined when idle)
  currentStep?: { id: string; name: string };  // last STEP_STARTED, if any
  threadId: string;
  error?: string;
}
```

### UIState

Your app's state, sent to the agent on every run as the `state` field. The library never reads the contents — it just carries it.

```typescript
// You define the shape. Fully typed via the generic parameter.
const [uiState, ui] = useUIState({ page: 'home', selectedIds: [] as string[] });

ui.update({ page: 'settings' });   // partial update
ui.set({ page: 'home', selectedIds: [] });
ui.reset();                        // back to initial
```

### Handler registry

A map from CUSTOM event names to functions on your UI. The agent can invoke these to trigger navigation, toasts, state updates, etc.

```typescript
const handlers = {
  navigate: (data) => router.push(data.path),
  showToast: (data) => toast(data.message),
};

const { agentState } = useAgentRun({ config, uiState, handlers });
```

## API reference

### `useAgentRun(options)`

```typescript
function useAgentRun<TUIState = Record<string, unknown>>(options: {
  config: AgentConfig;      // { url: string; headers: Record<string, string> }
  uiState: TUIState;        // snapshot sent as `state` on every run
  handlers?: HandlerRegistry;
}): {
  agentState: AgentState;
  sendMessage: (text: string) => void;
  abort: () => void;
}
```

Calling `sendMessage` while a run is in progress cancels the previous run before starting the new one.

### `useUIState(initial)`

```typescript
function useUIState<T>(initial: T): [T, UIStateUpdaters<T>]

interface UIStateUpdaters<T> {
  update: (partial: Partial<T>) => void;
  set: (state: T) => void;
  reset: () => void;
}
```

### Types

```typescript
interface ToolCallState {
  toolCallId: string;
  toolCallName: string;
  argsAccumulated: string;   // raw JSON, grows via TOOL_CALL_ARGS deltas
  argsComplete: boolean;     // true after TOOL_CALL_END
  result?: string;           // populated by TOOL_CALL_RESULT
  status: 'streaming' | 'done' | 'has-result' | 'error';
}

interface ReasoningState {
  content: string;
  isComplete: boolean;
}
```

## Data flow

```
sendMessage(text)
  → dispatch RUN_INIT (adds user message to history, creates pending run)
  → HttpAgent.run({ messages: history, state: uiState })
  → SSE stream opens

SSE events → agentRunReducer → AgentState
  TEXT_MESSAGE_CONTENT   → currentRun.response grows
  TOOL_CALL_START/ARGS   → currentRun.toolCalls[n].argsAccumulated grows
  TOOL_CALL_RESULT       → currentRun.toolCalls[n].result set
  REASONING_*            → currentRun.reasoning.content grows
  STEP_STARTED           → agentState.currentStep updates
  RUN_FINISHED           → currentRun moves to runs[], confirmedMessages updated
  CUSTOM                 → handlers[event.name](event.value) called

agentState → your render
  agentState.runs           → completed turns
  agentState.currentRun     → live streaming turn
  agentState.status         → idle / connecting / streaming / finished / error
```

## Multi-turn conversations

Confirmed message history is maintained automatically. Each completed run contributes an assistant message (with tool calls) followed by tool result messages. The next `sendMessage` call sends the full history to the agent.

## License

MIT
