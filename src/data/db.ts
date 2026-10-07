import { supabase } from '../contexts/AuthContext';

// ============ TYPES ============
export type UserRole = 'admin' | 'editor' | 'customer';

export type AdminRole = 'main' | 'sub_admin' | 'manager' | 'project_manager' | 'finance' | 'sales_manager' | 'relationship_manager' | 'custom';

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  admin_role: AdminRole | null;
  provider: string | null;
  language: string;
  phone: string | null;
  address: string | null;
  allowed_menus: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  order_number: string;
  event_name: string;
  customer_id: string | null;
  customer_email: string | null;
  customer_name: string;
  category: string;
  subcategory: string | null;
  status: string;
  priority: string;
  deadline: string | null;
  customer_deadline: string | null;
  started_date: string;
  amount: number;
  progress: number;
  editor_id: string | null;
  editor_name: string | null;
  theme: string | null;
  album_size: string | null;
  photos: number | null;
  duration: string | null;
  editing_style: string | null;
  layout_design: string | null;
  source_links: string | null;
  download_links: string | null;
  upload_links: string | null;
  music_links: string | null;
  reference_links: string | null;
  notes: string | null;
  share_token: string | null;
  output_link: string | null;
  parent_project_id: string | null;
  sub_order_label: string | null;
  rejected_reason: string | null;
  created_by: string;
  completion_requested: boolean;
  completion_requested_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  template_id: string | null;
  task_name: string;
  description: string | null;
  stage: string | null;
  priority: string;
  estimated_hours: number;
  assigned_to: string | null;
  assigned_to_name: string | null;
  group_name: string | null;
  sequence: number;
  status: string;
  submitted_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  notes: string | null;
  download_links: string | null;
  upload_links: string | null;
  editor_uploads: string | null;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  company: string;
  email: string | null;
  phone: string | null;
  gst: string | null;
  address: string | null;
  projects: number;
  status: string;
  created_at: string;
}

export interface Employee {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  skills: string[];
  applications: string[];
  experience: string | null;
  rating: number;
  projects: number;
  status: string;
  joined: string;
  created_at: string;
}

export interface TaskTemplate {
  id: string;
  task: string;
  description: string | null;
  category: string | null;
  stage: string | null;
  priority: string;
  estimated_hours: number;
  group_name: string | null;
  stages: string[];
  sort_order: number;
  created_at: string;
}

export interface TaskUpdate {
  id: string;
  task_id: string | null;
  project_id: string | null;
  employee_email: string | null;
  update_text: string;
  created_at: string;
}

export interface ReviewFile {
  id: string;
  project_id: string;
  file_type: string;
  file_url: string;
  file_name: string | null;
  version: number;
  uploaded_by: string;
  created_at: string;
}

export interface Comment {
  id: string;
  project_id: string;
  review_file_id: string | null;
  author_role: string;
  author_name: string | null;
  comment: string;
  photo_mark: { id: string; label: string; x: number; y: number; comment: string } | null;
  video_timestamp: { id: string; time: number; timeFormatted: string; comment: string } | null;
  voice_note: { id: string; duration: string; context: string } | null;
  type: string;
  created_at: string;
}

