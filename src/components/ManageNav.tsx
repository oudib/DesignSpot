"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/manage", label: "Overview", exact: true },
  { href: "/manage/tickets", label: "Tickets" },
  { href: "/manage/structure", label: "Structure & designs" },
  { href: "/manage/settings", label: "Settings" },
];

export default function ManageNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1.5 lg:flex-col">
      {ITEMS.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-medium transition",
              active
                ? "bg-brand-600 text-white"
                : "text-slate-600 hover:bg-slate-100"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
