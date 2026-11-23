"use client";

import { useCurrentUser } from "@/shared/components/current-user";
import { Separator } from "@/shared/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/shared/components/ui/sidebar";
import { AppSidebar } from "./components/app-sidebar";
import type { AppShellProps } from "./types";

export function AppShell({ defaultOpen, children }: AppShellProps) {
  const user = useCurrentUser();

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur md:px-6">
          <SidebarTrigger className="-ms-1" />
          <Separator orientation="vertical" className="h-5 self-center" />
          <p className="truncate text-sm font-medium text-muted-foreground">{user.companyName}</p>
        </header>
        <div className="mx-auto w-full max-w-7xl min-w-0 flex-1 px-4 py-6 [overflow-wrap:anywhere] md:px-8 md:py-8">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
