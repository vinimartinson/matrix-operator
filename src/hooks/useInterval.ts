import { useEffect, useRef } from 'react';

/**
 * A stable setInterval hook that always calls the latest callback.
 * @param callback Function to call on each interval tick
 * @param delay Interval in milliseconds, or null to pause
 */
export function useInterval(callback: () => void, delay: number | null): void {
  const savedCallback = useRef<() => void>(callback);

  // Keep ref up-to-date with the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;

    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}
