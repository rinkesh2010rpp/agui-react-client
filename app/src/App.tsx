import { useState } from "react";
import {
  MainContainer,
  ChatContainer,
  MessageList,
  Message,
  MessageInput,
  TypingIndicator,
} from "@chatscope/chat-ui-kit-react";
import "@chatscope/chat-ui-kit-styles/dist/default/styles.min.css";
import { useAgentRun, useUIState } from "@agentui/react";
import type { AgentConfig, AgentRun, ToolCallState } from "@agentui/react";
import { StatusBar } from "./components/StatusBar";
import { ToolCallCard } from "./components/ToolCallCard";
import { AgentConfigPanel } from "./components/AgentConfigPanel";

const STORAGE_KEY = "agentui-config";

function loadConfig(): AgentConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { url: "", headers: {} };
}

function saveConfig(cfg: AgentConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

function ReasoningBlock({
  reasoning,
}: {
  reasoning: { content: string; isComplete: boolean };
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-lg bg-gray-50 text-xs overflow-hidden mb-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-1.5 px-3 py-2 text-gray-500 hover:bg-gray-100"
      >
        <span>{open ? "▾" : "▸"}</span>
        <span className="italic">
          {reasoning.isComplete ? "Reasoning" : "Thinking…"}
        </span>
        {!reasoning.isComplete && <span className="animate-pulse ml-1">●</span>}
      </button>
      {open && (
        <div className="px-3 pb-2 text-gray-600 italic whitespace-pre-wrap">
          {reasoning.content}
        </div>
      )}
    </div>
  );
}

// Returns a pair of chatscope <Message> nodes for a run (user input + assistant response).
// Must be a function (not component) so chatscope's child type validation sees <Message> directly.
function renderRun(run: AgentRun): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];

  if (run.userInput) {
    nodes.push(
      <Message
        key={`${run.runId || run.timestamp}-user`}
        model={{
          message: run.userInput,
          sender: "user",
          direction: "outgoing",
          position: "single",
        }}
      />
    );
  }

  const hasCustomContent = run.toolCalls.length > 0 || !!run.reasoning;

  if (!hasCustomContent) {
    nodes.push(
      <Message
        key={`${run.runId || run.timestamp}-assistant`}
        model={{
          message: run.response || "…",
          sender: "assistant",
          direction: "incoming",
          position: "single",
        }}
      >
        {run.isStreaming && (
          <Message.Footer>
            <span className="animate-pulse text-gray-400 text-xs">▊</span>
          </Message.Footer>
        )}
      </Message>
    );
  } else {
    nodes.push(
      <Message
        key={`${run.runId || run.timestamp}-assistant`}
        model={{
          type: "custom",
          sender: "assistant",
          direction: "incoming",
          position: "single",
        }}
      >
        <Message.CustomContent>
          <div className="py-1 space-y-1">
            {run.reasoning && <ReasoningBlock reasoning={run.reasoning} />}

            {run.toolCalls.map((tc: ToolCallState) => (
              <ToolCallCard key={tc.toolCallId} tc={tc} />
            ))}

            {run.response && (
              <div className="px-1 pt-1 text-sm text-gray-800 whitespace-pre-wrap">
                {run.response}
                {run.isStreaming && (
                  <span className="animate-pulse text-gray-400 ml-0.5">▊</span>
                )}
              </div>
            )}

            {!run.response && run.isStreaming && (
              <span className="animate-pulse text-gray-400 text-sm px-1">▊</span>
            )}
          </div>
        </Message.CustomContent>
      </Message>
    );
  }

  return nodes;
}

export default function App() {
  const [config, setConfig] = useState<AgentConfig>(loadConfig);
  const [configOpen, setConfigOpen] = useState(!loadConfig().url);
  const [uiState] = useUIState({ sessionStart: new Date().toISOString() });

  const { agentState, sendMessage, abort } = useAgentRun({
    config,
    uiState,
    handlers: {},
  });

  const isStreaming =
    agentState.status === "streaming" || agentState.status === "connecting";

  function handleConfigChange(cfg: AgentConfig) {
    setConfig(cfg);
    saveConfig(cfg);
  }

  function handleSend(text: string) {
    if (!config.url) {
      setConfigOpen(true);
      return;
    }
    sendMessage(text);
  }

  const allRuns = [
    ...agentState.runs,
    ...(agentState.currentRun ? [agentState.currentRun] : []),
  ];

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-white">
        <span className="font-semibold text-gray-800">Agent Chat</span>
        <button
          onClick={() => setConfigOpen((v) => !v)}
          className="text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded px-2 py-1"
        >
          {configOpen ? "Hide config" : "Configure"}
        </button>
      </div>

      {configOpen && (
        <AgentConfigPanel
          config={config}
          onChange={handleConfigChange}
          disabled={isStreaming}
        />
      )}

      <StatusBar
        status={agentState.status}
        step={agentState.currentStep}
        error={agentState.error}
      />

      <div className="flex-1 overflow-hidden">
        <MainContainer>
          <ChatContainer>
            <MessageList
              typingIndicator={
                isStreaming ? (
                  <TypingIndicator content="Agent is typing…" />
                ) : undefined
              }
            >
              {allRuns.flatMap((run) => renderRun(run))}
            </MessageList>
            <MessageInput
              placeholder={
                config.url ? "Type a message…" : "Set agent URL above to start"
              }
              onSend={isStreaming ? undefined : handleSend}
              attachButton={false}
              sendButton={true}
              disabled={false}
            />
          </ChatContainer>
        </MainContainer>
      </div>

      {isStreaming && (
        <div className="flex justify-center py-2 border-t border-gray-100">
          <button
            onClick={abort}
            className="text-xs text-red-500 hover:underline"
          >
            Stop generating
          </button>
        </div>
      )}
    </div>
  );
}
