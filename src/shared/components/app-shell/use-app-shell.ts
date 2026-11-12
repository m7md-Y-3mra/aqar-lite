"use client";

import { useState } from "react";

export function useAppShell() {
  const [isOpen, setIsOpen] = useState(false);

  return { isOpen, setIsOpen, closeMenu: () => setIsOpen(false) };
}
