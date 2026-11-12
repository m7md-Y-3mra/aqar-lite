import type { ShellUser } from "@/shared/components/current-user";
import { ROLE_LABELS } from "@/shared/lib/roles";

export function HomeWelcome({ user }: { user: ShellUser }) {
  return (
    <section className="mx-auto flex max-w-3xl flex-col justify-center gap-3 px-6 py-12 text-start">
      <h1 className="text-3xl font-bold">مرحبًا، {user.name}</h1>
      <p className="text-lg text-muted-foreground">{ROLE_LABELS[user.role]}</p>
      <p className="text-muted-foreground">{user.companyName}</p>
    </section>
  );
}
