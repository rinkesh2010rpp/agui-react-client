import {
  EventType,
  type AGUIEvent,
  type Message,
  type TextMessageStartEvent,
  type TextMessageContentEvent,
  type TextMessageChunkEvent,
  type TextMessageEndEvent,
  type ToolCallStartEvent,
  type ToolCallArgsEvent,
  type ToolCallEndEvent,
  type ToolCallResultEvent,
  type ToolCallChunkEvent,
  type RunStartedEvent,
  type RunErrorEvent,
  type StepStartedEvent,
  type MessagesSnapshotEvent,
  type ReasoningMessageContentEvent,
  type ReasoningMessageEndEvent,
  type CustomEvent,
} from "@ag-ui/core";
import type { RunState, AgentRun, RunItem, ToolCallState, TextMessageState, ReasoningState } from "../types";

export type ReducerAction =
  | { type: "RUN_INIT"; userInput: string; userMessageId: string }
  | { type: "AGUI_EVENT"; event: AGUIEvent }
  | { type: "STREAM_ERROR"; error: unknown }
  | { type: "ABORTED" }
  | { type: "CUSTOM_EVENT"; event: CustomEvent };

export function initialRunState(): RunState {
  return {
    agentState: {
      status: "idle",
      runs: [],
      threadId: "",
    },
    threadId: "",
    runId: "",
    itemsById: new Map(),
    currentTextMessageId: null,
    confirmedMessages: [],
  };
}

export function agentRunReducer(state: RunState, action: ReducerAction): RunState {
  switch (action.type) {
    case "RUN_INIT":
      return handleRunInit(state, action.userInput, action.userMessageId);
    case "AGUI_EVENT":
      return handleAGUIEvent(state, action.event);
    case "STREAM_ERROR":
      return handleStreamError(state, action.error);
    case "ABORTED":
      return {
        ...state,
        agentState: {
          ...state.agentState,
          status: "idle",
          currentRun: undefined,
        },
      };
    default:
      return state;
  }
}

// ─── Init ────────────────────────────────────────────────────────────────────

function handleRunInit(state: RunState, userInput: string, userMessageId: string): RunState {
  const pendingRun: AgentRun = {
    runId: "",
    source: "user",
    userInput,
    items: [],
    isStreaming: true,
    status: "streaming",
    timestamp: Date.now(),
  };

  const userCoreMessage: Message = {
    id: userMessageId,
    role: "user",
    content: userInput,
  };

  return {
    ...state,
    agentState: {
      ...state.agentState,
      status: "connecting",
      currentRun: pendingRun,
      currentStep: undefined,
      error: undefined,
    },
    itemsById: new Map(),
    currentTextMessageId: null,
    confirmedMessages: [...state.confirmedMessages, userCoreMessage],
  };
}

// ─── Event dispatcher ────────────────────────────────────────────────────────

