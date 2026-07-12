"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function ProgressBarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const trickleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const key = `${pathname}?${searchParams?.toString() ?? ""}`;
  const firstRender = useRef(true);

  useEffect(() => {
    function start() {
      // Deferred: pushState/replaceState can be called by Next.js from
      // inside a useInsertionEffect, where React forbids scheduling updates.
      queueMicrotask(() => {
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        if (trickleRef.current) clearInterval(trickleRef.current);
        setVisible(true);
        setProgress(15);
        trickleRef.current = setInterval(() => {
          setProgress((p) => (p < 85 ? p + (85 - p) * 0.1 : p));
        }, 200);
      });
    }

    const originalPush = window.history.pushState.bind(window.history);
    const originalReplace = window.history.replaceState.bind(window.history);

    window.history.pushState = function (
      ...args: Parameters<History["pushState"]>
    ) {
      start();
      return originalPush(...args);
    };
    window.history.replaceState = function (
      ...args: Parameters<History["replaceState"]>
    ) {
      start();
      return originalReplace(...args);
    };

    return () => {
      window.history.pushState = originalPush;
      window.history.replaceState = originalReplace;
    };
  }, []);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (trickleRef.current) clearInterval(trickleRef.current);
    setProgress(100);
    hideTimeoutRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 200);
    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <div
      className="pointer-events-none fixed left-0 top-0 z-[200] h-[3px] w-full bg-transparent"
      aria-hidden="true"
    >
      <div
        className="h-full bg-brand-500 shadow-[0_0_8px_rgba(52,100,246,0.6)] transition-[width,opacity] duration-200 ease-out"
        style={{
          width: `${progress}%`,
          opacity: visible ? 1 : 0,
        }}
      />
    </div>
  );
}

export default function RouteProgressBar() {
  return (
    <Suspense fallback={null}>
      <ProgressBarInner />
    </Suspense>
  );
}
