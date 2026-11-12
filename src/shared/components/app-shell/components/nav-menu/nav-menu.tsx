"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { navItemsFor } from "@/shared/lib/navigation";
import type { Role } from "@/shared/lib/roles";
import { cn } from "@/shared/lib/utils";

export function NavMenu({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="التنقل الرئيسي">
      <ul className="flex flex-col gap-1">
        {navItemsFor(role).map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
              onClick={onNavigate}
              className={cn(
                "block rounded-md px-4 py-3 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                pathname === item.href && "bg-accent text-accent-foreground",
              )}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
