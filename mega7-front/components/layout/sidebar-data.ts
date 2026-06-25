import {
  Home,
  Boxes,
  List,
  Package,
  Tags,
  Warehouse,
  QrCode,
  ArrowDown,
  ArrowUp,
  ArrowLeftRight,
  BookOpen,
  User,
  Coins,
  ShoppingCart,
  ClipboardList,
  Truck,
  Settings,
  Landmark,
  CalendarMinus2,
  ReceiptText,
  CircleDollarSignIcon,
  Handshake,
  BanknoteArrowDown,
  BanknoteArrowUp,
  BanknoteArrowDownIcon,
  FileText,
  Users,
  Shield,
  Percent,
  CalendarClock,
  BookMarked,
  Settings2,
} from "lucide-react";

export type MenuItem = {
  title: string;
  isSection?: boolean;
  adminOnly?: boolean;
  icon?: any;
  color?: string;
  href?: string;
  children?: { title: string; href: string; icon: any }[];
};

export const menu: MenuItem[] = [
  {
    title: "Dashboard",
    icon: Home,
    color: "text-green-600",
    href: "/dashboard",
  },

  {
    title: "Finanzas",
    icon: Coins,
    color: "text-blue-600",
    children: [
      { title: "Manejo Cajas", href: "/finance/cash-boxes", icon: Boxes },
      { title: "Periodos Contables", href: "/periods", icon: ClipboardList },
    ],
  },

  {
    title: "Bancos y Tesorería",
    icon: Landmark,
    color: "text-red-600",
    children: [
      { title: "Bancos", href: "/banks", icon: Landmark },
      { title: "Depositos", href: "/banks/deposits", icon: BanknoteArrowDownIcon },
    ],
  },

  {
    title: "Compras",
    icon: ShoppingCart,
    color: "text-emerald-600",
    children: [
      { title: "Órdenes de Compra", href: "/purchase-orders", icon: ClipboardList },
      { title: "Recepciones", href: "/purchase-receipts", icon: Truck },
      { title: "Factura Servicios", href: "/ap-invoices/new-service", icon: Truck },
      { title: "Facturas Proveedores x Estado", href: "/ap-invoices", icon: ClipboardList },
    ],
  },

  {
    title: "Ventas",
    icon: Handshake,
    color: "text-orange-600",
    children: [
      { title: "Órdenes de Venta", href: "/sales-orders", icon: ClipboardList },
      { title: "Factura/Entrega Cliente", href: "/sales-invoices", icon: Truck },
      { title: "Facturas Clientes x Estado", href: "/ar-invoices", icon: FileText },
    ],
  },

  {
    title: "Pagos",
    icon: CircleDollarSignIcon,
    color: "text-yellow-500",
    children: [
      { title: "Recibidos", href: "/payments/received", icon: BanknoteArrowDown },
      { title: "Realizados", href: "/payments/made", icon: BanknoteArrowUp },
    ],
  },

  {
    title: "Movimientos",
    icon: ArrowLeftRight,
    color: "text-purple-600",
    children: [
      { title: "Entradas", href: "/stock-entry", icon: ArrowDown },
      { title: "Salidas", href: "/stock-output", icon: ArrowUp },
      { title: "Transferencias", href: "/stock-transfer", icon: ArrowLeftRight },
    ],
  },

  // ── Contabilidad ────────────────────────────────────────────────────────────
  {
    title: "Contabilidad",
    isSection: true,
  },

  {
    title: "Contabilidad",
    icon: BookMarked,
    color: "text-emerald-600",
    children: [
      { title: "Plan de Cuentas",      href: "/accounting/accounts", icon: BookMarked },
      { title: "Libro Diario",         href: "/accounting/journal",  icon: BookOpen   },
      { title: "Config. Contable",     href: "/accounting/config",   icon: Settings2  },
    ],
  },

  // ── Datos Maestros ──────────────────────────────────────────────────────────
  {
    title: "Datos Maestros",
    isSection: true,
  },

  {
    title: "Parametros",
    icon: Settings,
    color: "text-purple-600",
    children: [
      { title: "Ventas", href: "/settings/sales-params", icon: Coins },
      { title: "Series fiscales", href: "/fiscal-document-series", icon: ReceiptText },
      { title: "Conceptos de Pagos", href: "/settings/payment-concepts", icon: ReceiptText },
      { title: "Impuestos", href: "/settings/taxes", icon: Percent },
      { title: "Condiciones de Crédito", href: "/settings/credit-terms", icon: CalendarClock },
    ],
  },

  {
    title: "Inventario",
    icon: Boxes,
    color: "text-blue-600",
    children: [
      { title: "Productos", href: "/products", icon: Package },
      { title: "Categorías", href: "/categories", icon: List },
      { title: "Subcategorías", href: "/subcategories", icon: Tags },
      { title: "Unidades", href: "/units", icon: Package },
      { title: "Marcas", href: "/brands", icon: Package },
      { title: "Almacenes", href: "/warehouses", icon: Warehouse },
      { title: "Lotes / Series", href: "/batches", icon: QrCode },
    ],
  },

  {
    title: "Socios de Negocio",
    icon: User,
    color: "text-red-600",
    children: [
      { title: "Clientes", href: "/socios-negocio/clientes", icon: User },
      { title: "Cuotero Clientes", href: "/socios-negocio/clientes/cuotas", icon: CalendarMinus2 },
      { title: "Proveedores", href: "/socios-negocio/proveedores", icon: User },
    ],
  },

  // ── Administración (solo ADMIN) ────────────────────────────────────────────
  {
    title: "Administración",
    isSection: true,
    adminOnly: true,
  },

  {
    title: "Usuarios",
    icon: Users,
    color: "text-gray-600",
    href: "/users",
    adminOnly: true,
  },

  {
    title: "Permisos",
    icon: Shield,
    color: "text-gray-600",
    href: "/settings/permissions",
    adminOnly: true,
  },
];
