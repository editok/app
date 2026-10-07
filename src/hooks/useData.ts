import { useAuth, supabase } from '../contexts/AuthContext';
import * as db from '../data/db';
import { useCachedQuery, invalidate } from '../hooks/useCachedQuery';
import { invalidatePattern } from '../data/queryCache';

// ============ Projects ============
export function useProjects() {
  const result = useCachedQuery<db.Project[]>(
    'projects:all',
    () => db.fetchProjects(),
    []
  );
  return { projects: result.data, loading: result.loading, error: result.error, refresh: result.refresh };
}

export function useProject(id: string | undefined) {
  const result = useCachedQuery<db.Project[]>(
    id ? `project:${id}` : null,
    id ? async () => {
      const project = await db.fetchProject(id);
      return project ? [project] : [];
    } : null,
    [id]
  );
  return { project: result.data[0] ?? null, loading: result.loading, error: result.error };
}

// ============ Tasks ============
export function useTasks(projectId: string | undefined) {
  const key = projectId ? `tasks:project:${projectId}` : null;
  const result = useCachedQuery<db.Task[]>(
    key,
    projectId ? () => db.fetchTasks(projectId) : null,
    [projectId]
  );
  return { tasks: result.data, loading: result.loading, error: result.error, refresh: result.refresh };
}

export function useTasksByEmployee(employeeId: string | undefined) {
  const key = employeeId ? `tasks:employee:${employeeId}` : null;
  const result = useCachedQuery<(db.Task & { project?: db.Project })[]>(
    key,
    employeeId ? () => db.fetchTasksByEmployee(employeeId) : null,
    [employeeId]
  );
  return { tasks: result.data, loading: result.loading, error: result.error };
}

// ============ Customers ============
export function useCustomers() {
  const result = useCachedQuery<db.Customer[]>(
    'customers:all',
    () => db.fetchCustomers(),
    []
  );
  return { customers: result.data, loading: result.loading, error: result.error, refresh: result.refresh };
}

// ============ Employees ============
export function useEmployees() {
  const result = useCachedQuery<db.Employee[]>(
    'employees:all',
    () => db.fetchEmployees(),
    []
  );
  return { employees: result.data, loading: result.loading, error: result.error, refresh: result.refresh };
}

// ============ Task Templates ============
export function useTaskTemplates() {
  const result = useCachedQuery<db.TaskTemplate[]>(
    'task_templates:all',
    () => db.fetchTaskTemplates(),
    []
  );
  return { taskTemplates: result.data, loading: result.loading, error: result.error, refresh: result.refresh };
}

// ============ Review Files ============
export function useReviewFiles(projectId: string | undefined) {
  const key = projectId ? `review_files:project:${projectId}` : null;
  const result = useCachedQuery<db.ReviewFile[]>(
    key,
    projectId ? () => db.fetchReviewFiles(projectId) : null,
    [projectId]
  );
  return { reviewFiles: result.data, loading: result.loading, error: result.error };
}

// ============ Comments ============
export function useComments(projectId: string | undefined) {
  const key = projectId ? `comments:project:${projectId}` : null;
  const result = useCachedQuery<db.Comment[]>(
    key,
    projectId ? () => db.fetchComments(projectId) : null,
    [projectId]
  );
  return { comments: result.data, loading: result.loading, error: result.error };
}

// ============ Corrections ============
export function useCorrections() {
  const result = useCachedQuery<db.Correction[]>(
    'corrections:all',
    () => db.fetchCorrections(),
    []
  );
  return { corrections: result.data, loading: result.loading, error: result.error, refresh: result.refresh };
}

export function useCorrectionsByProject(projectId: string | undefined) {
  const key = projectId ? `corrections:project:${projectId}` : null;
  const result = useCachedQuery<db.Correction[]>(
    key,
    projectId ? () => db.fetchCorrectionsByProject(projectId) : null,
    [projectId]
  );
  return { corrections: result.data, loading: result.loading, error: result.error };
}

// ============ Notifications ============
export function useNotificationsData(targetRole: string | null) {
  const key = targetRole ? `notifications:${targetRole}` : null;
  const result = useCachedQuery<db.NotificationRow[]>(
    key,
    targetRole ? () => db.fetchNotifications(targetRole) : null,
    [targetRole]
  );
  return { notifications: result.data, loading: result.loading, error: result.error, refresh: result.refresh };
}

// ============ Payments ============
export function usePayment(projectId: string | undefined) {
  const result = useCachedQuery<db.Payment[]>(
    projectId ? `payment:project:${projectId}` : null,
    projectId ? async () => {
      const payment = await db.fetchPayment(projectId);
      return payment ? [payment] : [];
    } : null,
    [projectId]
  );
  return { payment: result.data[0] ?? null, loading: result.loading };
}

// ============ Current user info helper ============
export function useCurrentUser() {
  const { user, role } = useAuth();
  const email = user?.email || '';
  const name = (user?.user_metadata?.full_name as string) || email;
  return { email, name, role, id: user?.id || '' };
}

// ============ Employee lookup by email ============
export function useEmployeeByEmail(email: string | undefined) {
  const result = useCachedQuery<db.Employee[]>(
    email ? `employee:email:${email}` : null,
    email ? async () => {
      const employee = await supabaseQuery(email);
      return employee ? [employee] : [];
    } : null,
    [email]
  );
  return { employee: result.data[0] ?? null, loading: result.loading };
}

async function supabaseQuery(email: string): Promise<db.Employee | null> {
  if (!supabase) return null;
  const { data } = await supabase.from('employees').select('id, name, email, phone, skills, applications, experience, rating, projects, status, joined, created_at').eq('email', email).maybeSingle();
  return data as db.Employee | null;
}

// ============ Customer lookup by email ============
export function useCustomerByEmail(email: string | undefined) {
  const result = useCachedQuery<db.Customer[]>(
    email ? `customer:email:${email}` : null,
    email ? async () => {
      const customer = await customerQuery(email);
      return customer ? [customer] : [];
    } : null,
    [email]
  );
  return { customer: result.data[0] ?? null, loading: result.loading };
}

async function customerQuery(email: string): Promise<db.Customer | null> {
  if (!supabase) return null;
  const { data } = await supabase.from('customers').select('id, company, email, phone, gst, address, projects, status, created_at').eq('email', email).maybeSingle();
  return data as db.Customer | null;
}

// ============ Cache invalidation helpers for realtime ============
export function invalidateProjects() {
  invalidatePattern('projects:');
}

export function invalidateTasks() {
  invalidatePattern('tasks:');
}

export function invalidateCorrections() {
  invalidatePattern('corrections:');
}

export function invalidateCustomers() {
  invalidate('customers:all');
}

export function invalidateEmployees() {
  invalidate('employees:all');
}

export { invalidate };
