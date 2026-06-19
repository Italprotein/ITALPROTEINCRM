import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, Building2, Users, Workflow, FlaskConical, Truck, MessageSquareText,
  FolderKanban, Boxes, FileSignature, Receipt, Activity, ListChecks, Calendar, Mail,
  BarChart3, Bell, UserPlus, UserCog, FileSpreadsheet, Settings, ScrollText, FileText, LifeBuoy, Handshake,
} from 'lucide-react';
import type { InternalSection, PortalSection } from '@/lib/permissions';

export interface NavItem<S = InternalSection | PortalSection> {
  section: S;
  href: string;
  /** i18n key under the Nav / PortalNav namespace. */
  labelKey: string;
  icon: LucideIcon;
}

export interface NavGroup {
  labelKey?: string;
  items: NavItem<InternalSection>[];
}

/** Internal CRM navigation, grouped. Filtered by `canView(role, section)`. */
export const INTERNAL_NAV: NavGroup[] = [
  {
    items: [{ section: 'overview', href: '/admin', labelKey: 'overview', icon: LayoutDashboard }],
  },
  {
    labelKey: 'group_commercial',
    items: [
      { section: 'companies', href: '/admin/companies', labelKey: 'companies', icon: Building2 },
      { section: 'agencies', href: '/admin/agencies', labelKey: 'agencies', icon: Handshake },
      { section: 'contacts', href: '/admin/contacts', labelKey: 'contacts', icon: Users },
      { section: 'pipeline', href: '/admin/pipeline', labelKey: 'pipeline', icon: Workflow },
    ],
  },
  {
    labelKey: 'group_operations',
    items: [
      { section: 'samples', href: '/admin/samples', labelKey: 'samples', icon: FlaskConical },
      { section: 'shipments', href: '/admin/shipments', labelKey: 'shipments', icon: Truck },
    ],
  },
  {
    labelKey: 'group_technical',
    items: [
      { section: 'feedback', href: '/admin/feedback', labelKey: 'feedback', icon: MessageSquareText },
      { section: 'projects', href: '/admin/projects', labelKey: 'projects', icon: FolderKanban },
      { section: 'products', href: '/admin/products', labelKey: 'products', icon: Boxes },
    ],
  },
  {
    labelKey: 'group_legal_finance',
    items: [
      { section: 'ndas', href: '/admin/ndas', labelKey: 'ndas', icon: FileSignature },
      { section: 'finance', href: '/admin/finance', labelKey: 'finance', icon: Receipt },
    ],
  },
  {
    labelKey: 'group_productivity',
    items: [
      { section: 'activities', href: '/admin/activities', labelKey: 'activities', icon: Activity },
      { section: 'tasks', href: '/admin/tasks', labelKey: 'tasks', icon: ListChecks },
      { section: 'calendar', href: '/admin/calendar', labelKey: 'calendar', icon: Calendar },
      { section: 'communications', href: '/admin/communications', labelKey: 'communications', icon: Mail },
    ],
  },
  {
    labelKey: 'group_insights',
    items: [
      { section: 'analytics', href: '/admin/analytics', labelKey: 'analytics', icon: BarChart3 },
    ],
  },
  {
    labelKey: 'group_admin',
    items: [
      { section: 'notifications', href: '/admin/notifications', labelKey: 'notifications', icon: Bell },
      { section: 'registrations', href: '/admin/registrations', labelKey: 'registrations', icon: UserPlus },
      { section: 'users', href: '/admin/users', labelKey: 'users', icon: UserCog },
      { section: 'import_export', href: '/admin/import-export', labelKey: 'import_export', icon: FileSpreadsheet },
      { section: 'settings', href: '/admin/settings', labelKey: 'settings', icon: Settings },
      { section: 'audit', href: '/admin/audit', labelKey: 'audit', icon: ScrollText },
    ],
  },
];

/** External portal navigation (flat). Filtered by `canView(role, section)`. */
export const PORTAL_NAV: NavItem<PortalSection>[] = [
  { section: 'dashboard', href: '/portal', labelKey: 'dashboard', icon: LayoutDashboard },
  { section: 'profile', href: '/portal/profile', labelKey: 'profile', icon: Building2 },
  { section: 'samples', href: '/portal/samples', labelKey: 'samples', icon: FlaskConical },
  { section: 'feedback', href: '/portal/feedback', labelKey: 'feedback', icon: MessageSquareText },
  { section: 'projects', href: '/portal/projects', labelKey: 'projects', icon: FolderKanban },
  { section: 'documents', href: '/portal/documents', labelKey: 'documents', icon: FileText },
  { section: 'requests', href: '/portal/requests', labelKey: 'requests', icon: LifeBuoy },
  { section: 'notifications', href: '/portal/notifications', labelKey: 'notifications', icon: Bell },
];
