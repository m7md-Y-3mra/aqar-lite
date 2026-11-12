"use client";

import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { useLoginForm } from "./use-login-form";

export function LoginForm() {
  const { register, errors, isPending, onSubmit } = useLoginForm();

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">عقار لايت</CardTitle>
        <CardDescription>سجّل الدخول للوصول إلى حسابك</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-5" method="post" noValidate onSubmit={onSubmit}>
          {errors.root?.message ? (
            <div
              className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {errors.root.message}
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">البريد الإلكتروني</Label>
            <Input
              id="email"
              type="email"
              dir="ltr"
              autoComplete="username"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "email-error" : undefined}
              {...register("email")}
            />
            {errors.email?.message ? (
              <p id="email-error" className="text-sm text-destructive">
                {errors.email.message}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="password">كلمة المرور</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "password-error" : undefined}
              {...register("password")}
            />
            {errors.password?.message ? (
              <p id="password-error" className="text-sm text-destructive">
                {errors.password.message}
              </p>
            ) : null}
          </div>

          <Button className="w-full" type="submit" disabled={isPending}>
            {isPending ? "جارٍ تسجيل الدخول…" : "تسجيل الدخول"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
