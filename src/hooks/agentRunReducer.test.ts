import { describe, it, expect } from "vitest";
import { EventType } from "@ag-ui/core";
import { agentRunReducer, initialRunState } from "./agentRunReducer";
import type { RunState } from "../types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function withActiveRun(userInput = "hello"): RunState {
  return agentRunReducer(initialRunState(), {
    type: "RUN_INIT",
    userInput,
    userMessageId: "user-1",
  });
}

function withStartedRun(state: RunState): RunState {
  return agentRunReducer(state, {
    type: "AGUI_EVENT",
    event: { type: EventType.RUN_STARTED, runId: "run-1", threadId: "thread-1" } as any,
  });
}

// ─── RUN_INIT ────────────────────────────────────────────────────────────────

describe("RUN_INIT", () => {
  it("sets status to connecting", () => {
    const state = withActiveRun();
    expect(state.agentState.status).toBe("connecting");
  });

  it("sets currentRun with userInput", () => {
    const state = withActiveRun("test message");
    expect(state.agentState.currentRun?.userInput).toBe("test message");
  });

  it("adds user message to confirmedMessages", () => {
    const state = withActiveRun("hi");
    expect(state.confirmedMessages).toHaveLength(1);
    expect(state.confirmedMessages[0].role).toBe("user");
    expect(state.confirmedMessages[0].content).toBe("hi");
  });

  it("clears itemsById", () => {
    const state = withActiveRun();
    expect(state.itemsById.size).toBe(0);
  });
});

// ─── RUN_STARTED ─────────────────────────────────────────────────────────────

describe("RUN_STARTED", () => {
  it("sets status to streaming", () => {
    const state = withStartedRun(withActiveRun());
    expect(state.agentState.status).toBe("streaming");
  });

  it("sets runId and threadId", () => {
    const state = withStartedRun(withActiveRun());
    expect(state.runId).toBe("run-1");
    expect(state.threadId).toBe("thread-1");
  });
});

// ─── Text streaming ───────────────────────────────────────────────────────────

describe("text message lifecycle", () => {
  function buildTextStream() {
    let state = withStartedRun(withActiveRun());
    state = agentRunReducer(state, {
      type: "AGUI_EVENT",
      event: { type: EventType.TEXT_MESSAGE_START, messageId: "msg-1" } as any,
    });
    state = agentRunReducer(state, {
      type: "AGUI_EVENT",
      event: { type: EventType.TEXT_MESSAGE_CONTENT, messageId: "msg-1", delta: "Hello" } as any,
    });
    state = agentRunReducer(state, {
      type: "AGUI_EVENT",
      event: { type: EventType.TEXT_MESSAGE_CONTENT, messageId: "msg-1", delta: " world" } as any,
    });
    return state;
  }

  it("creates a text item on TEXT_MESSAGE_START", () => {
    let state = withStartedRun(withActiveRun());
    state = agentRunReducer(state, {
      type: "AGUI_EVENT",
      event: { type: EventType.TEXT_MESSAGE_START, messageId: "msg-1" } as any,
    });
    const item = state.agentState.currentRun?.items[0];
    expect(item?.kind).toBe("text");
    expect(item?.content).toBe("");
  });

  it("accumulates content across TEXT_MESSAGE_CONTENT events", () => {
    const state = buildTextStream();
    const item = state.agentState.currentRun?.items[0];
    expect(item?.kind === "text" && item.content).toBe("Hello world");
  });

  it("marks item complete on TEXT_MESSAGE_END", () => {
    let state = buildTextStream();
    state = agentRunReducer(state, {
      type: "AGUI_EVENT",
      event: { type: EventType.TEXT_MESSAGE_END, messageId: "msg-1" } as any,
    });
    const item = state.agentState.currentRun?.items[0];
    expect(item?.kind === "text" && item.isComplete).toBe(true);
  });
});

// ─── TEXT_MESSAGE_CHUNK ───────────────────────────────────────────────────────

describe("TEXT_MESSAGE_CHUNK", () => {
  it("auto-creates a text item if none exists", () => {
    let state = withStartedRun(withActiveRun());
    state = agentRunReducer(state, {
      type: "AGUI_EVENT",
      event: { type: EventType.TEXT_MESSAGE_CHUNK, messageId: "msg-c", delta: "chunk" } as any,
    });
    const item = state.agentState.currentRun?.items[0];
    expect(item?.kind).toBe("text");
    expect(item?.kind === "text" && item.content).toBe("chunk");
  });

  it("appends to existing text item", () => {
    let state = withStartedRun(withActiveRun());
    state = agentRunReducer(state, {
      type: "AGUI_EVENT",
      event: { type: EventType.TEXT_MESSAGE_START, messageId: "msg-1" } as any,
    });
    state = agentRunReducer(state, {
      type: "AGUI_EVENT",
      event: { type: EventType.TEXT_MESSAGE_CHUNK, messageId: "msg-1", delta: " appended" } as any,
    });
    const item = state.agentState.currentRun?.items[0];
    expect(item?.kind === "text" && item.content).toBe(" appended");
  });
});

