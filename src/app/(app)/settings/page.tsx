import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { householdInvites, householdMembers } from "@/db/schema";
import { getHouseholdContext } from "@/lib/session";
import { renameHousehold, revokeInvite } from "@/lib/actions/household";
import { InviteForm } from "@/components/invite-form";
import { formatDate } from "@/lib/format";

export default async function SettingsPage() {
  const ctx = await getHouseholdContext();

  const [members, invites] = await Promise.all([
    db.query.householdMembers.findMany({
      where: eq(householdMembers.householdId, ctx.householdId),
      with: { user: true },
    }),
    db.query.householdInvites.findMany({
      where: and(
        eq(householdInvites.householdId, ctx.householdId),
        eq(householdInvites.status, "pending")
      ),
    }),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <header className="fade-up">
        <h1 className="text-xl font-semibold tracking-tight">Household</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Manage your shared workspace and who's in it.
        </p>
      </header>

      <section className="card fade-up fade-up-1 p-6">
        <h2 className="mb-4 text-sm font-semibold">Household name</h2>
        <form action={renameHousehold} className="flex gap-3">
          <input
            name="name"
            defaultValue={ctx.householdName}
            required
            className="input"
          />
          <button type="submit" className="btn-ghost shrink-0">
            Save
          </button>
        </form>
      </section>

      <section className="card fade-up fade-up-2 p-6">
        <h2 className="mb-4 text-sm font-semibold">Members</h2>
        <ul className="space-y-3">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-raised text-sm font-medium">
                  {m.user.name.charAt(0).toUpperCase()}
                </span>
                <div>
                  <p className="text-sm font-medium">
                    {m.user.name}
                    {m.userId === ctx.userId && (
                      <span className="text-ink-faint"> (you)</span>
                    )}
                  </p>
                  <p className="text-xs text-ink-muted">{m.user.email}</p>
                </div>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide ${
                  m.role === "owner"
                    ? "bg-pos-dim text-pos"
                    : "border border-edge text-ink-muted"
                }`}
              >
                {m.role}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {members.length < 2 && (
        <section className="card fade-up fade-up-3 p-6">
          <h2 className="mb-1 text-sm font-semibold">Invite your partner</h2>
          <p className="mb-4 text-xs text-ink-muted">
            They'll see the same accounts, transactions, and bills — one shared
            picture of your money. When they sign up with this email, they'll
            join automatically.
          </p>
          <InviteForm />
        </section>
      )}

      {invites.length > 0 && (
        <section className="card fade-up fade-up-3 p-6">
          <h2 className="mb-4 text-sm font-semibold">Pending invites</h2>
          <ul className="space-y-3">
            {invites.map((invite) => (
              <li key={invite.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm">{invite.email}</p>
                  <p className="text-xs text-ink-faint">
                    Invited {formatDate(invite.createdAt)}
                  </p>
                </div>
                <form action={revokeInvite}>
                  <input type="hidden" name="inviteId" value={invite.id} />
                  <button
                    type="submit"
                    className="text-xs text-ink-faint transition-colors hover:text-neg"
                  >
                    Revoke
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
