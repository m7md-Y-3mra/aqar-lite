import { redirect } from "next/navigation";

import { LoginForm } from "@/features/auth/client/login-form";
import { getCurrentUser } from "@/server/auth/require-user";

export default async function LoginPage() {
  // The one page for visitors without a session, so it uses getCurrentUser() instead of requireUser().
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <LoginForm />
    </main>
  );
}