export interface Correction {
  id: string;
  number: string | null;
  project_id: string;
  order_id: string | null;
  event_name: string | null;
  customer: string;
  customer_email: string | null;
  editor: string | null;
  editor_id: string | null;
  photo_marks: { id: string; label: string; x?: number; y?: number; pageIndex?: number; comment: string; resolved?: boolean }[];
  video_timestamps: { id: string; time: number; timeFormatted: string; comment: string; resolved?: boolean }[];
  voice_notes: { id: string; duration: string; context: string; refLabel?: string; time?: number; resolved?: boolean; url?: string }[];
  status: string;
  priority: string;
  due_date: string | null;
  review_file_id: string | null;
  additional_files_link: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  description: string | null;
  target_role: string;
  target_email: string | null;
  read: boolean;
  created_at: string;
  project_id?: string | null;
  archived_at?: string | null;
  category?: string | null;
  resolved_at?: string | null;
  event_key?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ProjectMessage {
  id: string;
  project_id: string;
  sender_id: string;
  message: string;
  is_internal: boolean;
  created_at: string;
  sender?: Profile | null;
}

export interface TimeLog {
  id: string;
  task_id: string | null;
  project_id: string | null;
  employee_id: string | null;
  employee_email: string | null;
  hours: number;
  note: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  project_id: string;
  amount: number;
  status: string;
  paid_at: string | null;
  created_at: string;
  transaction_id: string | null;
  payment_method: string | null;
  payment_notes: string | null;
  employee_amount: number | null;
  employee_paid: boolean | null;
  employee_paid_at: string | null;
}

export interface PaymentSplit {
  id: string;
  payment_id: string | null;
  project_id: string;
  task_id: string | null;
  employee_id: string | null;
  employee_name: string | null;
  task_name: string | null;
  amount: number;
  status: string;
  paid_at: string | null;
  payment_proof: string | null;
  created_at: string;
}

export type InvoiceType = 'estimate' | 'final';
export type InvoiceStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'revised';

export interface Invoice {
  id: string;
  project_id: string;
  invoice_number: string | null;
  original_amount: number;
  current_amount: number;
  invoice_date: string;
  notes: string | null;
  created_by: string | null;
  advance_amount: number | null;
  invoice_type: InvoiceType;
  status: InvoiceStatus;
  sent_at: string | null;
  approved_at: string | null;
  rejected_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceRevision {
  id: string;
  invoice_id: string;
  previous_amount: number;
  new_amount: number;
  reason: string | null;
  changed_by: string | null;
  changed_at: string;
}

export interface ProjectPayment {
  id: string;
  project_id: string;
  invoice_id: string | null;
  amount: number;
  payment_date: string;
  payment_method: string;
  payment_type: string;
  transaction_reference: string | null;
  notes: string | null;
  receipt_file: string | null;
  payment_proof: string | null;
  status: 'pending_verification' | 'verified' | 'rejected';
  rejection_reason: string | null;
  verified_by: string | null;
  verified_at: string | null;
  created_by: string | null;
  created_at: string;
}

// ============ PROJECTS ============
export async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase!.from('projects').select('id, order_number, event_name, customer_id, customer_email, customer_name, category, subcategory, status, priority, deadline, customer_deadline, started_date, amount, progress, editor_id, editor_name, theme, album_size, photos, duration, editing_style, layout_design, source_links, download_links, upload_links, music_links, reference_links, notes, share_token, output_link, parent_project_id, sub_order_label, rejected_reason, created_by, completion_requested, completion_requested_at, created_at, updated_at').order('created_at', { ascending: false }).limit(500);
  if (error) throw error;
  return data || [];
}

export async function fetchProjectsByCustomer(email: string): Promise<Project[]> {
  const { data, error } = await supabase!.from('projects').select('id, order_number, event_name, customer_id, customer_email, customer_name, category, subcategory, status, priority, deadline, customer_deadline, started_date, amount, progress, editor_id, editor_name, theme, album_size, photos, duration, editing_style, layout_design, source_links, download_links, upload_links, music_links, reference_links, notes, share_token, output_link, parent_project_id, sub_order_label, rejected_reason, created_by, completion_requested, completion_requested_at, created_at, updated_at').eq('customer_email', email).order('created_at', { ascending: false }).limit(500);
  if (error) throw error;
  return data || [];
}

export async function fetchProject(id: string): Promise<Project | null> {
  const { data, error } = await supabase!.from('projects').select('id, order_number, event_name, customer_id, customer_email, customer_name, category, subcategory, status, priority, deadline, customer_deadline, started_date, amount, progress, editor_id, editor_name, theme, album_size, photos, duration, editing_style, layout_design, source_links, download_links, upload_links, music_links, reference_links, notes, share_token, output_link, parent_project_id, sub_order_label, rejected_reason, created_by, completion_requested, completion_requested_at, created_at, updated_at').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createProject(project: Partial<Project>): Promise<Project | null> {
  const { data, error } = await supabase!.from('projects').insert(project).select().maybeSingle();
  if (error) throw error;
  return data;
}

export async function splitProject(parentId: string, splits: {
  label: string;
  eventName?: string;
  category?: string;
  subcategory?: string;
  amount?: number;
  photos?: number;
  priority?: string;
  deadline?: string;
  albumSize?: string;
  duration?: string;
  editingStyle?: string;
  layoutDesign?: string;
  theme?: string;
}[]): Promise<Project[]> {
  const parent = await fetchProject(parentId);
  if (!parent) throw new Error('Parent project not found');
  const created: Project[] = [];
  for (const split of splits) {
    const subOrder = `${parent.order_number}${split.label}`;
    const { data, error } = await supabase!.from('projects').insert({
      ...parent,
      id: undefined,
      order_number: subOrder,
      event_name: split.eventName || `${parent.event_name} (${split.label})`,
      category: split.category || parent.category,
      subcategory: split.subcategory || parent.subcategory,
      amount: split.amount ?? parent.amount,
      photos: split.photos ?? parent.photos,
      priority: split.priority || parent.priority,
      deadline: split.deadline || parent.deadline,
      album_size: split.albumSize || parent.album_size,
      duration: split.duration || parent.duration,
      editing_style: split.editingStyle || parent.editing_style,
      layout_design: split.layoutDesign || parent.layout_design,
      theme: split.theme || parent.theme,
      status: 'created',
      progress: 0,
      parent_project_id: parentId,
      sub_order_label: split.label,
      share_token: null,
      editor_id: null,
      editor_name: null,
      download_links: null,
      upload_links: null,
      created_at: undefined,
      updated_at: undefined,
    }).select().maybeSingle();
    if (error) throw error;
    if (data) created.push(data);
  }
  // Remove the parent project after sub-projects are created
  await supabase!.from('projects').delete().eq('id', parentId);
  return created;
}

export async function updateProject(id: string, updates: Partial<Project>): Promise<void> {
  const { error } = await supabase!.from('projects').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function transitionProjectStatus(id: string, newStatus: string): Promise<void> {
  const { error } = await supabase!.rpc('transition_project_status', { p_project_id: id, p_new_status: newStatus });
  if (error) throw error;
  const stagePercent: Record<string, number> = {
    created: 0, approved: 5, assigned: 10, 'in-progress': 30, finished: 50,
    review: 60, correction: 70, correction_approved: 80, invoiced: 90, completed: 100,
  };
  const progress = stagePercent[newStatus];
  if (progress !== undefined) {
    await supabase!.from('projects').update({ progress, updated_at: new Date().toISOString() }).eq('id', id);
  }
}

// ============ TASKS ============
export async function fetchTasks(projectId: string): Promise<Task[]> {
  const { data, error } = await supabase!.from('tasks').select('id, project_id, template_id, task_name, description, stage, priority, estimated_hours, assigned_to, assigned_to_name, group_name, sequence, status, submitted_at, approved_at, approved_by, notes, download_links, upload_links, editor_uploads, created_at, updated_at').eq('project_id', projectId).order('sequence', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchAllTasks(): Promise<Task[]> {
  const { data, error } = await supabase!.from('tasks').select('id, project_id, template_id, task_name, description, stage, priority, estimated_hours, assigned_to, assigned_to_name, group_name, sequence, status, submitted_at, approved_at, approved_by, notes, download_links, upload_links, editor_uploads, created_at, updated_at').order('created_at', { ascending: false }).limit(500);
  if (error) throw error;
  return data || [];
}

export async function fetchTasksByProjectIds(projectIds: string[]): Promise<Task[]> {
  if (projectIds.length === 0) return [];
  const { data, error } = await supabase!.from('tasks').select('id, project_id, template_id, task_name, description, stage, priority, estimated_hours, assigned_to, assigned_to_name, group_name, sequence, status, submitted_at, approved_at, approved_by, notes, download_links, upload_links, editor_uploads, created_at, updated_at').in('project_id', projectIds).order('sequence', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchTasksByEmployee(employeeId: string): Promise<(Task & { project?: Project })[]> {
  const { data, error } = await supabase!
    .from('tasks')
    .select('id, project_id, template_id, task_name, description, stage, priority, estimated_hours, assigned_to, assigned_to_name, group_name, sequence, status, submitted_at, approved_at, approved_by, notes, download_links, upload_links, editor_uploads, created_at, updated_at, project:projects(id, order_number, event_name, customer_name, category, status, progress, deadline, editor_id, editor_name, amount)')
    .eq('assigned_to', employeeId)
    .order('sequence', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createTask(task: Partial<Task>): Promise<Task | null> {
  const { data, error } = await supabase!.from('tasks').insert(task).select().maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<void> {
  const { error } = await supabase!.from('tasks').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase!.from('tasks').delete().eq('id', id);
  if (error) throw error;
}

export async function revokeTask(
  taskId: string,
  projectId: string,
  options: { newAssignedTo: Employee | null; reason: string; originalEditorEmail?: string | null }
): Promise<void> {
  const { newAssignedTo, reason, originalEditorEmail } = options;
  const updates: Partial<Task> = {
    status: newAssignedTo ? 'assigned' : 'pending',
    assigned_to: newAssignedTo?.id || null,
    assigned_to_name: newAssignedTo?.name || null,
    submitted_at: null,
    approved_at: null,
    approved_by: null,
    editor_uploads: null,
    notes: reason.trim() || null,
  };
  await updateTask(taskId, updates);

  const allTasks = await fetchTasks(projectId);
  const anyActive = allTasks.some(
    (t) => t.id !== taskId && (t.status === 'in-progress' || t.status === 'partial-completed' || t.status === 'fully-completed' || t.status === 'submitted')
  );

  const proj = await fetchProject(projectId);
  if (proj) {
    if (!anyActive && proj.status === 'in-progress') {
      await transitionProjectStatus(projectId, newAssignedTo ? 'assigned' : 'approved');
    } else if (proj.status === 'finished') {
      await transitionProjectStatus(projectId, 'in-progress');
    }
  }

  if (originalEditorEmail) {
    await createNotification({
      type: 'task-complete',
      title: 'Task reassigned',
      description: `A task was reassigned due to inactivity. Reason: ${reason.trim() || 'No response from editor'}.`,
      target_role: 'editor',
      target_email: originalEditorEmail,
      read: false,
      project_id: projectId,
    });
  }
}

// ============ TIME LOGS ============
export async function fetchTimeLogs(taskId: string): Promise<TimeLog[]> {
  const { data, error } = await supabase!.from('time_logs').select('id, task_id, project_id, employee_id, employee_email, hours, note, created_at').eq('task_id', taskId).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchTimeLogsByEmployee(email: string): Promise<TimeLog[]> {
  const { data, error } = await supabase!.from('time_logs').select('id, task_id, project_id, employee_id, employee_email, hours, note, created_at').eq('employee_email', email).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createTimeLog(log: Partial<TimeLog>): Promise<TimeLog | null> {
  const { data, error } = await supabase!.from('time_logs').insert({
    task_id: log.task_id || null,
    project_id: log.project_id || null,
    employee_id: log.employee_id || null,
    employee_email: log.employee_email || null,
    hours: log.hours || 0,
    note: log.note || null,
  }).select().maybeSingle();
  if (error) { console.error('createTimeLog error:', error); return null; }
  return data as TimeLog | null;
}

// ============ CUSTOMERS ============
export async function fetchCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase!.from('customers').select('id, company, email, phone, gst, address, projects, status, created_at').order('created_at', { ascending: false }).limit(500);
  if (error) throw error;
  const rows = data || [];
  const seenEmails = new Set<string>();
  const deduped: Customer[] = [];
  for (const row of rows) {
    if (row.email) {
      const key = row.email.toLowerCase();
      if (seenEmails.has(key)) continue;
      seenEmails.add(key);
    }
    deduped.push(row);
  }
  return deduped;
}

export async function createCustomer(customer: Partial<Customer>): Promise<Customer | null> {
  const { data, error } = await supabase!.from('customers').insert(customer).select().maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateCustomer(id: string, updates: Partial<Customer>): Promise<void> {
  const { error } = await supabase!.from('customers').update(updates).eq('id', id);
  if (error) throw error;
}

export async function fetchCustomerByEmail(email: string): Promise<Customer | null> {
  const { data, error } = await supabase!.from('customers').select('id, company, email, phone, gst, address, projects, status, created_at').eq('email', email).maybeSingle();
  if (error) { console.error('fetchCustomerByEmail error:', error); return null; }
  return data as Customer | null;
}

export async function ensureCustomerForProfile(profile: { email: string | null; full_name: string | null }): Promise<void> {
  if (!profile.email) return;
  const existing = await fetchCustomerByEmail(profile.email);
  if (existing) return;
  const { error } = await supabase!.from('customers').insert({
    company: profile.full_name || profile.email,
    email: profile.email,
    phone: null,
    gst: null,
    address: null,
    projects: 0,
    status: 'active',
  });
  if (error && error.code !== '23505') console.error('ensureCustomerForProfile insert error:', error);
}

// ============ EMPLOYEES ============
export async function fetchEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase!.from('employees').select('id, name, email, phone, skills, applications, experience, rating, projects, status, joined, created_at').order('created_at', { ascending: false }).limit(500);
  if (error) throw error;
  return data || [];
}

export async function createEmployee(employee: Partial<Employee>): Promise<Employee | null> {
  const { data, error } = await supabase!.from('employees').insert(employee).select().maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateEmployee(id: string, updates: Partial<Employee>): Promise<void> {
  const { error } = await supabase!.from('employees').update(updates).eq('id', id);
  if (error) throw error;
}

// ============ TASK TEMPLATES ============
export async function fetchTaskTemplates(): Promise<TaskTemplate[]> {
  const { data, error } = await supabase!.from('task_templates').select('id, task, description, category, stage, priority, estimated_hours, group_name, stages, sort_order, created_at').order('sort_order', { ascending: true }).limit(200);
  if (error) throw error;
  return data || [];
}

export async function createTaskTemplate(template: Partial<TaskTemplate>): Promise<TaskTemplate | null> {
  const { data, error } = await supabase!.from('task_templates').insert(template).select().maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateTaskTemplate(id: string, updates: Partial<TaskTemplate>): Promise<void> {
  const { error } = await supabase!.from('task_templates').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteTaskTemplate(id: string): Promise<void> {
  const { error } = await supabase!.from('task_templates').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchUnassignedTasks(): Promise<(Task & { project?: Project })[]> {
  const { data, error } = await supabase!
    .from('tasks')
    .select('id, project_id, template_id, task_name, description, stage, priority, estimated_hours, assigned_to, assigned_to_name, group_name, sequence, status, submitted_at, approved_at, approved_by, notes, download_links, upload_links, editor_uploads, created_at, updated_at, project:projects(id, order_number, event_name, customer_name, category, status, progress, deadline, editor_id, editor_name, amount)')
    .is('assigned_to', null)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchTaskUpdates(taskId: string): Promise<TaskUpdate[]> {
  const { data, error } = await supabase!.from('task_updates').select('id, task_id, project_id, employee_email, update_text, created_at').eq('task_id', taskId).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchTaskUpdatesByTaskIds(taskIds: string[]): Promise<TaskUpdate[]> {
  if (taskIds.length === 0) return [];
  const { data, error } = await supabase!.from('task_updates').select('id, task_id, project_id, employee_email, update_text, created_at').in('task_id', taskIds).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createTaskUpdate(update: Partial<TaskUpdate>): Promise<TaskUpdate | null> {
  const { data, error } = await supabase!.from('task_updates').insert(update).select().maybeSingle();
  if (error) throw error;
  return data;
}

// ============ REVIEW FILES ============
export async function fetchReviewFiles(projectId: string): Promise<ReviewFile[]> {
  const { data, error } = await supabase!.from('review_files').select('id, project_id, file_type, file_url, file_name, version, uploaded_by, created_at').eq('project_id', projectId).order('version', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchReviewFilesByProjectIds(projectIds: string[]): Promise<Record<string, ReviewFile[]>> {
  if (projectIds.length === 0) return {};
  const { data, error } = await supabase!.from('review_files').select('id, project_id, file_type, file_url, file_name, version, uploaded_by, created_at').in('project_id', projectIds).order('version', { ascending: false });
  if (error) throw error;
  const map: Record<string, ReviewFile[]> = {};
  for (const row of data || []) {
    if (row.project_id) (map[row.project_id] ||= []).push(row);
  }
  return map;
}

export async function createReviewFile(file: Partial<ReviewFile>): Promise<ReviewFile | null> {
  const { data, error } = await supabase!.from('review_files').insert(file).select().maybeSingle();
  if (error) throw error;
  return data;
}

export async function deleteReviewFile(id: string): Promise<void> {
  const { error } = await supabase!.from('review_files').delete().eq('id', id);
  if (error) throw error;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

export async function uploadReviewFile(
  projectId: string,
  file: File,
  onProgress?: (p: UploadProgress) => void
): Promise<{ url: string; path: string } | null> {
  if (!supabase) return null;
  const ext = file.name.split('.').pop() || 'bin';
  const fileName = `${projectId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { data, error } = await supabase.storage
    .from('review-files')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress({
            loaded: e.loaded,
            total: e.total,
            percent: Math.round((e.loaded / e.total) * 100),
          });
        }
      },
    });

  if (error) throw error;

  const { data: urlData } = supabase.storage.from('review-files').getPublicUrl(data.path);
  return { url: urlData.publicUrl, path: data.path };
}

export async function removeReviewFileFromStorage(path: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.storage.from('review-files').remove([path]);
  if (error) throw error;
}

// ============ COMMENTS ============
export async function fetchComments(projectId: string): Promise<Comment[]> {
  const { data, error } = await supabase!.from('comments').select('id, project_id, review_file_id, author_role, author_name, comment, photo_mark, video_timestamp, voice_note, type, created_at').eq('project_id', projectId).order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createComment(comment: Partial<Comment>): Promise<Comment | null> {
  const { data, error } = await supabase!.from('comments').insert(comment).select().maybeSingle();
  if (error) throw error;
  return data;
}

// ============ VOICE NOTES ============
export async function uploadVoiceNote(projectId: string, blob: Blob): Promise<string | null> {
  if (!supabase) return null;
  const ext = blob.type.includes('webm') ? 'webm' : blob.type.includes('mp4') ? 'mp4' : 'webm';
  const fileName = `${projectId}/voice-notes/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { data, error } = await supabase.storage
    .from('review-files')
    .upload(fileName, blob, { cacheControl: '3600', upsert: false });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from('review-files').getPublicUrl(data.path);
  return urlData.publicUrl;
}

// ============ CORRECTIONS ============
export async function fetchCorrections(): Promise<Correction[]> {
  const { data, error } = await supabase!.from('corrections').select('id, number, project_id, order_id, event_name, customer, customer_email, editor, editor_id, photo_marks, video_timestamps, voice_notes, status, priority, due_date, review_file_id, additional_files_link, created_at, updated_at').order('created_at', { ascending: false }).limit(500);
  if (error) throw error;
  return data || [];
}

export async function fetchCorrectionsByProject(projectId: string): Promise<Correction[]> {
  const { data, error } = await supabase!.from('corrections').select('id, number, project_id, order_id, event_name, customer, customer_email, editor, editor_id, photo_marks, video_timestamps, voice_notes, status, priority, due_date, review_file_id, additional_files_link, created_at, updated_at').eq('project_id', projectId).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createCorrection(correction: Partial<Correction>): Promise<Correction | null> {
  const { data, error } = await supabase!.from('corrections').insert(correction).select().maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateCorrection(id: string, updates: Partial<Correction>): Promise<void> {
  const { error } = await supabase!.from('corrections').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function resolveCorrectionComment(
  correctionId: string,
  field: 'photo_marks' | 'video_timestamps' | 'voice_notes',
  commentId: string,
  resolved: boolean
): Promise<void> {
  const { data, error: fetchError } = await supabase!
    .from('corrections')
    .select(field)
    .eq('id', correctionId)
    .maybeSingle();
  if (fetchError) throw fetchError;
  const items = (data?.[field] || []) as Array<{ id: string; resolved?: boolean }>;
  const updated = items.map((item) =>
    item.id === commentId ? { ...item, resolved } : item
  );
  const { error } = await supabase!
    .from('corrections')
    .update({ [field]: updated, updated_at: new Date().toISOString() })
    .eq('id', correctionId);
  if (error) throw error;
}

// ============ NOTIFICATIONS ============
export async function fetchNotifications(targetRole: string): Promise<NotificationRow[]> {
  const { data, error } = await supabase!.from('notifications').select('id, type, title, description, target_role, target_email, read, created_at, project_id, archived_at, category, resolved_at, event_key, metadata').eq('target_role', targetRole).order('created_at', { ascending: false }).limit(200);
  if (error) throw error;
  return data || [];
}

export async function fetchAllNotifications(): Promise<NotificationRow[]> {
  const { data, error } = await supabase!.from('notifications').select('id, type, title, description, target_role, target_email, read, created_at, project_id, archived_at, category, resolved_at, event_key, metadata').order('created_at', { ascending: false }).limit(200);
  if (error) throw error;
  return data || [];
}

export async function createNotification(notification: Partial<NotificationRow>): Promise<void> {
  const { error } = await supabase!.from('notifications').insert(notification);
  if (error) throw error;
}

export async function emitNotification(params: {
  eventKey: string;
  category: string;
  type: string;
  title: string;
  description?: string;
  targetRole: string;
  targetEmail?: string | null;
  projectId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('emit_notification', {
    p_event_key: params.eventKey,
    p_category: params.category,
    p_type: params.type,
    p_title: params.title,
    p_description: params.description ?? null,
    p_target_role: params.targetRole,
    p_target_email: params.targetEmail ?? null,
    p_project_id: params.projectId ?? null,
    p_metadata: params.metadata ?? {},
    p_send_push: true,
  });
  if (error) {
    console.error('emitNotification failed:', error);
    return null;
  }
  return data as string | null;
}

export function sendStatusEmail(payload: {
  templateName: string;
  recipient: string | null | undefined;
  recipientName?: string | null;
  variables?: Record<string, string>;
}): Promise<void> {
  if (!supabase || !payload.recipient) return Promise.resolve();
  supabase.functions.invoke('send-status-email', {
    body: {
      templateName: payload.templateName,
      recipient: payload.recipient,
      recipientName: payload.recipientName || null,
      variables: payload.variables || {},
    },
  }).then(({ error }) => {
    if (error) console.error('sendStatusEmail failed:', error);
  }).catch((err) => {
    console.error('sendStatusEmail failed:', err);
  });
  return Promise.resolve();
}

export async function resolveNotification(id: string): Promise<void> {
  const { error } = await supabase!.from('notifications').update({ resolved_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase!.from('notifications').update({ read: true }).eq('id', id);
  if (error) throw error;
}

export async function markAllNotificationsRead(targetRole: string): Promise<void> {
  const { error } = await supabase!.from('notifications').update({ read: true }).eq('target_role', targetRole).eq('read', false);
  if (error) throw error;
}

// ============ PAYMENTS ============
export async function fetchAllPayments(): Promise<Payment[]> {
  const { data, error } = await supabase!.from('payments').select('id, project_id, amount, status, paid_at, created_at, transaction_id, payment_method, payment_notes, employee_amount, employee_paid, employee_paid_at').order('created_at', { ascending: false }).limit(500);
  if (error) throw error;
  return data || [];
}

export async function fetchAllPaymentSplits(): Promise<PaymentSplit[]> {
  const { data, error } = await supabase!.from('payment_splits').select('id, payment_id, project_id, task_id, employee_id, employee_name, task_name, amount, status, paid_at, payment_proof, created_at').order('created_at', { ascending: false }).limit(500);
  if (error) throw error;
  return data || [];
}

export async function fetchPayment(projectId: string): Promise<Payment | null> {
  const { data, error } = await supabase!.from('payments').select('id, project_id, amount, status, paid_at, created_at, transaction_id, payment_method, payment_notes, employee_amount, employee_paid, employee_paid_at').eq('project_id', projectId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchPaymentsByProjectIds(projectIds: string[]): Promise<Record<string, Payment>> {
  if (projectIds.length === 0) return {};
  const { data, error } = await supabase!.from('payments').select('id, project_id, amount, status, paid_at, created_at, transaction_id, payment_method, payment_notes, employee_amount, employee_paid, employee_paid_at').in('project_id', projectIds);
  if (error) throw error;
  const map: Record<string, Payment> = {};
  for (const p of data || []) { if (p.project_id) map[p.project_id] = p; }
  return map;
}

export async function createPayment(payment: Partial<Payment>): Promise<Payment | null> {
  const { data, error } = await supabase!.from('payments').insert(payment).select().maybeSingle();
  if (error) throw error;
  return data;
}

export async function updatePayment(id: string, updates: Partial<Payment>): Promise<void> {
  const { error } = await supabase!.from('payments').update(updates).eq('id', id);
  if (error) throw error;
}

export async function fetchPaymentsByEmployee(employeeName: string): Promise<Payment[]> {
  const { data, error } = await supabase!
    .from('payments')
    .select(`
      *,
      projects!inner (
        id,
        order_number,
        event_name,
        category,
        editor_name,
        deadline
      )
    `)
    .eq('projects.editor_name', employeeName)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as Payment[]) || [];
}

// ============ PAYMENT SPLITS ============
export async function fetchPaymentSplits(projectId: string): Promise<PaymentSplit[]> {
  const { data, error } = await supabase!.from('payment_splits').select('id, payment_id, project_id, task_id, employee_id, employee_name, task_name, amount, status, paid_at, payment_proof, created_at').eq('project_id', projectId).order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createPaymentSplits(splits: Partial<PaymentSplit>[]): Promise<PaymentSplit[]> {
  if (splits.length === 0) return [];
  const { data, error } = await supabase!.from('payment_splits').insert(splits).select();
  if (error) throw error;
  return data || [];
}

export async function deletePaymentSplits(projectId: string): Promise<void> {
  const { error } = await supabase!.from('payment_splits').delete().eq('project_id', projectId);
  if (error) throw error;
}

export async function updatePaymentSplit(id: string, updates: Partial<PaymentSplit>): Promise<void> {
  const { error } = await supabase!.from('payment_splits').update(updates).eq('id', id);
  if (error) throw error;
}

export async function markSplitPaid(id: string, proofUrl?: string): Promise<void> {
  const { data: split, error: fetchErr } = await supabase!.from('payment_splits').select('status, project_id, employee_id, employee_name, amount').eq('id', id).maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!split) throw new Error('Payment split not found');
  if (split.status !== 'pending') throw new Error(`Cannot mark split as paid: current status is ${split.status}`);
  const { error } = await supabase!.from('payment_splits').update({
    status: 'paid',
    paid_at: new Date().toISOString(),
    payment_proof: proofUrl || null,
  }).eq('id', id);
  if (error) throw error;
  await supabase!.from('payout_requests').update({ status: 'processed', processed_at: new Date().toISOString() }).contains('split_ids', [id]).eq('status', 'requested');
  const [{ data: project }, { data: profile }] = await Promise.all([
    supabase!.from('projects').select('order_number, event_name').eq('id', split.project_id).maybeSingle(),
    supabase!.from('profiles').select('email, full_name').eq('id', split.employee_id).maybeSingle(),
  ]);
  await sendStatusEmail({
    templateName: 'payout_processed',
    recipient: profile?.email,
    recipientName: profile?.full_name || split.employee_name,
    variables: {
      editor_name: profile?.full_name || split.employee_name || 'there',
      amount: String(split.amount),
      project_name: project?.event_name || '',
      order_number: project?.order_number || '',
      task_name: '',
    },
  });
}

export async function markSplitsPaidByProject(projectId: string, proofUrl?: string): Promise<void> {
  const { data: pendingSplits, error: fetchErr } = await supabase!.from('payment_splits').select('id, employee_id, employee_name, amount').eq('project_id', projectId).eq('status', 'pending');
  if (fetchErr) throw fetchErr;
  const splitIds = (pendingSplits || []).map((s: { id: string }) => s.id);
  const { error } = await supabase!.from('payment_splits').update({
    status: 'paid',
    paid_at: new Date().toISOString(),
    payment_proof: proofUrl || null,
  }).eq('project_id', projectId).eq('status', 'pending');
  if (error) throw error;

  if (splitIds.length > 0) {
    const { data: pendingRequests } = await supabase!.from('payout_requests').select('id, split_ids').eq('status', 'requested');
    for (const req of (pendingRequests || []) as { id: string; split_ids: string[] }[]) {
      if (req.split_ids.some((sid) => splitIds.includes(sid))) {
        await supabase!.from('payout_requests').update({ status: 'processed', processed_at: new Date().toISOString() }).eq('id', req.id);
      }
    }
  }

  const [{ data: project }, { data: profiles }] = await Promise.all([
    supabase!.from('projects').select('order_number, event_name').eq('id', projectId).maybeSingle(),
    supabase!.from('profiles').select('id, email, full_name').in('id', (pendingSplits || []).map((split) => split.employee_id).filter((id): id is string => !!id)),
  ]);
  for (const split of pendingSplits || []) {
    const profile = profiles?.find((item) => item.id === split.employee_id);
    await sendStatusEmail({
      templateName: 'payout_processed',
      recipient: profile?.email,
      recipientName: profile?.full_name || split.employee_name,
      variables: {
        editor_name: profile?.full_name || split.employee_name || 'there',
        amount: String(split.amount),
        project_name: project?.event_name || '',
        order_number: project?.order_number || '',
        task_name: '',
      },
    });
  }
}

export async function fetchPaymentSplitsByEmployee(employeeId: string): Promise<(PaymentSplit & { project?: Project })[]> {
  const { data, error } = await supabase!
    .from('payment_splits')
    .select('*, project:projects!payment_splits_project_id_fkey(*)')
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as (PaymentSplit & { project?: Project })[]) || [];
}

// ============ PAYOUT REQUESTS ============
export interface PayoutRequest {
  id: string;
  employee_id: string | null;
  employee_name: string | null;
  split_ids: string[];
  total_amount: number;
  status: string;
  requested_at: string;
  processed_at: string | null;
  notes: string | null;
}

export async function fetchPayoutRequestsByEmployee(employeeId: string): Promise<PayoutRequest[]> {
  const { data, error } = await supabase!
    .from('payout_requests')
    .select('id, employee_id, employee_name, split_ids, total_amount, status, requested_at, processed_at, notes')
    .eq('employee_id', employeeId)
    .order('requested_at', { ascending: false });
  if (error) throw error;
  return (data as PayoutRequest[]) || [];
}

export async function createPayoutRequest(req: {
  employee_id: string;
  employee_name: string;
  split_ids: string[];
  total_amount: number;
}): Promise<PayoutRequest | null> {
  const { data, error } = await supabase!
    .from('payout_requests')
    .insert({
      employee_id: req.employee_id,
      employee_name: req.employee_name,
      split_ids: req.split_ids,
      total_amount: req.total_amount,
      status: 'requested',
      requested_at: new Date().toISOString(),
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data as PayoutRequest | null;
}

export async function fetchAllPayoutRequests(): Promise<PayoutRequest[]> {
  const { data, error } = await supabase!
    .from('payout_requests')
    .select('id, employee_id, employee_name, split_ids, total_amount, status, requested_at, processed_at, notes')
    .order('requested_at', { ascending: false }).limit(500);
  if (error) throw error;
  return (data as PayoutRequest[]) || [];
}

export async function processPayoutRequest(id: string, notes?: string): Promise<void> {
  const { error } = await supabase!
    .from('payout_requests')
    .update({ status: 'processed', processed_at: new Date().toISOString(), notes: notes || null })
    .eq('id', id);
  if (error) throw error;
}

export async function rejectPayoutRequest(id: string, reason: string): Promise<void> {
  const { error } = await supabase!
    .from('payout_requests')
    .update({ status: 'rejected', processed_at: new Date().toISOString(), notes: reason })
    .eq('id', id);
  if (error) throw error;
}

// ============ INVOICES ============
export async function fetchInvoice(projectId: string): Promise<Invoice | null> {
  const { data, error } = await supabase!.from('invoices').select('id, project_id, invoice_number, original_amount, current_amount, invoice_date, notes, created_by, advance_amount, invoice_type, status, sent_at, approved_at, rejected_reason, created_at, updated_at').eq('project_id', projectId).maybeSingle();
  if (error) throw error;
  return data as Invoice | null;
}

export async function fetchAllInvoices(): Promise<Invoice[]> {
  const { data, error } = await supabase!.from('invoices').select('id, project_id, invoice_number, original_amount, current_amount, invoice_date, notes, created_by, advance_amount, invoice_type, status, sent_at, approved_at, rejected_reason, created_at, updated_at').order('created_at', { ascending: false }).limit(500);
  if (error) throw error;
  return (data as Invoice[]) || [];
}

export async function createInvoice(invoice: {
  project_id: string;
  amount: number;
  advance_amount?: number;
  notes?: string;
  created_by?: string;
  invoice_type?: InvoiceType;
}): Promise<Invoice | null> {
  const { data: invNum } = await supabase!.rpc('generate_invoice_number');
  const { data, error } = await supabase!.from('invoices').insert({
    project_id: invoice.project_id,
    invoice_number: invNum,
    original_amount: invoice.amount,
    current_amount: invoice.amount,
    advance_amount: invoice.advance_amount || 0,
    notes: invoice.notes || null,
    created_by: invoice.created_by || null,
    invoice_type: invoice.invoice_type || 'final',
    status: 'draft',
  }).select().maybeSingle();
  if (error) throw error;
  return data as Invoice | null;
}

export async function updateInvoiceAmount(
  invoiceId: string,
  newAmount: number,
  reason: string,
  changedBy: string
): Promise<Invoice | null> {
  const { data: inv, error: fetchErr } = await supabase!.from('invoices').select('current_amount').eq('id', invoiceId).maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!inv) throw new Error('Invoice not found');
  const previousAmount = inv.current_amount;
  const { data, error } = await supabase!.from('invoices').update({
    current_amount: newAmount,
    updated_at: new Date().toISOString(),
  }).eq('id', invoiceId).select().maybeSingle();
  if (error) throw error;
  const { error: revErr } = await supabase!.from('invoice_revisions').insert({
    invoice_id: invoiceId,
    previous_amount: previousAmount,
    new_amount: newAmount,
    reason: reason || null,
    changed_by: changedBy || null,
  });
  if (revErr) throw revErr;
  return data as Invoice | null;
}

export async function updateInvoice(id: string, updates: Partial<Invoice>): Promise<void> {
  const { error } = await supabase!.from('invoices').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function transitionInvoiceStatus(id: string, newStatus: string): Promise<void> {
  const { error } = await supabase!.rpc('transition_invoice_status', { p_invoice_id: id, p_new_status: newStatus });
  if (error) throw error;
}

// ============ INVOICE REVISIONS ============
export async function fetchInvoiceRevisions(invoiceId: string): Promise<InvoiceRevision[]> {
  const { data, error } = await supabase!.from('invoice_revisions').select('id, invoice_id, previous_amount, new_amount, reason, changed_by, changed_at').eq('invoice_id', invoiceId).order('changed_at', { ascending: false });
  if (error) throw error;
  return (data as InvoiceRevision[]) || [];
}

// ============ PROJECT PAYMENTS ============
export async function fetchProjectPayments(projectId: string): Promise<ProjectPayment[]> {
  const { data, error } = await supabase!.from('project_payments').select('id, project_id, invoice_id, amount, payment_date, payment_method, payment_type, transaction_reference, notes, receipt_file, payment_proof, status, rejection_reason, verified_by, verified_at, created_by, created_at').eq('project_id', projectId).order('payment_date', { ascending: false });
  if (error) throw error;
  return (data as ProjectPayment[]) || [];
}

export async function fetchAllProjectPayments(): Promise<ProjectPayment[]> {
  const { data, error } = await supabase!.from('project_payments').select('id, project_id, invoice_id, amount, payment_date, payment_method, payment_type, transaction_reference, notes, receipt_file, payment_proof, status, rejection_reason, verified_by, verified_at, created_by, created_at').order('payment_date', { ascending: false }).limit(500);
  if (error) throw error;
  return (data as ProjectPayment[]) || [];
}

export async function createProjectPayment(payment: {
  project_id: string;
  invoice_id?: string;
  amount: number;
  payment_date?: string;
  payment_method?: string;
  payment_type?: string;
  transaction_reference?: string;
  notes?: string;
  receipt_file?: string;
  payment_proof?: string;
  status?: 'pending_verification' | 'verified' | 'rejected';
  created_by?: string;
  verified_by?: string;
  verified_at?: string;
}): Promise<ProjectPayment | null> {
  const { data, error } = await supabase!.from('project_payments').insert({
    project_id: payment.project_id,
    invoice_id: payment.invoice_id || null,
    amount: payment.amount,
    payment_date: payment.payment_date || new Date().toISOString(),
    payment_method: payment.payment_method || 'UPI',
    payment_type: payment.payment_type || 'Advance',
    transaction_reference: payment.transaction_reference || null,
    notes: payment.notes || null,
    receipt_file: payment.receipt_file || null,
    payment_proof: payment.payment_proof || null,
    status: payment.status || 'verified',
    created_by: payment.created_by || null,
    verified_by: payment.verified_by || null,
    verified_at: payment.verified_at || null,
  }).select().maybeSingle();
  if (error) throw error;
  return data as ProjectPayment | null;
}

export async function verifyProjectPayment(id: string, verifiedBy: string): Promise<void> {
  const { error } = await supabase!.rpc('transition_project_payment_status', { p_payment_id: id, p_new_status: 'verified', p_actor: verifiedBy });
  if (error) throw error;
}

export async function rejectProjectPayment(id: string, reason: string, rejectedBy: string): Promise<void> {
  const { error } = await supabase!.rpc('transition_project_payment_status', { p_payment_id: id, p_new_status: 'rejected', p_actor: rejectedBy });
  if (error) throw error;
  if (!error) {
    await supabase!.from('project_payments').update({ rejection_reason: reason }).eq('id', id);
  }
}

export async function uploadPaymentProof(projectId: string, file: File): Promise<string | null> {
  if (!supabase) return null;
  const ext = file.name.split('.').pop() || 'bin';
  const fileName = `payment-proofs/${projectId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { data, error } = await supabase.storage.from('review-files').upload(fileName, file, { cacheControl: '3600', upsert: false });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from('review-files').getPublicUrl(data.path);
  return urlData.publicUrl;
}

export async function requestProjectCompletion(projectId: string): Promise<void> {
  const { error } = await supabase!.from('projects').update({
    completion_requested: true,
    completion_requested_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', projectId);
  if (error) throw error;
}

export async function deleteProjectPayment(id: string): Promise<void> {
  const { error } = await supabase!.from('project_payments').delete().eq('id', id);
  if (error) throw error;
}

// ============ HELPER: Compute payment status ============
export function computePaymentStatus(totalPaid: number, invoiceAmount: number): string {
  if (totalPaid <= 0) return 'Unpaid';
  if (totalPaid < invoiceAmount) return 'Partially Paid';
  if (totalPaid === invoiceAmount) return 'Fully Paid';
  return 'Overpaid';
}

// ============ EDITOR-SCOPED QUERIES ============
export async function fetchProjectsByProjectIds(projectIds: string[]): Promise<Map<string, Project>> {
  if (projectIds.length === 0) return new Map();
  const { data, error } = await supabase!.from('projects').select('id, order_number, event_name, customer_id, customer_email, customer_name, category, subcategory, status, priority, deadline, customer_deadline, started_date, amount, progress, editor_id, editor_name, theme, album_size, photos, duration, editing_style, layout_design, source_links, download_links, upload_links, music_links, reference_links, notes, share_token, output_link, parent_project_id, sub_order_label, rejected_reason, created_by, completion_requested, completion_requested_at, created_at, updated_at').in('id', projectIds);
  if (error) throw error;
  return new Map((data || []).map((p: Project) => [p.id, p]));
}

export async function fetchProjectsForEditor(employeeId: string): Promise<Project[]> {
  const { data, error } = await supabase!.from('projects').select('id, order_number, event_name, customer_id, customer_email, customer_name, category, subcategory, status, priority, deadline, customer_deadline, started_date, amount, progress, editor_id, editor_name, theme, album_size, photos, duration, editing_style, layout_design, source_links, download_links, upload_links, music_links, reference_links, notes, share_token, output_link, parent_project_id, sub_order_label, rejected_reason, created_by, completion_requested, completion_requested_at, created_at, updated_at').eq('editor_id', employeeId).order('created_at', { ascending: false }).limit(500);
  if (error) throw error;
  return data || [];
}

export async function fetchProjectIdsForEditor(employeeId: string): Promise<Set<string>> {
  const { data, error } = await supabase!.from('tasks').select('project_id').eq('assigned_to', employeeId);
  if (error) { console.error('fetchProjectIdsForEditor error:', error); return new Set(); }
  const ids = new Set<string>();
  (data || []).forEach((row: { project_id: string }) => ids.add(row.project_id));
  const { data: projData } = await supabase!.from('projects').select('id').eq('editor_id', employeeId);
  (projData || []).forEach((row: { id: string }) => ids.add(row.id));
  return ids;
}

export async function fetchCorrectionsForEditor(employeeId: string): Promise<Correction[]> {
  const projectIds = await fetchProjectIdsForEditor(employeeId);
  if (projectIds.size === 0) return [];
  const idsArray = Array.from(projectIds);
  const { data, error } = await supabase!.from('corrections').select('id, number, project_id, order_id, event_name, customer, customer_email, editor, editor_id, photo_marks, video_timestamps, voice_notes, status, priority, due_date, review_file_id, additional_files_link, created_at, updated_at').in('project_id', idsArray).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ============ CUSTOMER-SCOPED CORRECTIONS ============
export async function fetchCorrectionsByCustomer(email: string): Promise<Correction[]> {
  const projects = await fetchProjectsByCustomer(email);
  const projectIds = projects.map((project) => project.id);
  if (projectIds.length === 0) return [];
  const { data, error } = await supabase!.from('corrections').select('id, number, project_id, order_id, event_name, customer, customer_email, editor, editor_id, photo_marks, video_timestamps, voice_notes, status, priority, due_date, review_file_id, additional_files_link, created_at, updated_at').in('project_id', projectIds).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ============ PROJECT MESSAGES ============
export async function fetchProjectMessages(projectId: string): Promise<ProjectMessage[]> {
  const { data, error } = await supabase!
    .rpc('fetch_project_messages', { p_project_id: projectId });
  if (error) throw error;
  return (data as ProjectMessage[]) || [];
}

export async function fetchProjectMessagesByProjectIds(projectIds: string[]): Promise<Record<string, ProjectMessage[]>> {
  if (projectIds.length === 0) return {};
  const results = await Promise.all(
    projectIds.map((id) => fetchProjectMessages(id).catch(() => [] as ProjectMessage[]))
  );
  const map: Record<string, ProjectMessage[]> = {};
  projectIds.forEach((id, i) => { map[id] = results[i]; });
  return map;
}

export async function createProjectMessage(
  projectId: string,
  senderId: string,
  message: string,
  isInternal: boolean
): Promise<ProjectMessage | null> {
  const { data, error } = await supabase!
    .from('project_messages')
    .insert({
      project_id: projectId,
      sender_id: senderId,
      message,
      is_internal: isInternal,
    })
    .select('*, sender:profiles!project_messages_sender_id_fkey(*)')
    .maybeSingle();
  if (error) throw error;
  return data as ProjectMessage | null;
}

// ============ HELPER: Generate order number ============
// Format: OK{YY}-{P|V}{NNN}  e.g. OK26-P001, OK26-V002
// Sequence is global across both types, zero-padded to 3 digits.
export async function generateOrderNumber(categoryType: 'photo' | 'video'): Promise<string> {
  const yy = String(new Date().getFullYear()).slice(-2);
  const prefix = `OK${yy}-`;
  const typeCode = categoryType === 'video' ? 'V' : 'P';

  const { data, error } = await supabase!
    .from('projects')
    .select('order_number')
    .like('order_number', `${prefix}%`);

  if (error) console.error('generateOrderNumber lookup error:', error);

  let maxSeq = 0;
  (data || []).forEach((row) => {
    const match = (row.order_number as string)?.match(/^[A-Z]{2}\d{2}-[A-Z](\d+)$/);
    if (match) {
      const seq = parseInt(match[1], 10);
      if (seq > maxSeq) maxSeq = seq;
    }
  });

  const nextSeq = String(maxSeq + 1).padStart(3, '0');
  return `${prefix}${typeCode}${nextSeq}`;
}

// ============ HELPER: Generate correction number ============
export function generateCorrectionNumber(existing: Correction[]): string {
  const maxNum = existing.reduce((max, c) => {
    const match = c.number?.match(/COR-(\d+)/);
    return match ? Math.max(max, parseInt(match[1])) : max;
  }, 0);
  return `COR-${String(maxNum + 1).padStart(2, '0')}`;
}

// ============ HELPER: Compute project progress from tasks ============
export function computeProgress(tasks: Task[]): number {
  if (tasks.length === 0) return 0;
  const done = tasks.filter((t) => t.status === 'approved' || t.status === 'completed').length;
  return Math.round((done / tasks.length) * 100);
}

// ============ HELPER: Get current task (first non-approved) ============
export function getCurrentTask(tasks: Task[]): Task | null {
  const finishedStatuses = ['approved', 'completed', 'submitted', 'fully-completed'];
  return tasks.find((t) => !finishedStatuses.includes(t.status)) || null;
}

// ============ HELPER: Parse source links (JSON array or plain text) ============
export interface SourceLinkEntry {
  url: string;
  description: string;
}

export function parseSourceLinks(raw: string | null): SourceLinkEntry[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'string' && parsed.trim()) return [{ url: parsed.trim(), description: '' }];
    if (Array.isArray(parsed)) {
      return parsed.reduce<SourceLinkEntry[]>((links, entry) => {
        if (typeof entry === 'string' && entry.trim()) {
          links.push({ url: entry.trim(), description: '' });
        } else if (entry && typeof entry === 'object' && 'url' in entry && typeof entry.url === 'string' && entry.url.trim()) {
          links.push({
            url: entry.url.trim(),
            description: 'description' in entry && typeof entry.description === 'string' ? entry.description : '',
          });
        }
        return links;
      }, []);
    }
    if (parsed && typeof parsed === 'object' && 'url' in parsed && typeof parsed.url === 'string' && parsed.url.trim()) {
      return [{
        url: parsed.url.trim(),
        description: 'description' in parsed && typeof parsed.description === 'string' ? parsed.description : '',
      }];
    }
  } catch {
    return [{ url: raw.trim(), description: '' }];
  }
  return [{ url: raw.trim(), description: '' }];
}

// ============ ADMINS ============
export interface Admin {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  admin_role: AdminRole;
  status: string;
  allowed_menus: string[] | null;
  created_at: string;
}

export async function fetchAdmins(): Promise<Admin[]> {
  const { data, error } = await supabase!.from('admins').select('id, name, email, phone, admin_role, status, allowed_menus, created_at').order('created_at', { ascending: false }).limit(200);
  if (error) throw error;
  return (data || []) as Admin[];
}

export async function createAdmin(admin: Partial<Admin>): Promise<Admin | null> {
  const { data, error } = await supabase!.from('admins').insert(admin).select().maybeSingle();
  if (error) throw error;
  return data as Admin | null;
}

export async function updateAdmin(id: string, updates: Partial<Admin>): Promise<void> {
  const { data, error } = await supabase!.from('admins').update(updates).eq('id', id).select();
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Failed to update admin. Only Main Admins can edit admin users.');
}

// ============ PROFILES ============
export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase!.from('profiles').select('id, email, full_name, avatar_url, role, admin_role, provider, language, phone, address, allowed_menus, created_at, updated_at').eq('id', userId).maybeSingle();
  if (error) { console.error('fetchProfile error:', error); return null; }
  return data as Profile | null;
}

export async function upsertProfile(profile: Partial<Profile> & { id: string }): Promise<Profile | null> {
  const { data, error } = await supabase!.from('profiles').upsert({
    id: profile.id,
    email: profile.email || null,
    full_name: profile.full_name || null,
    avatar_url: profile.avatar_url || null,
    role: profile.role || 'customer',
    admin_role: profile.admin_role ?? null,
    provider: profile.provider || 'email',
    language: profile.language || 'English',
    phone: profile.phone || null,
    address: profile.address || null,
    allowed_menus: profile.allowed_menus ?? null,
    updated_at: new Date().toISOString(),
  }).select().maybeSingle();
  if (error) { console.error('upsertProfile error:', error); return null; }
  return data as Profile | null;
}

export async function fetchProfileByEmail(email: string): Promise<Profile | null> {
  const { data, error } = await supabase!.from('profiles').select('id, email, full_name, avatar_url, role, admin_role, provider, language, phone, address, allowed_menus, created_at, updated_at').eq('email', email).maybeSingle();
  if (error) { console.error('fetchProfileByEmail error:', error); return null; }
  return data as Profile | null;
}

export async function fetchProfilesByRole(role: string): Promise<Profile[]> {
  const { data, error } = await supabase!.from('profiles').select('id, email, full_name, avatar_url, role, admin_role, provider, language, phone, address, allowed_menus, created_at, updated_at').eq('role', role).order('created_at', { ascending: false }).limit(500);
  if (error) { console.error('fetchProfilesByRole error:', error); return []; }
  return (data || []) as Profile[];
}

// ============ ADMIN: CREATE AUTH USER ============
// Calls the admin-create-user edge function to create an auth user + profile
// with a specific role (customer or editor) and a password. Returns the new user id.
export async function adminCreateUser(params: {
  email: string;
  password: string;
  fullName: string;
  role: 'customer' | 'editor' | 'admin';
  adminRole?: AdminRole;
}): Promise<{ id: string } | null> {
  // Client-side duplicate check before calling the edge function
  const existingProfile = await fetchProfileByEmail(params.email);
  if (existingProfile) {
    throw new Error('A user with this email already exists. They can sign in with Google or their password.');
  }
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-user`;
  const apiKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const { data: sessionData } = await supabase!.auth.getSession();
  const accessToken = sessionData?.session?.access_token || apiKey;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: apiKey,
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to create user (${res.status})`);
  }
  const data = await res.json() as { id: string };
  return { id: data.id };
}

// ============ RATINGS & FEEDBACK ============
export type RatingTargetType = 'SYSTEM' | 'ROLE' | 'TASK' | 'EMPLOYEE' | 'PROJECT';

export interface RatingQuestion {
  id: string;
  question: string;
  description: string | null;
  rating_type: string;
  max_rating: number;
  comment_enabled: boolean;
  comment_required: boolean;
  target_type: RatingTargetType;
  target_role: string | null;
  target_task_name: string | null;
  status: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectRatingRequest {
  id: string;
  project_id: string;
  customer_id: string | null;
  customer_email: string | null;
  status: string;
  created_at: string;
  submitted_at: string | null;
}

export interface ProjectRating {
  id: string;
  rating_request_id: string;
  project_id: string;
  question_id: string;
  rating: number;
  comment: string | null;
  target_type: string;
  target_employee_id: string | null;
  target_role: string | null;
  target_task_id: string | null;
  target_task_name: string | null;
  customer_email: string | null;
  created_at: string;
}

export async function fetchRatingQuestions(): Promise<RatingQuestion[]> {
  const { data, error } = await supabase!.from('rating_questions').select('id, question, description, rating_type, max_rating, comment_enabled, comment_required, target_type, target_role, target_task_name, status, sort_order, created_at, updated_at').order('sort_order', { ascending: true }).limit(200);
  if (error) throw error;
  return data || [];
}

export async function createRatingQuestion(q: Partial<RatingQuestion>): Promise<RatingQuestion | null> {
  const { data, error } = await supabase!.from('rating_questions').insert(q).select().maybeSingle();
  if (error) throw error;
  return data as RatingQuestion | null;
}

export async function updateRatingQuestion(id: string, updates: Partial<RatingQuestion>): Promise<void> {
  const { error } = await supabase!.from('rating_questions').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function deleteRatingQuestion(id: string): Promise<void> {
  const { error } = await supabase!.from('rating_questions').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchRatingRequests(): Promise<ProjectRatingRequest[]> {
  const { data, error } = await supabase!.from('project_rating_requests').select('id, project_id, customer_id, customer_email, status, created_at, submitted_at').order('created_at', { ascending: false }).limit(500);
  if (error) throw error;
  return data || [];
}

export async function fetchRatingRequestByProject(projectId: string): Promise<ProjectRatingRequest | null> {
  const { data, error } = await supabase!.from('project_rating_requests').select('id, project_id, customer_id, customer_email, status, created_at, submitted_at').eq('project_id', projectId).maybeSingle();
  if (error) { console.error('fetchRatingRequestByProject error:', error); return null; }
  return data as ProjectRatingRequest | null;
}

export async function fetchRatingRequestsByCustomer(email: string): Promise<ProjectRatingRequest[]> {
  const { data, error } = await supabase!.from('project_rating_requests').select('id, project_id, customer_id, customer_email, status, created_at, submitted_at').eq('customer_email', email).order('created_at', { ascending: false }).limit(200);
  if (error) throw error;
  return data || [];
}

export async function createRatingRequest(req: Partial<ProjectRatingRequest>): Promise<ProjectRatingRequest | null> {
  const { data, error } = await supabase!.from('project_rating_requests').insert(req).select().maybeSingle();
  if (error) { console.error('createRatingRequest error:', error); return null; }
  return data as ProjectRatingRequest | null;
}

export async function updateRatingRequest(id: string, updates: Partial<ProjectRatingRequest>): Promise<void> {
  const { error } = await supabase!.from('project_rating_requests').update(updates).eq('id', id);
  if (error) throw error;
}

export async function fetchAllRatings(): Promise<ProjectRating[]> {
  const { data, error } = await supabase!.from('project_ratings').select('id, rating_request_id, project_id, question_id, rating, comment, target_type, target_employee_id, target_role, target_task_id, target_task_name, customer_email, created_at').order('created_at', { ascending: false }).limit(500);
  if (error) throw error;
  return data || [];
}

export async function fetchRatingsByRequest(requestId: string): Promise<ProjectRating[]> {
  const { data, error } = await supabase!.from('project_ratings').select('id, rating_request_id, project_id, question_id, rating, comment, target_type, target_employee_id, target_role, target_task_id, target_task_name, customer_email, created_at').eq('rating_request_id', requestId).order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchRatingsByEmployee(employeeId: string): Promise<ProjectRating[]> {
  const { data, error } = await supabase!.from('project_ratings').select('id, rating_request_id, project_id, question_id, rating, comment, target_type, target_employee_id, target_role, target_task_id, target_task_name, customer_email, created_at').eq('target_employee_id', employeeId).order('created_at', { ascending: false }).limit(500);
  if (error) throw error;
  return data || [];
}

export async function fetchRatingsByProject(projectId: string): Promise<ProjectRating[]> {
  const { data, error } = await supabase!.from('project_ratings').select('id, rating_request_id, project_id, question_id, rating, comment, target_type, target_employee_id, target_role, target_task_id, target_task_name, customer_email, created_at').eq('project_id', projectId).order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function submitRatings(
  requestId: string,
  projectId: string,
  customerEmail: string,
  entries: { questionId: string; rating: number; comment: string; targetType: string; targetRole: string | null; targetTaskName: string | null; targetEmployeeId: string | null; targetTaskId: string | null }[]
): Promise<boolean> {
  if (entries.length === 0) return false;
  const ratingsJson = entries.map((e) => ({
    question_id: e.questionId,
    rating: e.rating,
    comment: e.comment || null,
    target_type: e.targetType,
    target_role: e.targetRole,
    target_task_name: e.targetTaskName,
    target_employee_id: e.targetEmployeeId,
    target_task_id: e.targetTaskId,
  }));
  const { error } = await supabase!.rpc('submit_project_ratings', {
    p_request_id: requestId,
    p_ratings: ratingsJson,
  });
  if (error) { console.error('submitRatings error:', error); return false; }
  return true;
}

export async function ensureRatingRequestForProject(projectId: string, customerEmail: string | null, customerId: string | null): Promise<ProjectRatingRequest | null> {
  if (!customerEmail) return null;
  const existing = await fetchRatingRequestByProject(projectId);
  if (existing) return existing;
  return await createRatingRequest({ project_id: projectId, customer_id: customerId, customer_email: customerEmail, status: 'pending' });
}

// ============ GUEST PROOFING ============
export async function fetchProjectByShareToken(token: string): Promise<Project | null> {
  const { data, error } = await supabase!.rpc('get_project_by_share_token', { p_token: token });
  if (error) { console.error('fetchProjectByShareToken error:', error); return null; }
  return data as Project | null;
}

export async function fetchReviewFilesByShareToken(token: string): Promise<ReviewFile[]> {
  const { data, error } = await supabase!.rpc('guest_fetch_review_files', { p_token: token });
  if (error) { console.error('fetchReviewFilesByShareToken error:', error); return []; }
  return (data || []) as ReviewFile[];
}

export async function fetchCorrectionsByShareToken(token: string): Promise<Correction[]> {
  const { data, error } = await supabase!.rpc('guest_fetch_corrections', { p_token: token });
  if (error) { console.error('fetchCorrectionsByShareToken error:', error); return []; }
  return (data || []) as Correction[];
}

export async function guestSubmitCorrection(token: string, correction: Partial<Correction>): Promise<boolean> {
  const { data, error } = await supabase!.rpc('guest_submit_correction', {
    p_token: token,
    p_correction: correction as Record<string, unknown>,
  });
  if (error) { console.error('guestSubmitCorrection error:', error); return false; }
  return !!data;
}

export async function guestUpdateCorrection(token: string, correctionId: string, updates: Partial<Correction>): Promise<boolean> {
  const { data, error } = await supabase!.rpc('guest_update_correction', {
    p_token: token,
    p_correction_id: correctionId,
    p_updates: updates as Record<string, unknown>,
  });
  if (error) { console.error('guestUpdateCorrection error:', error); return false; }
  return !!data;
}

export async function fetchDraftCorrectionByToken(token: string, reviewFileId: string | null): Promise<Correction | null> {
  const { data, error } = await supabase!.rpc('guest_fetch_draft_correction', {
    p_token: token,
    p_review_file_id: reviewFileId,
  });
  if (error) { console.error('fetchDraftCorrectionByToken error:', error); return null; }
  return data as Correction | null;
}

export async function guestApproveProof(token: string): Promise<boolean> {
  const { error } = await supabase!.rpc('guest_approve_proof', { p_token: token });
  if (error) { console.error('guestApproveProof error:', error); return false; }
  return true;
}

export async function regenerateShareToken(projectId: string): Promise<string | null> {
  const newToken = crypto.randomUUID();
  const { error } = await supabase!.from('projects').update({ share_token: newToken, updated_at: new Date().toISOString() }).eq('id', projectId);
  if (error) { console.error('regenerateShareToken error:', error); return null; }
  return newToken;
}

// ============ BANK DETAILS ============
export interface BankDetails {
  bankName: string;
  branchName: string;
  accountHolder: string;
  accountNumber: string;
  ifscCode: string;
  upiName: string;
  upiId: string;
  upiMobile: string;
}

export async function fetchBankDetails(): Promise<BankDetails | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('settings').select('value').eq('key', 'bank').maybeSingle();
  if (error) { console.error('fetchBankDetails error:', error); return null; }
  if (!data?.value) return null;
  return data.value as BankDetails;
}

// ============ EMAIL TEMPLATES ============
export interface EmailTemplate {
  id: string;
  template_name: string;
  display_name: string;
  subject: string;
  body_content: string;
  target_role: string;
  available_variables: string[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export async function fetchEmailTemplates(): Promise<EmailTemplate[]> {
  const { data, error } = await supabase!.from('email_templates').select('id, template_name, display_name, subject, body_content, target_role, available_variables, enabled, created_at, updated_at').order('target_role', { ascending: true }).order('display_name', { ascending: true }).limit(200);
  if (error) { console.error('fetchEmailTemplates error:', error); return []; }
  return (data || []) as EmailTemplate[];
}

export async function updateEmailTemplate(id: string, updates: Partial<EmailTemplate>): Promise<void> {
  const { error } = await supabase!.from('email_templates').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function createEmailTemplate(template: {
  template_name: string;
  display_name: string;
  subject: string;
  body_content: string;
  target_role: string;
  available_variables?: string[];
}): Promise<EmailTemplate | null> {
  const { data, error } = await supabase!.from('email_templates').insert({
    template_name: template.template_name,
    display_name: template.display_name,
    subject: template.subject,
    body_content: template.body_content,
    target_role: template.target_role,
    available_variables: template.available_variables || [],
    enabled: true,
  }).select('id, template_name, display_name, subject, body_content, target_role, available_variables, enabled, created_at, updated_at').maybeSingle();
  if (error) throw error;
  return data as EmailTemplate | null;
}

export async function fetchEmailLogs(limit = 50): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabase!.from('email_logs').select('id, template_name, recipient, subject, status, created_at').order('created_at', { ascending: false }).limit(limit);
  if (error) { console.error('fetchEmailLogs error:', error); return []; }
  return (data || []) as Record<string, unknown>[];
}

// ============ AUTOMATED EMAIL UTILITY ============
// Replaces {{variable}} placeholders in subject and body with provided values,
// then logs the email to the email_logs table for audit/verification.
export async function sendAutomatedEmail(
  templateName: string,
  recipientData: Record<string, string>
): Promise<{ subject: string; body: string; sent: boolean }> {
  if (!supabase) return { subject: '', body: '', sent: false };
  const recipient = recipientData.customer_email || recipientData.editor_email || recipientData.recipient_email;
  const recipientName = recipientData.customer_name || recipientData.editor_name || recipientData.recipient_name || null;

  if (recipient) {
    await sendStatusEmail({ templateName, recipient, recipientName, variables: recipientData });
  }

  const { data: template } = await supabase
    .from('email_templates')
    .select('subject, body_content')
    .eq('template_name', templateName)
    .maybeSingle();
  if (!template) {
    console.warn(`[email] Template "${templateName}" not found`);
    return { subject: '', body: '', sent: false };
  }

  const replaceVars = (text: string) => text.replace(/\{\{(\w+)\}\}/g, (_, key) => recipientData[key] || `{{${key}}}`);
  const subject = replaceVars(template.subject);
  const body = replaceVars(template.body_content);

  return { subject, body, sent: !!recipient };
}

// ============ BROADCAST EMAILS ============

export interface BroadcastCampaign {
  id: string;
  subject: string;
  body_content: string;
  audience: 'customer' | 'editor';
  status: 'draft' | 'sending' | 'sent' | 'failed';
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  created_by: string | null;
  created_at: string;
  sent_at: string | null;
}

export async function fetchBroadcastCampaigns(): Promise<BroadcastCampaign[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('broadcast_campaigns')
    .select('id, subject, body_content, audience, status, recipient_count, sent_count, failed_count, created_by, created_at, sent_at')
    .order('created_at', { ascending: false }).limit(200);
  if (error) { console.error('fetchBroadcastCampaigns error:', error); return []; }
  return (data || []) as BroadcastCampaign[];
}

export async function createBroadcastCampaign(campaign: {
  subject: string;
  body_content: string;
  audience: 'customer' | 'editor';
  created_by?: string | null;
}): Promise<BroadcastCampaign | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('broadcast_campaigns')
    .insert({
      subject: campaign.subject,
      body_content: campaign.body_content,
      audience: campaign.audience,
      created_by: campaign.created_by || null,
      status: 'draft',
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data as BroadcastCampaign | null;
}

export async function updateBroadcastCampaign(id: string, updates: Partial<BroadcastCampaign>): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('broadcast_campaigns').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteBroadcastCampaign(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('broadcast_campaigns').delete().eq('id', id);
  if (error) throw error;
}

export async function sendBroadcastEmail(campaignId: string, subject: string, bodyContent: string, recipients: { email: string; name: string | null }[]): Promise<{ sentCount: number; failedCount: number; total: number }> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.functions.invoke('send-broadcast-email', {
    body: { campaignId, subject, bodyContent, recipients },
  });
  if (error) throw error;
  return data as { sentCount: number; failedCount: number; total: number };
}
