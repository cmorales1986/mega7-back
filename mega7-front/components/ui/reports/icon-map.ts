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
  Warehouse,
  BarChart3,
  CalendarCheck,
  TrendingUp,
  AlertTriangle,
  Scale,
  BookText,
  Layers,
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
  Warehouse,
  BarChart3,
  CalendarCheck,
  TrendingUp,
  AlertTriangle,
  Scale,
  BookText,
  Layers,
};

export function getLucideIcon(name?: string | null) {
  if (!name) return null;
  return iconMap[name] ?? null;
}
