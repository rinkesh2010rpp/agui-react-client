import { useState } from "react";
import type { ToolCallState } from "@agentui/react";

const STATUS_LABEL: Record<ToolCallState["status"], string> = {
  streaming:  "running",
  done:       "done",
  "has-result": "completed",
  error:      "error",
};

const STATUS_COLOR: Record<ToolCallState["status"], string> = {
  streaming:  "bg-blue-100 text-blue-700",
  done:       "bg-gray-100 text-gray-600",
  "has-result": "bg-green-100 text-green-700",
  error:      "bg-red-100 text-red-700",
};

function tryPretty(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

const MAX_PREVIEW = 500;

function Truncatable({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  if (text.length <= MAX_PREVIEW) {
    return <pre className="whitespace-pre-wrap break-all text-xs">{text}</pre>;
  }
  return (
    <div>
      <pre className="whitespace-pre-wrap break-all text-xs">
        {expanded ? text : text.slice(0, MAX_PREVIEW) + "…"}
      </pre>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="text-xs text-blue-500 hover:underline mt-1"
      >
        {expanded ? "Show less" : "Show more"}
      </button>
    </div>
  );
}

interface ToolCallCardProps {
  tc: ToolCallState;
}

export function ToolCallCard({ tc }: ToolCallCardProps) {
  const [argsOpen, setArgsOpen] = useState(true);
  const [resultOpen, setResultOpen] = useState(true);
  const prettyArgs = tc.argsComplete ? tryPretty(tc.argsAccumulated) : tc.argsAccumulated;

  return (
    <div className="my-1 mx-2 rounded-lg border border-gray-200 bg-gray-50 text-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="text-gray-400">🔧</span>
        <span className="font-mono font-medium text-gray-800">{tc.toolCallName}</span>
        <span
          className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[tc.status]}`}
        >
          {STATUS_LABEL[tc.status]}
          {tc.status === "streaming" && (
            <span className="ml-1 animate-pulse">…</span>
          )}
        </span>
      </div>

      {/* Args */}
      {tc.argsAccumulated && (
        <div className="border-t border-gray-200">
          <button
            onClick={() => setArgsOpen((v) => !v)}
            className="w-full flex items-center gap-1 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100"
          >
            <span>{argsOpen ? "▾" : "▸"}</span> Args
          </button>
          {argsOpen && (
            <div className="px-3 pb-2 text-gray-700 font-mono">
              <Truncatable text={prettyArgs} />
            </div>
          )}
        </div>
      )}

      {/* Result */}
      {tc.result !== undefined && (
        <div className="border-t border-gray-200">
          <button
            onClick={() => setResultOpen((v) => !v)}
            className="w-full flex items-center gap-1 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100"
          >
            <span>{resultOpen ? "▾" : "▸"}</span> Result
          </button>
          {resultOpen && (
            <div className="px-3 pb-2 text-gray-700 font-mono">
              <Truncatable text={tryPretty(tc.result)} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
