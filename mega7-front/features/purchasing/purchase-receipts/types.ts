export type PurchaseOrderOpen = {
  id: number;
  docNumber: string;
  orderDate: string;
  supplierName: string;
  supplierId: number;
  warehouseId: number;
  status: string;
};

export type ProductMini = {
  id: number;
  code: string;
  name: string;
  isBatchManaged?: boolean;
  isSerialManaged?: boolean;
};

export type PendingLine = {
  id: number; // PurchaseOrderLineId
  productId: number;
  productCode: string;
  productName: string;
  orderedQty: number;
  receivedQty: number;
  pendingQty: number;
  unitPrice: number;
  discountPercent: number;
  taxId: number | null;
  taxRate: number;
};

export type PendingDoc = {
  id: number;
  docNumber: string;
  orderDate: string;
  supplierId: number;
  supplierName: string;
  warehouseId: number;
  warehouseName?: string | null;
  lines: PendingLine[];
};

export type ReceiptLineDraft = {
  poLineId: number;
  productId: number;
  productName: string;
  pendingQty: number;

  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxId: number | null;

  batchNumber: string;
  expirationDate: string; // yyyy-mm-dd
  serialNumbers: string;  // csv/multi
};

export type ReceiptDraft = {
  purchaseOrderId: number | null;
  receiptDate: string; // yyyy-mm-dd
  comments: string;

  attachDocs: boolean;
  deliveryNoteNumber: string;
  deliveryNoteDate: string;
  invoiceNumber: string;
  invoiceDate: string;

  pendingDoc: PendingDoc | null;
  lines: ReceiptLineDraft[];
};

// ── Direct receipt (sin OC) ──────────────────────────────────────────────────

export type SupplierMini = {
  id: number;
  razonSocial: string;
};

export type WarehouseMini = {
  id: number;
  name: string;
};

export type DirectReceiptLineDraft = {
  _id: number; // local key
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxId: number | null;
  batchNumber: string;
  expirationDate: string;
  serialNumbers: string;
  isBatch: boolean;
  isSerial: boolean;
};

export type CreateDirectReceiptPayload = {
  supplierId: number;
  warehouseId: number;
  receiptDate: string;
  comments?: string | null;
  directLines: Array<{
    productId: number;
    quantity: number;
    unitPrice: number;
    discountPercent: number;
    taxId?: number | null;
    batchNumber?: string | null;
    expirationDate?: string | null;
    serialNumbers?: string | null;
  }>;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  invoiceDueDate?: string | null;
  isCredit?: boolean;
  creditTermId?: number | null;
};

export type CreateReceiptPayload = {
  purchaseOrderId: number;
  receiptDate: string; // ISO
  comments?: string | null;
  documents?: Array<{ type: "DELIVERY_NOTE" | "INVOICE"; number: string; date?: string | null }>;
  lines: Array<{
    purchaseOrderLineId: number;
    quantity: number;
    unitPrice: number;
    discountPercent: number;
    taxId?: number | null;
    batchNumber?: string | null;
    expirationDate?: string | null;
    serialNumbers?: string | null;
  }>;
};
