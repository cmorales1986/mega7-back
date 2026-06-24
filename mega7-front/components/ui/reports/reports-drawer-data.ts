import {
  Package,
  BookOpen,
  FileBarChart2,
  HandCoins,
  ReceiptText,
} from "lucide-react";

export type ReportItem = {
  title: string;
  href: string;
  icon?: any;
};

export type ReportGroup = {
  title: string;
  items: ReportItem[];
};

export const reportsDrawerMenu: ReportGroup[] = [
  {
    title: "Inventario",
    items: [
      { title: "Stock Actual", href: "/reports/inventario/stock-actual", icon: Package },
      { title: "Kardex", href: "/reports/inventario/kardex", icon: BookOpen },
    ],
  },
  {
    title: "Ventas",
    items: [
      { title: "Ventas 1", href: "/reports/ventas/ventas-1", icon: FileBarChart2 },
      { title: "Ventas 2", href: "/reports/ventas/ventas-2", icon: FileBarChart2 },
    ],
  },
  {
    title: "Cobranzas",
    items: [
      { title: "Cobranzas 1", href: "/reports/cobranzas/cobranzas-1", icon: HandCoins },
      { title: "Cobranzas 2", href: "/reports/cobranzas/cobranzas-2", icon: ReceiptText },
    ],
  },
];
