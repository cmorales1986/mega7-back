"use client";

import { useDrawers } from "./useDrawers";

export function DrawerOverlay() {
  const { isOpen, close } = useDrawers();

  return (
    <div
      aria-hidden={!isOpen}
      onClick={close}
      className={`
        fixed inset-0 z-[1100]
        bg-black/30 backdrop-blur-[2px]
        transition-opacity duration-200
        ${isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}
      `}
    />
  );
}
