"use client";

import { LogOut } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import type { LogoutButtonProps } from "./types";
import { useLogoutButton } from "./use-logout-button";

export function LogoutButton({ compact = false, className }: LogoutButtonProps) {
  const { isPending, onLogout } = useLogoutButton();

  if (compact) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={isPending}
        onClick={onLogout}
        aria-label="تسجيل الخروج"
        title="تسجيل الخروج"
        className={className}
      >
        <LogOut aria-hidden="true" className="rtl:-scale-x-100" />
      </Button>
    );
  }

  return (
    <Button type="button" disabled={isPending} onClick={onLogout} className={className}>
      تسجيل الخروج
    </Button>
  );
}