function handleAGUIEvent(state: RunState, event: AGUIEvent): RunState {
  switch (event.type) {
    case EventType.RUN_STARTED:
      return handleRunStarted(state, event as RunStartedEvent);
    case EventType.RUN_FINISHED:
      return handleRunFinished(state);
    case EventType.RUN_ERROR:
      return handleRunError(state, event as RunErrorEvent);
    case EventType.STEP_STARTED:
      return handleStepStarted(state, event as StepStartedEvent);
    case EventType.STEP_FINISHED:
      return {
        ...state,
        agentState: { ...state.agentState, currentStep: undefined },
      };
    case EventType.TEXT_MESSAGE_START:
      return handleTextStart(state, event as TextMessageStartEvent);
    case EventType.TEXT_MESSAGE_CONTENT:
      return handleTextContent(state, event as TextMessageContentEvent);
    case EventType.TEXT_MESSAGE_CHUNK:
      return handleTextChunk(state, event as TextMessageChunkEvent);
    case EventType.TEXT_MESSAGE_END:
      return handleTextEnd(state, event as TextMessageEndEvent);
    case EventType.TOOL_CALL_CHUNK:
      return handleToolCallChunk(state, event as ToolCallChunkEvent);
    case EventType.TOOL_CALL_START:
      return handleToolCallStart(state, event as ToolCallStartEvent);
    case EventType.TOOL_CALL_ARGS:
      return handleToolCallArgs(state, event as ToolCallArgsEvent);
    case EventType.TOOL_CALL_END:
      return handleToolCallEnd(state, event as ToolCallEndEvent);
    case EventType.TOOL_CALL_RESULT:
      return handleToolCallResult(state, event as ToolCallResultEvent);
    case EventType.REASONING_START:
    case EventType.THINKING_START:
      return state;
    case EventType.REASONING_MESSAGE_START:
    case EventType.THINKING_TEXT_MESSAGE_START:
      return handleReasoningStart(state);
    case EventType.REASONING_MESSAGE_CONTENT:
    case EventType.REASONING_MESSAGE_CHUNK:
    case EventType.THINKING_TEXT_MESSAGE_CONTENT:
      return handleReasoningContent(state, event as ReasoningMessageContentEvent);
    case EventType.REASONING_MESSAGE_END:
    case EventType.THINKING_TEXT_MESSAGE_END:
      return handleReasoningEnd(state, event as ReasoningMessageEndEvent);
    case EventType.THINKING_END:
    case EventType.REASONING_END:
      return state;
    case EventType.MESSAGES_SNAPSHOT:
      return handleMessagesSnapshot(state, event as MessagesSnapshotEvent);
    case EventType.CUSTOM:
      return state; // handled outside reducer via handler registry
    default:
      return state;
  }
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

function handleRunStarted(state: RunState, event: RunStartedEvent): RunState {
  const threadId = event.threadId || state.threadId;
  const run = state.agentState.currentRun;
  return {
    ...state,
    runId: event.runId,
    threadId,
    agentState: {
      ...state.agentState,
      status: "streaming",
      threadId,
      currentRun: run ? { ...run, runId: event.runId } : undefined,
    },
  };
}

function handleRunFinished(state: RunState): RunState {
  const run = state.agentState.currentRun;
  if (!run) {
    return {
      ...state,
      agentState: { ...state.agentState, status: "finished", currentStep: undefined },
    };
  }

  const finishedRun: AgentRun = {
    ...run,
    isStreaming: false,
    status: "finished",
  };

  const newConfirmed = buildConfirmedMessages(state, finishedRun);

  return {
    ...state,
    agentState: {
      ...state.agentState,
      status: "finished",
      runs: [...state.agentState.runs, finishedRun],
      currentRun: undefined,
      currentStep: undefined,
    },
    confirmedMessages: newConfirmed,
    itemsById: new Map(),
    currentTextMessageId: null,
  };
}

function handleRunError(state: RunState, event: RunErrorEvent): RunState {
  const run = state.agentState.currentRun;
  return {
    ...state,
    agentState: {
      ...state.agentState,
      status: "error",
      error: event.message,
      currentRun: run
        ? { ...run, isStreaming: false, status: "error", error: event.message }
        : undefined,
    },
  };
}

function handleStepStarted(state: RunState, event: StepStartedEvent): RunState {
  return {
    ...state,
    agentState: {
      ...state.agentState,
      currentStep: { id: event.stepName, name: event.stepName },
    },
  };
}

// ─── Text response ───────────────────────────────────────────────────────────

function handleTextStart(state: RunState, event: TextMessageStartEvent): RunState {
  const item: RunItem = { kind: "text", messageId: event.messageId, content: "", isComplete: false };
  const newMap = new Map(state.itemsById);
  newMap.set(event.messageId, item);
  return {
    ...patchCurrentRun(state, (run) => ({ ...run, items: [...run.items, item] })),
    itemsById: newMap,
    currentTextMessageId: event.messageId,
  };
}

function handleTextContent(state: RunState, event: TextMessageContentEvent): RunState {
  const existing = state.itemsById.get(event.messageId);
  if (!existing || existing.kind !== "text") {
    console.warn("[agui-react] TEXT_MESSAGE_CONTENT for unknown messageId", event.messageId);
    return state;
  }
  return updateItem(state, { ...existing, content: existing.content + event.delta });
}

function handleTextChunk(state: RunState, event: TextMessageChunkEvent): RunState {
  if (!event.delta) return state;
  const id = event.messageId ?? state.currentTextMessageId;

  if (id) {
    const existing = state.itemsById.get(id);
    if (existing && existing.kind === "text") {
      return updateItem(state, { ...existing, content: existing.content + event.delta });
    }
    // First chunk with a new messageId — auto-create
    const item: RunItem = { kind: "text", messageId: id, content: event.delta, isComplete: false };
    const newMap = new Map(state.itemsById);
    newMap.set(id, item);
    return {
      ...patchCurrentRun(state, (run) => ({ ...run, items: [...run.items, item] })),
      itemsById: newMap,
      currentTextMessageId: id,
    };
  }

  // No id — append to last text item or create anonymous
  const lastTextId = [...state.itemsById.entries()]
    .filter(([, v]) => v.kind === "text")
    .map(([k]) => k)
    .pop();
  const targetId = lastTextId ?? `anon-${Date.now()}`;
  const existing = state.itemsById.get(targetId);
  if (existing && existing.kind === "text") {
    return updateItem(state, { ...existing, content: existing.content + event.delta });
  }
  const item: RunItem = { kind: "text", messageId: targetId, content: event.delta, isComplete: false };
  const newMap = new Map(state.itemsById);
  newMap.set(targetId, item);
  return {
    ...patchCurrentRun(state, (run) => ({ ...run, items: [...run.items, item] })),
    itemsById: newMap,
    currentTextMessageId: targetId,
  };
}

function handleTextEnd(state: RunState, event: TextMessageEndEvent): RunState {
  const id = event.messageId ?? state.currentTextMessageId;
  if (!id) return state;
  const existing = state.itemsById.get(id);
  if (!existing || existing.kind !== "text") return state;
  const next = updateItem(state, { ...existing, isComplete: true });
  return next.currentTextMessageId === id ? { ...next, currentTextMessageId: null } : next;
}

// ─── Tool calls ──────────────────────────────────────────────────────────────

function handleToolCallStart(state: RunState, event: ToolCallStartEvent): RunState {
  const item: RunItem = {
    kind: "tool",
    toolCallId: event.toolCallId,
    toolCallName: event.toolCallName,
    argsAccumulated: "",
    argsComplete: false,
    status: "streaming",
  };
  const newMap = new Map(state.itemsById);
  newMap.set(event.toolCallId, item);
  return {
    ...patchCurrentRun(state, (run) => ({ ...run, items: [...run.items, item] })),
    itemsById: newMap,
  };
}

function handleToolCallArgs(state: RunState, event: ToolCallArgsEvent): RunState {
  const existing = state.itemsById.get(event.toolCallId);
  if (!existing || existing.kind !== "tool") {
    console.warn("[agui-react] TOOL_CALL_ARGS for unknown toolCallId", event.toolCallId);
    return state;
  }
  return updateItem(state, { ...existing, argsAccumulated: existing.argsAccumulated + event.delta });
}

function handleToolCallEnd(state: RunState, event: ToolCallEndEvent): RunState {
  const existing = state.itemsById.get(event.toolCallId);
  if (!existing || existing.kind !== "tool") return state;
  return updateItem(state, { ...existing, argsComplete: true, status: "done" });
}

function handleToolCallResult(state: RunState, event: ToolCallResultEvent): RunState {
  const existing = state.itemsById.get(event.toolCallId);
  if (!existing || existing.kind !== "tool") return state;
  return updateItem(state, {
    ...existing,
    result: event.content,
    resultMessageId: event.messageId,
    status: "has-result",
  });
}

function handleToolCallChunk(state: RunState, event: ToolCallChunkEvent): RunState {
  // First chunk — carries toolCallId + toolCallName, acts like TOOL_CALL_START
  if (event.toolCallName && !state.itemsById.has(event.toolCallId ?? "")) {
    if (!event.toolCallId) {
      console.warn("[agui-react] TOOL_CALL_CHUNK first chunk missing toolCallId");
      return state;
    }
    const item: RunItem = {
      kind: "tool",
      toolCallId: event.toolCallId,
      toolCallName: event.toolCallName,
      argsAccumulated: event.delta ?? "",
      argsComplete: false,
      status: "streaming",
    };
    const newMap = new Map(state.itemsById);
    newMap.set(event.toolCallId, item);
    return {
      ...patchCurrentRun(state, (run) => ({ ...run, items: [...run.items, item] })),
      itemsById: newMap,
    };
  }

  // Subsequent chunks — append delta, acts like TOOL_CALL_ARGS
  if (!event.delta) return state;
  const toolKeys = [...state.itemsById.entries()]
    .filter(([, v]) => v.kind === "tool")
    .map(([k]) => k);
  const targetId = event.toolCallId ?? toolKeys[toolKeys.length - 1];
  if (!targetId) {
    console.warn("[agui-react] TOOL_CALL_CHUNK delta with no resolvable toolCallId");
    return state;
  }
  const existing = state.itemsById.get(targetId);
  if (!existing || existing.kind !== "tool") {
    console.warn("[agui-react] TOOL_CALL_CHUNK delta for unknown toolCallId", targetId);
    return state;
  }
  return updateItem(state, { ...existing, argsAccumulated: existing.argsAccumulated + event.delta });
}

// ─── Reasoning ───────────────────────────────────────────────────────────────

function handleReasoningStart(state: RunState): RunState {
  const reasoning: ReasoningState = { content: "", isComplete: false };
  return patchCurrentRun(state, (run) => ({ ...run, reasoning }));
}

function handleReasoningContent(
  state: RunState,
  event: ReasoningMessageContentEvent
): RunState {
  return patchCurrentRun(state, (run) => ({
    ...run,
    reasoning: run.reasoning
      ? { ...run.reasoning, content: run.reasoning.content + (event.delta ?? "") }
      : { content: event.delta ?? "", isComplete: false },
  }));
}

function handleReasoningEnd(
  state: RunState,
  _event: ReasoningMessageEndEvent
): RunState {
  return patchCurrentRun(state, (run) => ({
    ...run,
    reasoning: run.reasoning ? { ...run.reasoning, isComplete: true } : undefined,
  }));
}

// ─── Messages snapshot ───────────────────────────────────────────────────────

function handleMessagesSnapshot(state: RunState, event: MessagesSnapshotEvent): RunState {
  return {
    ...state,
    confirmedMessages: event.messages as Message[],
  };
}

// ─── Error ───────────────────────────────────────────────────────────────────

function handleStreamError(state: RunState, error: unknown): RunState {
  const message = error instanceof Error ? error.message : "Unknown streaming error";
  return {
    ...state,
    agentState: { ...state.agentState, status: "error", error: message },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function patchCurrentRun(
  state: RunState,
  patch: (run: AgentRun) => AgentRun
): RunState {
  const run = state.agentState.currentRun;
  if (!run) return state;
  return {
    ...state,
    agentState: { ...state.agentState, currentRun: patch(run) },
  };
}

function updateItem(state: RunState, updated: RunItem): RunState {
  const id = updated.kind === "text" ? updated.messageId : updated.toolCallId;
  const newMap = new Map(state.itemsById);
  newMap.set(id, updated);
  return {
    ...patchCurrentRun(state, (run) => ({
      ...run,
      items: run.items.map((item) => {
        const itemId = item.kind === "text" ? item.messageId : item.toolCallId;
        return itemId === id ? updated : item;
      }),
    })),
    itemsById: newMap,
  };
}

function buildConfirmedMessages(state: RunState, run: AgentRun): Message[] {
  const additions: Message[] = [];
  const textItems = run.items.filter((i): i is RunItem & { kind: "text" } => i.kind === "text");
  const toolItems = run.items.filter((i): i is RunItem & { kind: "tool" } => i.kind === "tool");

  if (textItems.length > 0) {
    // One assistant message per text message; tool calls attach to the last one
    textItems.forEach((tm, i) => {
      const isLast = i === textItems.length - 1;
      additions.push({
        id: tm.messageId,
        role: "assistant",
        content: tm.content,
        ...(isLast && toolItems.length > 0
          ? {
              toolCalls: toolItems.map((tc) => ({
                id: tc.toolCallId,
                type: "function" as const,
                function: { name: tc.toolCallName, arguments: tc.argsAccumulated },
              })),
            }
          : {}),
      });
    });
  } else if (toolItems.length > 0) {
    // No text — standalone assistant message carrying only tool calls
    additions.push({
      id: run.runId || `run-${Date.now()}`,
      role: "assistant",
      toolCalls: toolItems.map((tc) => ({
        id: tc.toolCallId,
        type: "function" as const,
        function: { name: tc.toolCallName, arguments: tc.argsAccumulated },
      })),
    });
  }

  // Tool result messages in tool call order
  for (const tc of toolItems) {
    if (tc.result !== undefined) {
      additions.push({
        id: tc.resultMessageId ?? `result-${tc.toolCallId}`,
        role: "tool",
        toolCallId: tc.toolCallId,
        content: tc.result,
      });
    }
  }

  return [...state.confirmedMessages, ...additions];
}
