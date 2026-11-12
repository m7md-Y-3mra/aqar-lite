import type { z } from "zod";

import type { loginSchema } from "./auth.schemas";

export type LoginInput = z.infer<typeof loginSchema>;
