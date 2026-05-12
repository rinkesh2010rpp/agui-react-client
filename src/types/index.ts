import type { Message } from "@ag-ui/core";

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "streaming"
  | "finished"
  | "error";

export interface AgentConfig {
  url: string;
  headers: Record<string, string>;
}

export type HandlerRegistry = Record<string, (data: unknown) => void>;

export interface ToolCallState {
  toolCallId: string;
  toolCallName: string;
  argsAccumulated: string;
  argsComplete: boolean;
  result?: string;
  resultMessageId?: string;
  status: "streaming" | "done" | "has-result" | "error";
}

export interface ReasoningState {
  content: string;
  isComplete: boolean;
}

export interface TextMessageState {
  messageId: string;
  content: string;
  isComplete: boolean;
}

// Discriminated union — one entry per text message or tool call, in arrival order
export type RunItem =
  | ({ kind: "text" } & TextMessageState)
  | ({ kind: "tool" } & ToolCallState);

// Primary UI unit — everything between RUN_STARTED and RUN_FINISHED
export interface AgentRun {
  runId: string;
  source: "user" | "agent";
  userInput?: string;
  items: RunItem[];
  reasoning?: ReasoningState;
  isStreaming: boolean;
  status: "streaming" | "finished" | "error";
  error?: string;
  timestamp: number;
}

export interface AgentState {
  status: ConnectionStatus;
  runs: AgentRun[];
  currentRun?: AgentRun;
  currentStep?: { id: string; name: string };
  threadId: string;
  error?: string;
}

// Internal reducer state — superset of AgentState with protocol bookkeeping
export interface RunState {
  agentState: AgentState;
  threadId: string;
  runId: string;
  // O(1) lookup for item updates during streaming hot path (keyed by messageId or toolCallId)
  itemsById: Map<string, RunItem>;
  // Tracks the most recently started text message for CHUNK events without messageId
  currentTextMessageId: string | null;
  // Wire-format message history sent to agent on next turn
  confirmedMessages: Message[];
}
