# AG-UI Protocol Reference

AG-UI (Agent-User Interaction Protocol) is an open, lightweight, event-based protocol that standardises how AI agents connect to user-facing applications. It was created by the CopilotKit team and has been adopted by Google, LangChain, AWS, Microsoft, Mastra, and PydanticAI.

- Spec docs: https://docs.ag-ui.com
- GitHub org: https://github.com/ag-ui-protocol/ag-ui
- npm: `@ag-ui/core`, `@ag-ui/client`

---

## Core Concepts

| Concept | Description |
|---|---|
| **Run** | One end-to-end agent invocation. Starts with `RUN_STARTED`, ends with `RUN_FINISHED` or `RUN_ERROR`. |
| **Step** | Named sub-phase within a run (e.g. "planning", "executing"). |
| **Thread** | Persistent conversation session; carries `threadId` across multiple runs. |
| **Message** | Wire-format chat message: `{ role, content, id, name?, toolCalls?, toolCallId? }` |
| **Tool Call** | Agent invoking an external function. Args stream in; result is sent back by the UI. |
| **State** | Shared application state that can be synchronised between agent and UI via deltas. |
| **Custom Event** | Extension mechanism for non-standard events; routed by `name`. |

---

## Event Types

All events share a base shape:
```ts
{ type: EventType; timestamp?: number }
```

### Lifecycle

| Event | Payload extras | Notes |
|---|---|---|
| `RUN_STARTED` | `runId`, `threadId` | Always first event |
| `RUN_FINISHED` | `runId`, `threadId` | Always last event on success |
| `RUN_ERROR` | `message`, `code?` | Last event on failure |
| `STEP_STARTED` | `stepName` | Optional named phases |
| `STEP_FINISHED` | `stepName` | |

### Text Messages

Events stream one or more assistant text messages per run, token-by-token.

| Event | Payload extras |
|---|---|
| `TEXT_MESSAGE_START` | `messageId`, `role` |
| `TEXT_MESSAGE_CONTENT` | `messageId`, `delta` (token) |
| `TEXT_MESSAGE_CHUNK` | `messageId`, `delta` — alias used by some backends |
| `TEXT_MESSAGE_END` | `messageId` |

### Tool Calls

| Event | Payload extras |
|---|---|
| `TOOL_CALL_START` | `toolCallId`, `toolCallName`, `parentMessageId?` |
| `TOOL_CALL_ARGS` | `toolCallId`, `delta` (JSON fragment) |
| `TOOL_CALL_END` | `toolCallId` |
| `TOOL_CALL_RESULT` | `toolCallId`, `content`, `role: "tool"` |
| `TOOL_CALL_CHUNK` | `toolCallId`, `toolCallName?`, `delta?` — first chunk carries name (acts as START); subsequent chunks carry `delta` (acts as ARGS) |

Args are streamed as raw JSON fragments that accumulate into the full args object.

### Reasoning / Extended Thinking

| Event | Payload extras |
|---|---|
| `REASONING_START` | |
| `REASONING_MESSAGE_CONTENT` | `delta` |
| `REASONING_MESSAGE_CHUNK` | `delta` — alias |
| `REASONING_MESSAGE_END` | |
| `REASONING_END` | |
| `THINKING_START` | alias of REASONING_START |
| `THINKING_TEXT_MESSAGE_CONTENT` | alias of REASONING_MESSAGE_CONTENT |
| `THINKING_END` | alias of REASONING_END |

### State Synchronisation

| Event | Payload extras |
|---|---|
| `STATE_SNAPSHOT` | `state` (full state object) |
| `STATE_DELTA` | `delta` (JSON Patch array per RFC 6902) |
| `MESSAGES_SNAPSHOT` | `messages` (full Message[] array) |

### Special

| Event | Payload extras |
|---|---|
| `CUSTOM` | `name` (string), `value` (unknown) |
| `RAW` | `event` — wraps events from external systems |

---

## Wire Format (SSE)

