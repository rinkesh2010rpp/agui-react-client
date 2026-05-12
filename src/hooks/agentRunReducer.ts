import {
  EventType,
  type AGUIEvent,
  type Message,
  type TextMessageContentEvent,
  type TextMessageChunkEvent,
  type TextMessageEndEvent,
  type ToolCallStartEvent,
  type ToolCallArgsEvent,
  type ToolCallEndEvent,
  type ToolCallResultEvent,
  type RunStartedEvent,
  type RunErrorEvent,
  type StepStartedEvent,
  type MessagesSnapshotEvent,
  type ReasoningMessageContentEvent,
  type ReasoningMessageEndEvent,
  type CustomEvent,
} from "@ag-ui/core";
import type { RunState, AgentRun, ToolCallState, ReasoningState } from "../types";

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
    toolCallsById: new Map(),
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
    toolCalls: [],
    response: "",
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
    toolCallsById: new Map(),
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
      return state;
    case EventType.TEXT_MESSAGE_CONTENT:
      return handleTextContent(state, event as TextMessageContentEvent);
    case EventType.TEXT_MESSAGE_CHUNK:
      return handleTextChunk(state, event as TextMessageChunkEvent);
    case EventType.TEXT_MESSAGE_END:
      return handleTextEnd(state, event as TextMessageEndEvent);
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
    toolCallsById: new Map(),
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

function handleTextContent(state: RunState, event: TextMessageContentEvent): RunState {
  return patchCurrentRun(state, (run) => ({
    ...run,
    response: run.response + event.delta,
  }));
}

function handleTextChunk(state: RunState, event: TextMessageChunkEvent): RunState {
  if (!event.delta) return state;
  return patchCurrentRun(state, (run) => ({
    ...run,
    response: run.response + event.delta,
  }));
}

function handleTextEnd(state: RunState, _event: TextMessageEndEvent): RunState {
  return state;
}

// ─── Tool calls ──────────────────────────────────────────────────────────────

function handleToolCallStart(state: RunState, event: ToolCallStartEvent): RunState {
  const tc: ToolCallState = {
    toolCallId: event.toolCallId,
    toolCallName: event.toolCallName,
    argsAccumulated: "",
    argsComplete: false,
    status: "streaming",
  };

  const newToolCallsById = new Map(state.toolCallsById);
  newToolCallsById.set(tc.toolCallId, tc);

  return {
    ...patchCurrentRun(state, (run) => ({
      ...run,
      toolCalls: [...run.toolCalls, tc],
    })),
    toolCallsById: newToolCallsById,
  };
}

function handleToolCallArgs(state: RunState, event: ToolCallArgsEvent): RunState {
  const existing = state.toolCallsById.get(event.toolCallId);
  if (!existing) {
    console.warn("[agui-react] TOOL_CALL_ARGS for unknown toolCallId", event.toolCallId);
    return state;
  }

  const updated: ToolCallState = {
    ...existing,
    argsAccumulated: existing.argsAccumulated + event.delta,
  };

  return updateToolCall(state, updated);
}

function handleToolCallEnd(state: RunState, event: ToolCallEndEvent): RunState {
  const existing = state.toolCallsById.get(event.toolCallId);
  if (!existing) return state;

  const updated: ToolCallState = {
    ...existing,
    argsComplete: true,
    status: "done",
  };

  return updateToolCall(state, updated);
}

function handleToolCallResult(state: RunState, event: ToolCallResultEvent): RunState {
  const existing = state.toolCallsById.get(event.toolCallId);
  if (!existing) return state;

  const updated: ToolCallState = {
    ...existing,
    result: event.content,
    resultMessageId: event.messageId,
    status: "has-result",
  };

  return updateToolCall(state, updated);
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

function updateToolCall(state: RunState, updated: ToolCallState): RunState {
  const newToolCallsById = new Map(state.toolCallsById);
  newToolCallsById.set(updated.toolCallId, updated);

  return {
    ...patchCurrentRun(state, (run) => ({
      ...run,
      toolCalls: run.toolCalls.map((tc) =>
        tc.toolCallId === updated.toolCallId ? updated : tc
      ),
    })),
    toolCallsById: newToolCallsById,
  };
}

function buildConfirmedMessages(state: RunState, run: AgentRun): Message[] {
  const additions: Message[] = [];

  // Assistant message with optional text and tool calls
  const assistantMsg: Message = {
    id: run.runId || `run-${Date.now()}`,
    role: "assistant",
    ...(run.response ? { content: run.response } : {}),
    ...(run.toolCalls.length > 0
      ? {
          toolCalls: run.toolCalls.map((tc) => ({
            id: tc.toolCallId,
            type: "function" as const,
            function: {
              name: tc.toolCallName,
              arguments: tc.argsAccumulated,
            },
          })),
        }
      : {}),
  };
  additions.push(assistantMsg);

  // Tool result messages in tool call order
  for (const tc of run.toolCalls) {
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
