"use client";

import { useState, useTransition } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { completeTellerEnrollment, syncNow } from "@/lib/actions/teller";
import type { SyncResult } from "@/lib/teller-sync";

declare global {
  interface Window {
    TellerConnect?: {
      setup: (options: {
        applicationId: string;
        environment: string;
        products: string[];
        onSuccess: (enrollment: {
          accessToken: string;
          enrollment: { id: string; institution: { name: string } };
        }) => void;
        onFailure?: (error: unknown) => void;
      }) => { open: () => void };
    };
  }
}

function summarize(results: SyncResult[]): string {
  const ok = results.filter((r) => !r.error);
  const failed = results.filter((r) => r.error);
  const parts: string[] = [];
  if (ok.length > 0) {
    const txs = ok.reduce((s, r) => s + r.newTransactions, 0);
    parts.push(
      `Synced ${ok.map((r) => r.institution).join(", ")} — ${txs} new transaction${txs === 1 ? "" : "s"}.`
    );
  }
  if (failed.length > 0) {
    parts.push(`Failed: ${failed.map((r) => r.institution).join(", ")} (re-link to fix).`);
  }
  return parts.join(" ") || "Nothing to sync yet.";
}

export function TellerConnectButton({
  applicationId,
  environment,
}: {
  applicationId: string;
  environment: string;
}) {
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const open = () => {
    if (!window.TellerConnect) return;
    const connect = window.TellerConnect.setup({
      applicationId,
      environment,
      products: ["transactions", "balance"],
      onSuccess: (enrollment) => {
        setMessage("Linking and running first sync…");
        startTransition(async () => {
          const res = await completeTellerEnrollment({
            accessToken: enrollment.accessToken,
            enrollmentId: enrollment.enrollment.id,
            institutionName: enrollment.enrollment.institution.name,
          });
          setMessage(res.error ?? summarize(res.results ?? []));
          router.refresh();
        });
      },
      onFailure: () => setMessage("Bank linking was cancelled or failed."),
    });
    connect.open();
  };

  return (
    <>
      <Script
        src="https://cdn.teller.io/connect/connect.js"
        onLoad={() => setReady(true)}
      />
      <button
        type="button"
        onClick={open}
        disabled={!ready || pending || !applicationId}
        className="btn-primary disabled:opacity-50"
        title={!applicationId ? "Set TELLER_APPLICATION_ID in .env" : undefined}
      >
        {pending ? "Linking…" : "⚡ Link a bank"}
      </button>
      {message && <p className="mt-2 text-xs text-ink-muted">{message}</p>}
    </>
  );
}

export function SyncNowButton() {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const { results } = await syncNow();
            setMessage(summarize(results));
            router.refresh();
          })
        }
        className="btn-ghost disabled:opacity-50"
      >
        {pending ? "Syncing…" : "↻ Sync now"}
      </button>
      {message && <p className="mt-2 text-xs text-ink-muted">{message}</p>}
    </div>
  );
}