// ─── Tool call lifecycle ──────────────────────────────────────────────────────

describe("tool call lifecycle", () => {
  function buildToolCall() {
    let state = withStartedRun(withActiveRun());
    state = agentRunReducer(state, {
      type: "AGUI_EVENT",
      event: { type: EventType.TOOL_CALL_START, toolCallId: "tc-1", toolCallName: "search" } as any,
    });
    state = agentRunReducer(state, {
      type: "AGUI_EVENT",
      event: { type: EventType.TOOL_CALL_ARGS, toolCallId: "tc-1", delta: '{"q":' } as any,
    });
    state = agentRunReducer(state, {
      type: "AGUI_EVENT",
      event: { type: EventType.TOOL_CALL_ARGS, toolCallId: "tc-1", delta: '"cats"}' } as any,
    });
    state = agentRunReducer(state, {
      type: "AGUI_EVENT",
      event: { type: EventType.TOOL_CALL_END, toolCallId: "tc-1" } as any,
    });
    return state;
  }

  it("creates a tool item on TOOL_CALL_START", () => {
    let state = withStartedRun(withActiveRun());
    state = agentRunReducer(state, {
      type: "AGUI_EVENT",
      event: { type: EventType.TOOL_CALL_START, toolCallId: "tc-1", toolCallName: "search" } as any,
    });
    const item = state.agentState.currentRun?.items[0];
    expect(item?.kind).toBe("tool");
    expect(item?.kind === "tool" && item.toolCallName).toBe("search");
    expect(item?.kind === "tool" && item.status).toBe("streaming");
  });

  it("accumulates args across TOOL_CALL_ARGS events", () => {
    const state = buildToolCall();
    const item = state.agentState.currentRun?.items[0];
    expect(item?.kind === "tool" && item.argsAccumulated).toBe('{"q":"cats"}');
  });

  it("marks argsComplete and status done on TOOL_CALL_END", () => {
    const state = buildToolCall();
    const item = state.agentState.currentRun?.items[0];
    expect(item?.kind === "tool" && item.argsComplete).toBe(true);
    expect(item?.kind === "tool" && item.status).toBe("done");
  });

  it("sets result on TOOL_CALL_RESULT", () => {
    let state = buildToolCall();
    state = agentRunReducer(state, {
      type: "AGUI_EVENT",
      event: { type: EventType.TOOL_CALL_RESULT, toolCallId: "tc-1", messageId: "res-1", content: "10 results" } as any,
    });
    const item = state.agentState.currentRun?.items[0];
    expect(item?.kind === "tool" && item.result).toBe("10 results");
    expect(item?.kind === "tool" && item.status).toBe("has-result");
  });
});

// ─── RUN_FINISHED ─────────────────────────────────────────────────────────────

describe("RUN_FINISHED", () => {
  it("moves currentRun to runs array", () => {
    let state = withStartedRun(withActiveRun());
    state = agentRunReducer(state, {
      type: "AGUI_EVENT",
      event: { type: EventType.RUN_FINISHED } as any,
    });
    expect(state.agentState.runs).toHaveLength(1);
    expect(state.agentState.currentRun).toBeUndefined();
  });

  it("marks finished run as not streaming", () => {
    let state = withStartedRun(withActiveRun());
    state = agentRunReducer(state, {
      type: "AGUI_EVENT",
      event: { type: EventType.RUN_FINISHED } as any,
    });
    expect(state.agentState.runs[0].isStreaming).toBe(false);
    expect(state.agentState.runs[0].status).toBe("finished");
  });

  it("accumulates runs across multiple turns", () => {
    let state = withStartedRun(withActiveRun("turn 1"));
    state = agentRunReducer(state, { type: "AGUI_EVENT", event: { type: EventType.RUN_FINISHED } as any });
    state = agentRunReducer(state, { type: "RUN_INIT", userInput: "turn 2", userMessageId: "user-2" });
    state = agentRunReducer(state, { type: "AGUI_EVENT", event: { type: EventType.RUN_STARTED, runId: "run-2", threadId: "thread-1" } as any });
    state = agentRunReducer(state, { type: "AGUI_EVENT", event: { type: EventType.RUN_FINISHED } as any });
    expect(state.agentState.runs).toHaveLength(2);
  });
});

