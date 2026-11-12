import type { z } from "zod";

import type { Page } from "@/shared/lib/pagination";
import type { clientInputSchema, clientListQuerySchema } from "./clients.schemas";

export type ClientDto = {
  id: string;
  name: string;
  phone: string;
  notes: string | null;
  salesRep: { id: string; name: string };
};
export type ClientInput = z.infer<typeof clientInputSchema>;
export type ClientListQuery = z.infer<typeof clientListQuerySchema>;
export type ClientPage = Page<ClientDto>;
