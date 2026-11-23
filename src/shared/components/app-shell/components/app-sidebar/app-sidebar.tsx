"use client";

import { BrandMark } from "@/shared/components/brand-mark";
import { useCurrentUser } from "@/shared/components/current-user";
import { LogoutButton } from "@/shared/components/logout-button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/shared/components/ui/sidebar";
import { ROLE_LABELS } from "@/shared/lib/roles";
import { NavMenu } from "../nav-menu";

export function AppSidebar() {
  const user = useCurrentUser();

  return (
    <Sidebar side="right" collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex h-12 items-center gap-3 px-0.5">
          <BrandMark />
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate font-bold">عقار لايت</p>
            <p className="truncate text-xs text-sidebar-foreground/70">{user.companyName}</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavMenu role={user.role} />
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-0.5 group-data-[collapsible=icon]:flex-col">
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-sm font-bold group-data-[collapsible=icon]:hidden"
          >
            {user.name.trim().charAt(0)}
          </span>
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-sidebar-foreground/70">{ROLE_LABELS[user.role]}</p>
          </div>
          <LogoutButton
            compact
            className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
