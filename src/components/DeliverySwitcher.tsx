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
 * Row of small buttons in the preview header for flipping between the
 * deliveries of one ticket (the current one is filled). Switching is a full server render against the
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
      className={`flex max-w-full items-center gap-1.5 overflow-x-auto ${
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
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
              isCurrent || isLoading
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
            } ${busy && !isLoading ? "opacity-60" : ""}`}
          >
            {isLoading && <Spinner size={12} className="shrink-0 text-white" />}
            <span className="max-w-[12rem] truncate">{tab.label}</span>
            {tab.badge && (
              <span
                className={`badge !px-1.5 !py-0 !text-[10px] ${
                  isCurrent || isLoading ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
                }`}
              >
                {tab.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