Each event is sent as a newline-delimited JSON object over an SSE stream:

```
data: {"type":"RUN_STARTED","runId":"r_001","threadId":"t_abc","timestamp":1715000000000}

data: {"type":"TEXT_MESSAGE_START","messageId":"m_1","role":"assistant"}

data: {"type":"TEXT_MESSAGE_CONTENT","messageId":"m_1","delta":"Hello"}

data: {"type":"TEXT_MESSAGE_END","messageId":"m_1"}

data: {"type":"RUN_FINISHED","runId":"r_001","threadId":"t_abc"}
```

Transport is pluggable: SSE (most common), WebSocket, HTTP polling, or Webhooks.

---

## Sending a Run (`RunAgentInput`)

The client sends this JSON body to start a run:

```ts
interface RunAgentInput {
  threadId: string;       // Conversation session ID
  runId: string;          // Unique ID for this run
  messages: Message[];    // Full conversation history
  tools?: Tool[];         // Available tools
  context?: Context[];    // Additional context items
  state?: unknown;        // Shared UI state
  forwardedProps?: Record<string, unknown>;
}
```

---

## Message Wire Format

```ts
interface Message {
  id: string;
  role: "user" | "assistant" | "tool" | "system";
  content?: string;
  name?: string;
  toolCalls?: ToolCall[];    // present when role === "assistant"
  toolCallId?: string;       // present when role === "tool"
}

interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string }; // arguments = JSON string
}
```

---

## How This Library Uses the Protocol

`@agilab/react` wraps `@ag-ui/client`'s `HttpAgent` and exposes two hooks:

### `useAgentRun(options)`

```ts
const { agentState, sendMessage, abort } = useAgentRun({
  config: { url: string; headers: Record<string, string> },
  handlers?: HandlerRegistry,   // custom event name → handler fn
  tools?: Tool[],
  context?: Context[],
})
```

Internally calls `agent.run()` → RxJS Observable → dispatches each event into `agentRunReducer`.

### `useUIState<T>(initial)`

```ts
const [state, { update, set, reset }] = useUIState<T>(initial)
```

Simple shared-state hook. Not protocol-specific; used for UI-side state.

### `AgentState` shape

```ts
interface AgentState {
  status: "idle" | "connecting" | "streaming" | "finished" | "error";
  runs: AgentRun[];          // completed runs
  currentRun?: AgentRun;     // live streaming run
  currentStep?: { id: string; name: string };
  threadId: string;
  error?: string;
}
```

### `RunItem` and `AgentRun` shape

Text messages and tool calls are stored together in a single `items` array, in the order they arrived from the stream. Each item is a discriminated union:

```ts
type RunItem =
  | { kind: "text"; messageId: string; content: string; isComplete: boolean }
  | { kind: "tool"; toolCallId: string; toolCallName: string; argsAccumulated: string; argsComplete: boolean; result?: string; resultMessageId?: string; status: "streaming" | "done" | "has-result" | "error" }

interface AgentRun {
  runId: string;
  source: "user" | "agent";
  userInput?: string;
  items: RunItem[];           // text + tool calls interleaved in arrival order
  reasoning?: { content: string; isComplete: boolean };
  isStreaming: boolean;
  status: "streaming" | "finished" | "error";
  error?: string;
  timestamp: number;
}
```

Rendering in arrival order is a direct `.map()` over `items`:

```tsx
run.items.map(item =>
  item.kind === "tool"
    ? <ToolCallCard key={item.toolCallId} tc={item} />
    : <div key={item.messageId}>{item.content}</div>
)
```

---

## Key Files in This Repo

| File | Role |
|---|---|
| `src/hooks/useAgentRun.ts` | SSE connection + run lifecycle |
| `src/hooks/agentRunReducer.ts` | All 30+ event handlers → state |
| `src/hooks/useUIState.ts` | Shared UI state hook |
| `src/types/index.ts` | All exported TypeScript types |
| `examples/with-chatscope/src/App.tsx` | Full demo implementation |
