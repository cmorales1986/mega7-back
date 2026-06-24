import PurchaseOrderForm from "../../_components/PurchaseOrderForm";

export default function EditPurchaseOrderPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  return <PurchaseOrderForm editingId={id} />;
}
