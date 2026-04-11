'use client';

import { useEffect, useState, useCallback } from 'react';

let toastFn: ((msg: string) => void) | null = null;

export function showToast(msg: string) {
  if (toastFn) toastFn(msg);
}

export default function ToastProvider() {
  const [message, setMessage] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  const show = useCallback((msg: string) => {
    setMessage(msg);
    setVisible(true);
  }, []);

  useEffect(() => {
    toastFn = show;
    return () => { toastFn = null; };
  }, [show]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      setVisible(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, [visible, message]);

  if (!visible || !message) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[200] animate-fade-in">
      <div className="pixel-border-sm bg-[var(--text-primary)] text-white text-xs px-4 py-2 font-pixel whitespace-nowrap">
        {message}
      </div>
    </div>
  );
}
