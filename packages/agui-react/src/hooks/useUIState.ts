import { useState, useCallback, useRef } from "react";

export interface UIStateUpdaters<T> {
  update: (partial: Partial<T>) => void;
  set: (state: T) => void;
  reset: () => void;
}

export function useUIState<T>(initial: T): [T, UIStateUpdaters<T>] {
  const [state, setState] = useState<T>(initial);
  const initialRef = useRef(initial);

  const update = useCallback((partial: Partial<T>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const set = useCallback((next: T) => {
    setState(next);
  }, []);

  const reset = useCallback(() => {
    setState(initialRef.current);
  }, []);

  return [state, { update, set, reset }];
}
