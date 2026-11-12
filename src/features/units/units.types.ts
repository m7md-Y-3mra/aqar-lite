import type { z } from "zod";

import type { Page } from "@/shared/lib/pagination";
import type { unitInputSchema, unitListQuerySchema, unitSchema } from "./units.schemas";

export type UnitDto = z.infer<typeof unitSchema>;
export type UnitInput = z.infer<typeof unitInputSchema>;
export type UnitListQuery = z.infer<typeof unitListQuerySchema>;
export type UnitPage = Page<UnitDto>;
