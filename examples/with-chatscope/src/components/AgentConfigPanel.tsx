import { useState } from "react";
import type { AgentConfig } from "@agentui/react";

interface AgentConfigPanelProps {
  config: AgentConfig;
  onChange: (config: AgentConfig) => void;
  disabled?: boolean;
}

export function AgentConfigPanel({ config, onChange, disabled }: AgentConfigPanelProps) {
  const [localUrl, setLocalUrl] = useState(config.url);
  const [headers, setHeaders] = useState<[string, string][]>(
    Object.entries(config.headers)
  );

  function commit() {
    onChange({
      url: localUrl,
      headers: Object.fromEntries(headers.filter(([k]) => k.trim())),
    });
  }

  function updateHeader(i: number, key: string, value: string) {
    const next = headers.map((h, idx) => (idx === i ? [key, value] as [string,string] : h));
    setHeaders(next);
  }

  function removeHeader(i: number) {
    setHeaders(headers.filter((_, idx) => idx !== i));
  }

  return (
    <div className="border-b border-gray-200 bg-white px-4 py-3 space-y-3">
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-gray-600 w-16 shrink-0">
          Agent URL
        </label>
        <input
          type="text"
          value={localUrl}
          onChange={(e) => setLocalUrl(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
          disabled={disabled}
          placeholder="http://localhost:8000/agent"
          className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50 font-mono"
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-600">Headers</span>
          <button
            onClick={() => setHeaders([...headers, ["", ""]])}
            disabled={disabled}
            className="text-xs text-blue-500 hover:underline disabled:opacity-50"
          >
            + Add
          </button>
        </div>
        {headers.map(([k, v], i) => (
          <div key={i} className="flex gap-1.5 items-center">
            <input
              type="text"
              value={k}
              onChange={(e) => updateHeader(i, e.target.value, v)}
              onBlur={commit}
              placeholder="Key"
              disabled={disabled}
              className="w-32 text-xs border border-gray-300 rounded px-2 py-1 font-mono focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50"
            />
            <input
              type="text"
              value={v}
              onChange={(e) => updateHeader(i, k, e.target.value)}
              onBlur={commit}
              placeholder="Value"
              disabled={disabled}
              className="flex-1 text-xs border border-gray-300 rounded px-2 py-1 font-mono focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50"
            />
            <button
              onClick={() => { removeHeader(i); commit(); }}
              disabled={disabled}
              className="text-gray-400 hover:text-red-400 disabled:opacity-50 text-sm leading-none"
            >
              ✕
            </button>
          </div>
        ))}
        {headers.some(([k]) => k.toLowerCase().includes("key") || k.toLowerCase().includes("token") || k.toLowerCase().includes("secret")) && (
          <p className="text-xs text-amber-600">
            ⚠ Sensitive header values are stored in localStorage only (not transmitted elsewhere).
          </p>
        )}
      </div>
    </div>
  );
}
