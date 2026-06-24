import {
  House,
  Package,
  BookOpen,
  FileBarChart2,
  HandCoins,
  ReceiptText,
  ArrowRight,
  FileText,
  LayoutGrid,
  Warehouse
} from "lucide-react";

const iconMap: Record<string, any> = {
  House,
  Package,
  BookOpen,
  FileBarChart2,
  HandCoins,
  ReceiptText,
  ArrowRight,
  FileText,
  LayoutGrid,
  Warehouse
};

export function getLucideIcon(name?: string | null) {
  if (!name) return null;
  return iconMap[name] ?? null;
}