// ─── Errors ──────────────────────────────────────────────────────────────────

describe("error handling", () => {
  it("RUN_ERROR sets status to error with message", () => {
    let state = withStartedRun(withActiveRun());
    state = agentRunReducer(state, {
      type: "AGUI_EVENT",
      event: { type: EventType.RUN_ERROR, message: "agent crashed" } as any,
    });
    expect(state.agentState.status).toBe("error");
    expect(state.agentState.error).toBe("agent crashed");
  });

  it("STREAM_ERROR sets status to error with message", () => {
    let state = withStartedRun(withActiveRun());
    state = agentRunReducer(state, { type: "STREAM_ERROR", error: new Error("network timeout") });
    expect(state.agentState.status).toBe("error");
    expect(state.agentState.error).toBe("network timeout");
  });

  it("STREAM_ERROR with non-Error uses fallback message", () => {
    let state = withStartedRun(withActiveRun());
    state = agentRunReducer(state, { type: "STREAM_ERROR", error: "plain string" });
    expect(state.agentState.error).toBe("Unknown streaming error");
  });
});

// ─── ABORTED ─────────────────────────────────────────────────────────────────

describe("ABORTED", () => {
  it("clears currentRun and sets status to idle", () => {
    let state = withStartedRun(withActiveRun());
    state = agentRunReducer(state, { type: "ABORTED" });
    expect(state.agentState.status).toBe("idle");
    expect(state.agentState.currentRun).toBeUndefined();
  });
});

// ─── Step events ──────────────────────────────────────────────────────────────

describe("step events", () => {
  it("STEP_STARTED sets currentStep", () => {
    let state = withStartedRun(withActiveRun());
    state = agentRunReducer(state, {
      type: "AGUI_EVENT",
      event: { type: EventType.STEP_STARTED, stepName: "search" } as any,
    });
    expect(state.agentState.currentStep?.name).toBe("search");
  });

  it("STEP_FINISHED clears currentStep", () => {
    let state = withStartedRun(withActiveRun());
    state = agentRunReducer(state, { type: "AGUI_EVENT", event: { type: EventType.STEP_STARTED, stepName: "search" } as any });
    state = agentRunReducer(state, { type: "AGUI_EVENT", event: { type: EventType.STEP_FINISHED } as any });
    expect(state.agentState.currentStep).toBeUndefined();
  });
});

// ─── Reasoning ───────────────────────────────────────────────────────────────

describe("reasoning", () => {
  it("builds reasoning content and marks complete", () => {
    let state = withStartedRun(withActiveRun());
    state = agentRunReducer(state, { type: "AGUI_EVENT", event: { type: EventType.REASONING_MESSAGE_START } as any });
    state = agentRunReducer(state, { type: "AGUI_EVENT", event: { type: EventType.REASONING_MESSAGE_CONTENT, delta: "thinking" } as any });
    state = agentRunReducer(state, { type: "AGUI_EVENT", event: { type: EventType.REASONING_MESSAGE_CONTENT, delta: "..." } as any });
    state = agentRunReducer(state, { type: "AGUI_EVENT", event: { type: EventType.REASONING_MESSAGE_END } as any });
    expect(state.agentState.currentRun?.reasoning?.content).toBe("thinking...");
    expect(state.agentState.currentRun?.reasoning?.isComplete).toBe(true);
  });
});

// ─── confirmedMessages after RUN_FINISHED ─────────────────────────────────────

describe("confirmedMessages", () => {
  it("appends assistant text message after run finishes", () => {
    let state = withStartedRun(withActiveRun("hi"));
    state = agentRunReducer(state, { type: "AGUI_EVENT", event: { type: EventType.TEXT_MESSAGE_START, messageId: "msg-1" } as any });
    state = agentRunReducer(state, { type: "AGUI_EVENT", event: { type: EventType.TEXT_MESSAGE_CONTENT, messageId: "msg-1", delta: "Hello!" } as any });
    state = agentRunReducer(state, { type: "AGUI_EVENT", event: { type: EventType.TEXT_MESSAGE_END, messageId: "msg-1" } as any });
    state = agentRunReducer(state, { type: "AGUI_EVENT", event: { type: EventType.RUN_FINISHED } as any });

    const msgs = state.confirmedMessages;
    expect(msgs[0].role).toBe("user");
    expect(msgs[1].role).toBe("assistant");
    expect(msgs[1].content).toBe("Hello!");
  });
});
