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
import { useAgentRun, useUIState } from "@agilab/react";
import type { AgentConfig, AgentRun, RunItem } from "@agilab/react";
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

// ── Roadmap ────────────────────────────────────────────────────────────────

const ROADMAP = [
  {
    icon: "⚡",
    title: "Frontend Tool Call",
    description:
      "Let the agent execute tools that directly manipulate browser UI state — navigate pages, click elements, fill forms — without leaving the app.",
  },
  {
    icon: "🤝",
    title: "Human In the Loop",
    description:
      "Pause agent execution mid-run and surface an approval prompt. The agent only continues once the user explicitly confirms.",
  },
  {
    icon: "🔌",
    title: "MCP Apps Support",
    description:
      "Connect Model Context Protocol servers to extend your agent with a rich, composable ecosystem of external tools and data sources.",
  },
];

function RoadmapCard({ icon, title, description }: (typeof ROADMAP)[number]) {
  return (
    <div className="group flex gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md hover:border-indigo-100">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-xl group-hover:bg-indigo-100 transition">
        {icon}
      </div>
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-gray-800 text-sm">{title}</h3>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
            coming soon
          </span>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function MainContent() {
  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-8 flex flex-col gap-8">
      {/* Hero */}
      <div>
        <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1 mb-4">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
          <span className="text-xs font-medium text-indigo-600">@agilab/react</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 leading-tight">
          Headless AG-UI for React
        </h1>
        <p className="mt-2 text-sm text-gray-500 max-w-md leading-relaxed">
          Converts raw AG-UI SSE events into streaming-aware React state. You bring
          your own UI — the library handles the protocol. Point the chat at your
          agent to see it in action.
        </p>
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700 max-w-md">
          <span className="mt-0.5 shrink-0">ℹ️</span>
          <span>
            This example requires an{" "}
            <a
              href="https://github.com/ag-ui-protocol/ag-ui"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-amber-900"
            >
              AG-UI compatible backend
            </a>{" "}
            to connect to. <strong>@agilab/emulator</strong> — a local backend for
            testing without a real agent — is coming soon.
          </span>
        </div>
      </div>

      {/* What it handles today */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
          Protocol support
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {[
            ["Text streaming", "Multi-message, token-by-token"],
            ["Tool calls", "Args stream in; result rendered"],
            ["Extended thinking", "Collapsible reasoning blocks"],
            ["Custom events", "Route to your own handlers"],
            ["Step tracking", "Named agent phases"],
            ["UI state sync", "Send app state on every run"],
          ].map(([label, sub]) => (
            <div
              key={label}
              className="flex items-start gap-2 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm"
            >
              <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-[10px]">
                ✓
              </span>
              <div>
                <div className="text-xs font-medium text-gray-700">{label}</div>
                <div className="text-[11px] text-gray-400 mt-0.5">{sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Roadmap */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
          Roadmap
        </h2>
        <div className="flex flex-col gap-3">
          {ROADMAP.map((item) => (
            <RoadmapCard key={item.title} {...item} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Chat messages ──────────────────────────────────────────────────────────

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

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function renderRun(run: AgentRun): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const sentTime = formatTime(run.timestamp);

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
      >
        <Message.Footer sentTime={sentTime} />
      </Message>
    );
  }

  const hasCustomContent =
    run.items.some((i) => i.kind === "tool") || !!run.reasoning;

  if (!hasCustomContent) {
    const displayText =
      run.items
        .filter((i): i is RunItem & { kind: "text" } => i.kind === "text")
        .map((m) => m.content)
        .join("") || "…";
    nodes.push(
      <Message
        key={`${run.runId || run.timestamp}-assistant`}
        model={{
          message: displayText,
          sender: "assistant",
          direction: "incoming",
          position: "single",
        }}
      >
        <Message.Footer sentTime={sentTime}>
          {run.isStreaming && (
            <span className="animate-pulse text-gray-400 text-xs ml-1">▊</span>
          )}
        </Message.Footer>
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

            {run.items.map((item: RunItem) => {
              if (item.kind === "tool") {
                return <ToolCallCard key={item.toolCallId} tc={item} />;
              }
              return (
                <div
                  key={item.messageId}
                  className="px-1 pt-1 text-sm text-gray-800 whitespace-pre-wrap"
                >
                  {item.content}
                  {run.isStreaming && !item.isComplete && (
                    <span className="animate-pulse text-gray-400 ml-0.5">▊</span>
                  )}
                </div>
              );
            })}

            {run.items.length === 0 && run.isStreaming && (
              <span className="animate-pulse text-gray-400 text-sm px-1">▊</span>
            )}
          </div>
        </Message.CustomContent>
        <Message.Footer sentTime={sentTime} />
      </Message>
    );
  }

  return nodes;
}

// ── Chat sidebar ───────────────────────────────────────────────────────────

interface ChatSidebarProps {
  config: AgentConfig;
  onConfigChange: (cfg: AgentConfig) => void;
}

function ChatSidebar({ config, onConfigChange }: ChatSidebarProps) {
  const [configOpen, setConfigOpen] = useState(!config.url);
  const [uiState] = useUIState({ sessionStart: new Date().toISOString() });

  const { agentState, sendMessage, abort } = useAgentRun({
    config,
    uiState,
    handlers: {},
  });

  const isStreaming =
    agentState.status === "streaming" || agentState.status === "connecting";

  const allRuns = [
    ...agentState.runs,
    ...(agentState.currentRun ? [agentState.currentRun] : []),
  ];

  function handleSend(text: string) {
    if (!config.url) {
      setConfigOpen(true);
      return;
    }
    sendMessage(text);
  }

  return (
    <div className="w-[380px] shrink-0 flex flex-col border-l border-gray-200 bg-white">
      {/* Sidebar header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">A</span>
          </div>
          <span className="font-semibold text-gray-800 text-sm">Agent Chat</span>
        </div>
        <button
          onClick={() => setConfigOpen((v) => !v)}
          className="text-xs text-gray-400 hover:text-gray-700 border border-gray-200 rounded-lg px-2.5 py-1 transition hover:bg-gray-50"
        >
          {configOpen ? "Done" : "Configure"}
        </button>
      </div>

      {/* Config panel */}
      {configOpen && (
        <AgentConfigPanel
          config={config}
          onChange={onConfigChange}
          disabled={isStreaming}
        />
      )}

      {/* Status bar */}
      <StatusBar
        status={agentState.status}
        step={agentState.currentStep}
        error={agentState.error}
      />

      {/* Messages */}
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
              {allRuns.length === 0 ? (
                <MessageList.Content
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    gap: "8px",
                  }}
                >
                  <span style={{ fontSize: "2rem" }}>💬</span>
                  <span style={{ fontSize: "13px", color: "#9ca3af" }}>
                    {config.url
                      ? "Send a message to start"
                      : "Set your agent URL above"}
                  </span>
                </MessageList.Content>
              ) : (
                allRuns.flatMap((run) => renderRun(run))
              )}
            </MessageList>
            <MessageInput
              placeholder={
                config.url ? "Ask your agent anything…" : "Configure agent URL first"
              }
              onSend={isStreaming ? undefined : handleSend}
              attachButton={false}
              sendButton={true}
              disabled={false}
            />
          </ChatContainer>
        </MainContainer>
      </div>

      {/* Stop button */}
      {isStreaming && (
        <div className="flex justify-center py-2 border-t border-gray-100">
          <button
            onClick={abort}
            className="text-xs text-red-500 hover:text-red-600 hover:underline"
          >
            Stop generating
          </button>
        </div>
      )}
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────

export default function App() {
  const [config, setConfig] = useState<AgentConfig>(loadConfig);

  function handleConfigChange(cfg: AgentConfig) {
    setConfig(cfg);
    saveConfig(cfg);
  }

  return (
    <div className="flex h-full bg-gray-50">
      <MainContent />
      <ChatSidebar config={config} onConfigChange={handleConfigChange} />
    </div>
  );
}
