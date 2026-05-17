import type { ConnectionStatus } from "@agilab/react";

const STATUS_CONFIG: Record<
  ConnectionStatus,
  { label: string; color: string; pulse: boolean }
> = {
  idle:       { label: "Ready",        color: "bg-gray-400",   pulse: false },
  connecting: { label: "Connecting…",  color: "bg-yellow-400", pulse: true  },
  streaming:  { label: "Receiving…",   color: "bg-green-400",  pulse: true  },
  finished:   { label: "Done",         color: "bg-green-500",  pulse: false },
  error:      { label: "Error",        color: "bg-red-500",    pulse: false },
};

interface StatusBarProps {
  status: ConnectionStatus;
  step?: { id: string; name: string };
  error?: string;
}

export function StatusBar({ status, step, error }: StatusBarProps) {
  const cfg = STATUS_CONFIG[status];

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 bg-gray-50 border-b border-gray-200 text-xs text-gray-600">
      <span className="relative flex h-2 w-2">
        {cfg.pulse && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${cfg.color}`}
          />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${cfg.color}`} />
      </span>
      <span>
        {status === "error" && error ? `Error: ${error}` : cfg.label}
        {step && status === "streaming" ? ` · ${step.name}` : ""}
      </span>
    </div>
  );
}
