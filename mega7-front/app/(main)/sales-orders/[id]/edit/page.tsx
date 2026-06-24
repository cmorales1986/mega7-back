"use client";

import { useParams, useRouter } from "next/navigation";
import SalesOrderForm from "../../_components/SalesOrderForm";

export default function EditSalesOrderPage() {
  const params = useParams();
  const router = useRouter();

  const id = Number((params as any)?.id);

  return (
    <SalesOrderForm
      mode="edit"
      editingId={id}
      onSaved={() => router.push("/sales-orders")}
      onCancel={() => router.push("/sales-orders")}
    />
  );
}
