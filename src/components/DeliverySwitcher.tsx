"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Spinner from "@/components/Spinner";

export type DeliveryTab = {
  id: string;
  href: string;
  label: string;
  /** Full delivery title, shown as the tooltip when the label is shortened. */
  title: string;
  /** Optional variant badge; omitted when it would just repeat the label. */
  badge?: string;
};

/**
 * Segmented control in the preview header for flipping between the
 * deliveries of one ticket. Switching is a full server render against the
 * database plus a Drive stream, so the clicked tab shows a spinner until the
 * new page is on screen — otherwise the click feels ignored.
 */
export default function DeliverySwitcher({
  tabs,
  currentId,
}: {
  tabs: DeliveryTab[];
  currentId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  // The component stays mounted across the navigation, so clear the spinner
  // once the server has delivered the page for the tab that was clicked.
  useEffect(() => setPendingId(null), [currentId]);

  function go(tab: DeliveryTab, e: React.MouseEvent) {
    if (tab.id === currentId || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    setPendingId(tab.id);
    startTransition(() => router.push(tab.href));
  }

  const busy = isPending && pendingId !== null;

  return (
    <nav
      aria-label="Deliveries"
      aria-busy={busy || undefined}
      className={`flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-1 ${
        busy ? "cursor-progress" : ""
      }`}
    >
      {tabs.map((tab) => {
        const isCurrent = tab.id === currentId;
        const isLoading = busy && tab.id === pendingId;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            onClick={(e) => go(tab, e)}
            aria-current={isCurrent ? "page" : undefined}
            title={tab.title}
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition ${
              isCurrent || isLoading
                ? "bg-white font-semibold text-brand-700 shadow-sm"
                : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
            } ${busy && !isLoading ? "opacity-60" : ""}`}
          >
            {isLoading && <Spinner size={13} className="shrink-0 text-brand-600" />}
            <span className="max-w-[14rem] truncate">{tab.label}</span>
            {tab.badge && (
              <span className="badge bg-slate-200 text-slate-600">{tab.badge}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
