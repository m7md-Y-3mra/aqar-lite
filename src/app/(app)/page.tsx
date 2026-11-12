import { requireUser } from "@/server/auth/require-user";
import { toShellUser } from "@/server/auth/session.service";
import { HomeWelcome } from "@/shared/components/home-welcome";

export default async function HomePage() {
  const user = await requireUser();

  return <HomeWelcome user={toShellUser(user)} />;
}
