import { useReducer, useCallback, useRef } from "react";
import { HttpAgent } from "@ag-ui/client";
import { EventType, type AGUIEvent, type CustomEvent } from "@ag-ui/core";
import {
  agentRunReducer,
  initialRunState,
} from "./agentRunReducer";
import type {
  AgentConfig,
  AgentState,
  HandlerRegistry,
} from "../types";

export interface UseAgentRunOptions<TUIState = Record<string, unknown>> {
  config: AgentConfig;
  uiState: TUIState;
  handlers?: HandlerRegistry;
}

export interface UseAgentRunReturn {
  agentState: AgentState;
  sendMessage: (text: string) => void;
  abort: () => void;
}

export function useAgentRun<TUIState = Record<string, unknown>>(
  opts: UseAgentRunOptions<TUIState>
): UseAgentRunReturn {
  const { config, uiState, handlers = {} } = opts;

  const [runState, dispatch] = useReducer(agentRunReducer, undefined, initialRunState);

  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const handlersRef = useRef<HandlerRegistry>(handlers);
  handlersRef.current = handlers;

  const uiStateRef = useRef<TUIState>(uiState);
  uiStateRef.current = uiState;

  const runStateRef = useRef(runState);
  runStateRef.current = runState;

  const sendMessage = useCallback(
    (text: string) => {
      subscriptionRef.current?.unsubscribe();
      subscriptionRef.current = null;

      const userMessageId = crypto.randomUUID();

      dispatch({ type: "RUN_INIT", userInput: text, userMessageId });

      // Read pre-dispatch state — confirmedMessages doesn't include the new user message yet
      const { confirmedMessages, threadId } = runStateRef.current;
      const runId = crypto.randomUUID();
      const resolvedThreadId = threadId || crypto.randomUUID();

      const agent = new HttpAgent({
        url: config.url,
        headers: config.headers,
      });

      const userCoreMessage = {
        id: userMessageId,
        role: "user" as const,
        content: text,
      };

      const observable = agent.run({
        threadId: resolvedThreadId,
        runId,
        messages: [...confirmedMessages, userCoreMessage],
        tools: [],
        context: [],
        state: uiStateRef.current as Record<string, unknown>,
        forwardedProps: {},
      });

      const subscription = observable.subscribe({
        next: (rawEvent) => {
          const event = rawEvent as AGUIEvent;
          if (event.type === EventType.CUSTOM) {
            const customEvent = event as CustomEvent;
            const handler = handlersRef.current[customEvent.name];
            if (handler) {
              handler(customEvent.value);
            }
          } else {
            dispatch({ type: "AGUI_EVENT", event });
          }
        },
        error: (err: unknown) => {
          dispatch({ type: "STREAM_ERROR", error: err });
        },
        complete: () => {
          subscriptionRef.current = null;
        },
      });

      subscriptionRef.current = subscription;
    },
    [config]
  );

  const abort = useCallback(() => {
    subscriptionRef.current?.unsubscribe();
    subscriptionRef.current = null;
    dispatch({ type: "ABORTED" });
  }, []);

  return {
    agentState: runState.agentState,
    sendMessage,
    abort,
  };
}
