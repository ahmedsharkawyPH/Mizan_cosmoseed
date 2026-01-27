
import { LucideIcon, LayoutDashboard, ShoppingCart, Package, Users, FileText, Settings, CreditCard } from 'lucide-react';

export const APP_NAME = "Mizan Online";
export const CURRENCY = "LE";

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'New Invoice', path: '/invoice/new', icon: ShoppingCart },
  { label: 'Invoices', path: '/invoices', icon: FileText },
  { label: 'Inventory', path: '/inventory', icon: Package },
  { label: 'Customers', path: '/customers', icon: Users },
  { label: 'Cash Register', path: '/cash', icon: CreditCard },
  { label: 'Settings', path: '/settings', icon: Settings },
];
