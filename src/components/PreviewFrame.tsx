"use client";

import { useEffect, useState } from "react";
import Spinner from "@/components/Spinner";

/**
 * The preview iframe with a loading overlay. The file is streamed from Google
 * Drive, which can take a few seconds, and an iframe gives no feedback of its
 * own in the meantime. Keyed on `src` by the caller so a new design starts
 * from the loading state again.
 */
export default function PreviewFrame({ src, title }: { src: string; title: string }) {
  const [loaded, setLoaded] = useState(false);

  // A blocked or dropped stream may never fire `load`; don't leave the design
  // hidden behind the overlay forever in that case.
  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 20_000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative min-h-0 flex-1">
      {!loaded && (
        <div
          role="status"
          className="absolute inset-0 flex items-center justify-center bg-slate-50"
        >
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
            <Spinner size={16} className="text-brand-600" />
            Loading design…
          </div>
        </div>
      )}
      <iframe
        src={src}
        title={title}
        sandbox="allow-scripts allow-popups"
        onLoad={() => setLoaded(true)}
        className="h-full w-full border-0"
      />
    </div>
  );
}
