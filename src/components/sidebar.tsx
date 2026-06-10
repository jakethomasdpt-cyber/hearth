"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "◈" },
  { href: "/accounts", label: "Accounts", icon: "▤" },
  { href: "/transactions", label: "Transactions", icon: "⇄" },
  { href: "/bills", label: "Bills & Subscriptions", icon: "↻" },
  { href: "/budgets", label: "Budgets", icon: "◔" },
  { href: "/import", label: "Import", icon: "⇪" },
  { href: "/insights", label: "Savings", icon: "✦" },
  { href: "/reports", label: "Reports", icon: "▦" },
  { href: "/settings", label: "Household", icon: "♡" },
];

export function Sidebar({
  householdName,
  userName,
  signOutAction,
}: {
  householdName: string;
  userName: string;
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-edge bg-surface/50 px-4 py-6 max-md:w-16 max-md:px-2">
      <Link href="/dashboard" className="mb-8 flex items-center gap-2.5 px-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-pos-dim text-base">
          🌿
        </span>
        <span className="text-base font-semibold tracking-tight max-md:hidden">
          Hearth
        </span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors duration-150 max-md:justify-center max-md:px-0 ${
                active
                  ? "bg-surface-raised font-medium text-ink"
                  : "text-ink-muted hover:bg-surface-raised/60 hover:text-ink"
              }`}
            >
              <span className={`text-base ${active ? "text-pos" : ""}`}>
                {item.icon}
              </span>
              <span className="max-md:hidden">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 border-t border-edge pt-4">
        <div className="px-2 max-md:hidden">
          <p className="truncate text-sm font-medium">{householdName}</p>
          <p className="truncate text-xs text-ink-muted">{userName}</p>
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="mt-3 w-full rounded-xl px-3 py-2 text-left text-xs text-ink-faint transition-colors hover:bg-surface-raised hover:text-ink max-md:text-center"
          >
            <span className="max-md:hidden">Sign out</span>
            <span className="md:hidden">⏻</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
