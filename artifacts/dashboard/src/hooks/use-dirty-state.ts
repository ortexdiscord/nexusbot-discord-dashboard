import { useCallback, useState } from "react";

/**
 * Tracks whether a form's current values have diverged from the last saved
 * baseline. Pass a plain-object snapshot of all the fields you want to
 * watch; call `markSaved` once with a fresh snapshot whenever data loads
 * from the server or a save succeeds.
 */
export function useDirtyState<T>(current: T) {
  const [baseline, setBaseline] = useState<T | null>(null);

  const markSaved = useCallback((snapshot: T) => {
    setBaseline(snapshot);
  }, []);

  const isDirty = baseline !== null && JSON.stringify(current) !== JSON.stringify(baseline);

  return { isDirty, markSaved };
}
