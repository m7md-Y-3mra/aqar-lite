import { z } from "zod";

import { paginationFields } from "@/shared/lib/pagination";

export const reservationSchema = z.object({
  unitId: z.uuid({ error: "اختر وحدة صحيحة" }),
  clientId: z.uuid({ error: "اختر عميلاً" }),
});

export const reserveInputSchema = reservationSchema.pick({ unitId: true, clientId: true });

export const reservationListQuerySchema = z.object({ ...paginationFields });

export const reserveOptionsQuerySchema = reservationSchema.pick({ unitId: true });
