"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { loginSchema } from "@/features/auth/auth.schemas";
import type { LoginInput } from "@/features/auth/auth.types";
import { getQueryClient } from "@/shared/lib/query-client";

type LoginError = {
  code?: string;
  fieldErrors?: Record<string, string[]>;
};

async function requestLogin(input: LoginInput): Promise<void> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = (await response.json()) as { error?: LoginError };

  if (!response.ok) throw body.error ?? {};
}

export function useLoginForm() {
  const router = useRouter();
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const mutation = useMutation({
    mutationFn: requestLogin,
    onSuccess: () => {
      getQueryClient().clear();
      router.replace("/");
      router.refresh();
    },
    onError: (error: LoginError) => {
      if (error.code === "VALIDATION_ERROR" && error.fieldErrors) {
        for (const field of ["email", "password"] as const) {
          const message = error.fieldErrors[field]?.[0];
          if (message) form.setError(field, { type: "server", message });
        }
        return;
      }

      form.setError("root", {
        type: "server",
        message:
          error.code === "INVALID_CREDENTIALS"
            ? "البريد الإلكتروني أو كلمة المرور غير صحيحة"
            : "تعذر تسجيل الدخول، حاول مرة أخرى",
      });
    },
  });

  return {
    register: form.register,
    errors: form.formState.errors,
    isPending: mutation.isPending,
    onSubmit: form.handleSubmit((input) => {
      if (!mutation.isPending) mutation.mutate(input);
    }),
  };
}
