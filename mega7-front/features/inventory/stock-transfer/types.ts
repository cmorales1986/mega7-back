// src/features/inventory/stock-transfer/types.ts
export type Warehouse = { id: number; name: string; isActive?: boolean };

export type Product = {
  id: number;
  code: string;
  name: string;
  isBatchManaged: boolean;
  isSerialManaged: boolean;
};

export type StockTransferLine = {
  productId: number;
  quantity: number;
  batchNumber?: string | null;
  serialNumbers?: string | null;
  fromWarehouseId: number;
  toWarehouseId: number;
};

export type StockTransferCreatePayload = {
  transferDate: string; // ISO
  fromWarehouseId: number;
  toWarehouseId: number;
  createdBy: string;
  createdAt: string;
  lines: StockTransferLine[];
};

export type StockTransferDetailUI = {
  id: number;
  transferDate: string | null;
  fromWarehouseName: string;
  toWarehouseName: string;
  lines: Array<{
    id: number;
    productId: number;
    productCode: string;
    productName: string;
    quantity: number;
    batchNumber?: string | null;
    serialNumbers?: string | null;
  }>;
};
