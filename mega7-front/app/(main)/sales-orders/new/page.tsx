"use client";

import { useRouter } from "next/navigation";
import SalesOrderForm from "../_components/SalesOrderForm";

export default function NewSalesOrderPage() {
  const router = useRouter();

  return (
    <SalesOrderForm
      mode="create"
      onSaved={(id) => router.push(id ? `/sales-orders/${id}/edit` : "/sales-orders")}
      onCancel={() => router.push("/sales-orders")}
    />
  );
}
