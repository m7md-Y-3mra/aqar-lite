import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import type { ShellUser } from "@/shared/components/current-user";
import { navIconFor } from "@/shared/lib/nav-icons";
import { navItemsFor } from "@/shared/lib/navigation";
import { ROLE_LABELS } from "@/shared/lib/roles";
import { SECTION_DESCRIPTIONS } from "./constants";

export function HomeWelcome({ user }: { user: ShellUser }) {
  const sections = navItemsFor(user.role).filter((item) => item.href !== "/");

  return (
    <section className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">مرحبًا، {user.name}</h1>
        <p className="text-muted-foreground">
          {ROLE_LABELS[user.role]} · {user.companyName}
        </p>
      </div>
      <nav aria-label="الأقسام">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((item) => {
            const Icon = navIconFor(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="group flex h-full items-center gap-4 rounded-xl border bg-card p-5 shadow-xs transition-colors hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{item.label}</span>
                    <span className="block text-sm text-muted-foreground">
                      {SECTION_DESCRIPTIONS[item.href]}
                    </span>
                  </span>
                  <ChevronLeft
                    aria-hidden="true"
                    className="size-4 text-muted-foreground transition-transform group-hover:-translate-x-0.5"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </section>
  );
}
