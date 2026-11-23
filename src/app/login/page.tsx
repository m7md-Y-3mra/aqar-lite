import { redirect } from "next/navigation";

import { LoginForm } from "@/features/auth/client/login-form";
import { getCurrentUser } from "@/server/auth/require-user";
import { BrandMark } from "@/shared/components/brand-mark";

export default async function LoginPage() {
  // The one page for visitors without a session, so it uses getCurrentUser() instead of requireUser().
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-12">
      <BrandMark className="size-12 rounded-xl text-2xl" />
      <LoginForm />
    </main>
  );
}
