"use client";

import { Menu } from "lucide-react";

import { useCurrentUser } from "@/shared/components/current-user";
import { LogoutButton } from "@/shared/components/logout-button";
import { Button } from "@/shared/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/shared/components/ui/sheet";
import { ROLE_LABELS } from "@/shared/lib/roles";
import { NavMenu } from "./components/nav-menu";
import { useAppShell } from "./use-app-shell";

export function AppShell({ children }: { children: React.ReactNode }) {
  const user = useCurrentUser();
  const { isOpen, setIsOpen, closeMenu } = useAppShell();

  return (
    <div className="flex min-h-screen min-w-0 flex-col bg-background text-foreground">
      <header className="flex min-w-0 flex-wrap items-center gap-4 border-b px-4 py-4 md:px-6">
        <div className="md:hidden">
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="القائمة"
                aria-expanded={isOpen}
                aria-controls="app-shell-mobile-menu"
              >
                <Menu aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent
              id="app-shell-mobile-menu"
              side="right"
              dir="rtl"
              showCloseButton={false}
              aria-describedby={undefined}
              className="overflow-y-auto"
            >
              <SheetHeader className="flex-row items-center justify-between gap-2">
                <SheetTitle>القائمة</SheetTitle>
                <SheetClose asChild>
                  <Button type="button" variant="ghost" aria-label="إغلاق القائمة">
                    إغلاق
                  </Button>
                </SheetClose>
              </SheetHeader>
              <div className="px-4 pb-4">
                <NavMenu role={user.role} onNavigate={closeMenu} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
        <div className="min-w-0 flex-1 basis-40 [overflow-wrap:anywhere]">
          <p className="text-xl font-bold">عقار لايت</p>
          <p className="text-sm text-muted-foreground">{user.companyName}</p>
        </div>
        <div className="min-w-0 flex-1 basis-40 [overflow-wrap:anywhere]">
          <p className="font-medium">{user.name}</p>
          <p className="text-sm text-muted-foreground">{ROLE_LABELS[user.role]}</p>
        </div>
        <LogoutButton />
      </header>
      <div className="flex min-w-0 flex-1">
        <aside className="hidden w-60 shrink-0 border-e p-4 md:block">
          <NavMenu role={user.role} />
        </aside>
        <main className="min-w-0 flex-1 [overflow-wrap:anywhere]">{children}</main>
      </div>
    </div>
  );
}
