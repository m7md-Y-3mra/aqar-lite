"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/shared/components/ui/sidebar";
import { navIconFor } from "@/shared/lib/nav-icons";
import { isActiveNavPath, navItemsFor } from "@/shared/lib/navigation";
import type { Role } from "@/shared/lib/roles";

// Sand bar on the start edge of the active item.
const ACTIVE_MARKER =
  "relative h-10 data-active:before:absolute data-active:before:inset-y-2 data-active:before:start-0 data-active:before:w-[3px] data-active:before:rounded-full data-active:before:bg-sidebar-primary";

export function NavMenu({ role }: { role: Role }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <nav aria-label="التنقل الرئيسي">
          <SidebarMenu className="gap-1">
            {navItemsFor(role).map((item) => {
              const Icon = navIconFor(item.href);
              const active = isActiveNavPath(pathname, item.href);
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={active}
                    tooltip={{ children: item.label, side: "left" }}
                    className={ACTIVE_MARKER}
                  >
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setOpenMobile(false)}
                    >
                      <Icon aria-hidden="true" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </nav>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
