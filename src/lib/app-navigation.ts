import {
  LayoutDashboard,
  Receipt,
  ArrowLeftRight,
  FileCheck,
  SlidersHorizontal,
  ListTree,
  CalendarClock,
  UserCircle,
  Users,
  FileBox,
  LineChart,
  ShoppingCart,
  FileText,
  ClipboardList,
  Package,
  FileBarChart,
  FileSpreadsheet,
  PieChart,
  TrendingUp,
  Contact2,
  LayoutGrid,
  Settings as SettingsIcon,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export type NavGroup = {
  title: string;
  items: NavItem[];
  collapsible?: boolean;
};

export const navGroups: NavGroup[] = [
  {
    title: "Overview",
    items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Accounting",
    collapsible: true,
    items: [
      { href: "/accounting/bank-transactions", label: "Bank Transactions", icon: ArrowLeftRight },
      { href: "/accounting/integration-transactions", label: "Integrations", icon: FileCheck },
      { href: "/accounting/reconcile", label: "Reconcile", icon: FileCheck },
      { href: "/accounting/rules", label: "Rules", icon: SlidersHorizontal },
      { href: "/accounting/chart-of-accounts", label: "Chart of Accounts", icon: ListTree },
      { href: "/accounting/recurring-transactions", label: "Recurring Transactions", icon: CalendarClock },
      { href: "/accounting/my-accountant", label: "My Accountant", icon: UserCircle },
    ],
  },
  {
    title: "Expenses & Bills",
    collapsible: true,
    items: [
      { href: "/expenses/expense-transactions", label: "Expense Transactions", icon: Receipt },
      { href: "/expenses/suppliers", label: "Suppliers", icon: Users },
      { href: "/expenses/bills", label: "Bills", icon: FileBox },
    ],
  },
  {
    title: "Sales & Get Paid",
    collapsible: true,
    items: [
      { href: "/sales/overview", label: "Overview", icon: LineChart },
      { href: "/sales/sales-transactions", label: "Sales Transactions", icon: ShoppingCart },
      { href: "/sales/invoices", label: "Invoices", icon: FileText },
      { href: "/sales/sales-orders", label: "Sales Orders", icon: ClipboardList },
      { href: "/sales/products-services", label: "Products & Services", icon: Package },
    ],
  },
  {
    title: "Customers & Leads",
    collapsible: true,
    items: [
      { href: "/customers/overview", label: "Overview", icon: LayoutGrid },
      { href: "/customers/list", label: "Customers & Leads", icon: Contact2 },
    ],
  },
  {
    title: "Reports",
    collapsible: true,
    items: [
      { href: "/reports/standard", label: "Standard Reports", icon: FileBarChart },
      { href: "/reports/custom", label: "Custom Reports", icon: FileSpreadsheet },
      { href: "/reports/management", label: "Management Reports", icon: PieChart },
      { href: "/reports/financial-planning", label: "Financial Planning", icon: TrendingUp },
    ],
  },
  {
    title: "System",
    items: [{ href: "/settings", label: "Settings", icon: SettingsIcon }],
  },
];

export function flattenNavItems(groups: NavGroup[] = navGroups): NavItem[] {
  return groups.flatMap((group) => group.items);
}
