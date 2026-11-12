"use client";

import { Button } from "@/shared/components/ui/button";
import { useLogoutButton } from "./use-logout-button";

export function LogoutButton() {
  const { isPending, onLogout } = useLogoutButton();

  return (
    <Button type="button" disabled={isPending} onClick={onLogout}>
      تسجيل الخروج
    </Button>
  );
}
