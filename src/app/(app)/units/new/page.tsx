import { redirect } from "next/navigation";

import { UnitForm } from "@/features/units/client/unit-form";
import { requireUser } from "@/server/auth/require-user";

export default async function NewUnitRoute() {
  const user = await requireUser();
  if (user.role !== "MANAGER") redirect("/units");

  return <UnitForm mode="create" />;
}
