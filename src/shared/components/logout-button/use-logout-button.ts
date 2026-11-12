"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { getQueryClient } from "@/shared/lib/query-client";

async function requestLogout(): Promise<void> {
  const response = await fetch("/api/auth/logout", { method: "POST" });
  const body = (await response.json()) as { error?: { code?: string } };
  if (body.error || !response.ok) throw body.error ?? new Error("Logout failed");
}

export function useLogoutButton() {
  const router = useRouter();
  const mutation = useMutation({
    mutationFn: requestLogout,
    onSuccess: () => {
      getQueryClient().clear();
      router.replace("/login");
      router.refresh();
    },
    onError: () => {
      toast.error("تعذر تسجيل الخروج، حاول مرة أخرى");
    },
  });

  return {
    isPending: mutation.isPending,
    onLogout: () => {
      if (!mutation.isPending) mutation.mutate();
    },
  };
}
