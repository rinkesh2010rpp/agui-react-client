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

// Primary UI unit — everything between RUN_STARTED and RUN_FINISHED
export interface AgentRun {
  runId: string;
  source: "user" | "agent";
  userInput?: string;
  toolCalls: ToolCallState[];
  reasoning?: ReasoningState;
  response: string;
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
  // O(1) lookup for tool call updates during streaming hot path
  toolCallsById: Map<string, ToolCallState>;
  // Wire-format message history sent to agent on next turn
  confirmedMessages: Message[];
}
