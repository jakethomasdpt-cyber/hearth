import { Sidebar } from "@/components/sidebar";
import { getHouseholdContext } from "@/lib/session";
import { logout } from "@/lib/actions/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getHouseholdContext();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        householdName={ctx.householdName}
        userName={ctx.userName}
        signOutAction={logout}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-8 py-8 max-md:px-4">{children}</div>
      </main>
    </div>
  );
}
