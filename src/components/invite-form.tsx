"use client";

import { useActionState } from "react";
import { invitePartner } from "@/lib/actions/household";

export function InviteForm() {
  const [state, formAction, pending] = useActionState(invitePartner, undefined);

  return (
    <form action={formAction} className="space-y-3">
      <div className="flex gap-3">
        <input
          name="email"
          type="email"
          required
          className="input"
          placeholder="partner@example.com"
        />
        <button
          type="submit"
          disabled={pending}
          className="btn-primary shrink-0 disabled:opacity-50"
        >
          {pending ? "Inviting…" : "Invite"}
        </button>
      </div>
      {state?.error && <p className="text-sm text-neg">{state.error}</p>}
      {state?.success && <p className="text-sm text-pos">{state.success}</p>}
    </form>
  );
}
