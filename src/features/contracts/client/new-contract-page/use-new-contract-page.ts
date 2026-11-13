"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { contractOptionsOptions } from "../contracts.queries";

export function useNewContractPage(reservationId: string) {
  const query = useQuery(contractOptionsOptions(reservationId));
  // Wait for a client instant check before exposing the form; SSR stays deterministic.
  const [expiry, setExpiry] = useState<{ expiresAt: string; expired: boolean } | null>(null);
  const expiresAt = query.data?.reservation.expiresAt;
  useEffect(() => {
    if (!expiresAt) return;
    const check = () => setExpiry({
      expiresAt,
      expired: new Date(expiresAt).getTime() <= Date.now(),
    });
    const initialTimer = setTimeout(check, 0);
    const expiryTimer = setTimeout(check, Math.max(0, new Date(expiresAt).getTime() - Date.now()));
    return () => {
      clearTimeout(initialTimer);
      clearTimeout(expiryTimer);
    };
  }, [expiresAt]);
  return {
    query,
    expiryChecked: expiry?.expiresAt === expiresAt && expiry !== null,
    expired: expiry?.expiresAt === expiresAt && expiry?.expired === true,
  };
}
