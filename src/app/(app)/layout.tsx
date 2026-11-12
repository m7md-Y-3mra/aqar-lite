import { requireUser } from "@/server/auth/require-user";
import { toShellUser } from "@/server/auth/session.service";
import { CurrentUserProvider } from "@/shared/components/current-user";
import { LogoutButton } from "@/shared/components/logout-button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <CurrentUserProvider user={toShellUser(user)}>
      <LogoutButton />
      {children}
    </CurrentUserProvider>
  );
}
