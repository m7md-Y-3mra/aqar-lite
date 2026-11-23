import { cookies } from "next/headers";

import { requireUser } from "@/server/auth/require-user";
import { toShellUser } from "@/server/auth/session.service";
import { AppShell } from "@/shared/components/app-shell";
import { CurrentUserProvider } from "@/shared/components/current-user";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // The sidebar writes this cookie when it opens or collapses, so a reload keeps its state.
  const sidebarOpen = (await cookies()).get("sidebar_state")?.value !== "false";

  return (
    <CurrentUserProvider user={toShellUser(user)}>
      <AppShell defaultOpen={sidebarOpen}>{children}</AppShell>
    </CurrentUserProvider>
  );
}
