"use client";

import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

import { TooltipProvider } from "@/shared/components/ui/tooltip";
import { getQueryClient } from "@/shared/lib/query-client";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={getQueryClient()}>
      <TooltipProvider>{children}</TooltipProvider>
      <Toaster dir="rtl" position="top-center" richColors />
    </QueryClientProvider>
  );
}
