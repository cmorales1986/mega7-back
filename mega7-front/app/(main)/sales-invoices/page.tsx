"use client";

import { Suspense } from "react";
import SalesInvoicesInner from "./SalesInvoicesInner";

export default function SalesInvoicesPage() {
  return (
    <Suspense fallback={<div />}>
      <SalesInvoicesInner />
    </Suspense>
  );
}
