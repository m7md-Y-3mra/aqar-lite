import { redirect } from "next/navigation";

import { ClientForm } from "@/features/clients/client/client-form";
import { requireUser } from "@/server/auth/require-user";

export default async function NewClientRoute() {
  const user = await requireUser();
  if (user.role !== "SALES") redirect("/clients");

  return <ClientForm mode="create" />;
}
