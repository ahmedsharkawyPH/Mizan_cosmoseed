
import { LucideIcon, LayoutDashboard, ShoppingCart, Package, Users, FileText, Settings, CreditCard } from 'lucide-react';

export const APP_NAME = "Mizan Online";
export const CURRENCY = "$";

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'لوحة التحكم', path: '/', icon: LayoutDashboard },
  { label: 'فاتورة جديدة', path: '/invoice/new', icon: ShoppingCart },
  { label: 'الفواتير', path: '/invoices', icon: FileText },
  { label: 'المخزون', path: '/inventory', icon: Package },
  { label: 'العملاء', path: '/customers', icon: Users },
  { label: 'الخزينة', path: '/cash', icon: CreditCard },
  { label: 'الإعدادات', path: '/settings', icon: Settings },
];
