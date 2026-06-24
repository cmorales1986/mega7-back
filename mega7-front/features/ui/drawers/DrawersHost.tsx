"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { DrawerOverlay } from "./DrawerOverlay";
import { BottomDrawer } from "./BottomDrawer";
import { RightDrawer } from "./RightDrawer";
import { PriceSimulator } from "./PriceSimulator";
import { ReportsPanel } from "./ReportsPanel";

export function DrawersHost() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <>
      <DrawerOverlay />

      <BottomDrawer>
        <PriceSimulator />
      </BottomDrawer>

      <RightDrawer>
        <ReportsPanel />
      </RightDrawer>
    </>,
    document.body
  );
}
