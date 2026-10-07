import type { AdminRole } from '../data/db';

export const roleDescriptions: Record<AdminRole, string> = {
  main: 'Full access, including settings and admin management.',
  sub_admin: 'General operations access without settings or admin management.',
  manager: 'Projects, customers, employees, reviews, and reports.',
  project_manager: 'Projects, task templates, corrections, approvals, and reports.',
  finance: 'Finance, projects, customers, and reports.',
  sales_manager: 'Projects, new projects, customers, and reports.',
  relationship_manager: 'Customers, projects, corrections, and customer feedback.',
  custom: 'Choose exactly which modules this admin can open.',
};

const allAdminMenus = [
  'admin-dashboard',
  'projects',
  'new-project',
  'customers',
  'employees',
  'task-templates',
  'corrections',
  'order-tracking',
  'reports',
  'finance',
  'settings',
  'profile',
  'rating-dashboard',
  'rating-questions',
  'customer-reviews',
  'employee-ratings',
  'system-ratings',
  'rating-reports',
];

const roleMenus: Record<Exclude<AdminRole, 'main' | 'custom'>, string[]> = {
  sub_admin: allAdminMenus.filter((key) => !['settings', 'admins'].includes(key)),
  manager: ['admin-dashboard', 'projects', 'new-project', 'customers', 'employees', 'task-templates', 'corrections', 'order-tracking', 'reports', 'profile'],
  project_manager: ['admin-dashboard', 'projects', 'new-project', 'task-templates', 'corrections', 'order-tracking', 'reports', 'profile'],
  finance: ['admin-dashboard', 'projects', 'customers', 'reports', 'finance', 'profile'],
  sales_manager: ['admin-dashboard', 'projects', 'new-project', 'customers', 'reports', 'profile'],
  relationship_manager: ['admin-dashboard', 'projects', 'customers', 'corrections', 'customer-reviews', 'customer-feedback', 'profile'],
};

export function getDefaultAllowedMenus(role: AdminRole): string[] | null {
  if (role === 'main') return null;
  if (role === 'custom') return [];
  return roleMenus[role];
}

export function getRoleMenuCount(role: AdminRole): number | 'All' {
  const menus = getDefaultAllowedMenus(role);
  return menus === null ? 'All' : menus.length;
}

export { allAdminMenus };
