import { useEffect, useRef, useState } from 'react';

const IDLE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
const WARNING_MS = 60 * 1000; // show warning 1 minute before logout
const POLL_MS = 1000;

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousedown',
  'mousemove',
  'keydown',
  'scroll',
  'touchstart',
  'click',
];

export function useIdleTimeout(onTimeout: () => void, enabled: boolean) {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const lastActivityRef = useRef<number>(Date.now());
  const firedRef = useRef(false);
  const onTimeoutRef = useRef(onTimeout);
  useEffect(() => { onTimeoutRef.current = onTimeout; }, [onTimeout]);

  useEffect(() => {
    if (!enabled) return;

    const markActivity = () => {
      lastActivityRef.current = Date.now();
      if (firedRef.current) {
        firedRef.current = false;
        setShowWarning(false);
        setSecondsLeft(Math.round(WARNING_MS / 1000));
      }
    };

    const handleActivity = () => {
      if (Date.now() - lastActivityRef.current > 5000) {
        markActivity();
      }
    };

    const tick = () => {
      if (firedRef.current) return;
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= IDLE_THRESHOLD_MS) {
        firedRef.current = true;
        onTimeoutRef.current();
      } else if (elapsed >= IDLE_THRESHOLD_MS - WARNING_MS) {
        setShowWarning(true);
        setSecondsLeft(Math.max(0, Math.round((IDLE_THRESHOLD_MS - elapsed) / 1000)));
      } else {
        setShowWarning(false);
        setSecondsLeft(Math.round(WARNING_MS / 1000));
      }
    };

    markActivity();
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, handleActivity, { passive: true }));
    document.addEventListener('visibilitychange', markActivity);
    const interval = setInterval(tick, POLL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, handleActivity));
      document.removeEventListener('visibilitychange', markActivity);
      clearInterval(interval);
    };
  }, [enabled]);

  const dismissWarning = () => {
    lastActivityRef.current = Date.now();
    firedRef.current = false;
    setShowWarning(false);
    setSecondsLeft(Math.round(WARNING_MS / 1000));
  };

  return { showWarning, secondsLeft, dismissWarning };
}
