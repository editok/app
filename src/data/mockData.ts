export const mockStats = {
  totalOrders: 248,
  activeProjects: 36,
  completedProjects: 192,
  pendingReview: 14,
  corrections: 8,
  customers: 64,
  employees: 28,
  revenue: 486200,
};

export const monthlyOrders = [
  { label: 'Jan', value: 18 },
  { label: 'Feb', value: 22 },
  { label: 'Mar', value: 28 },
  { label: 'Apr', value: 24 },
  { label: 'May', value: 32 },
  { label: 'Jun', value: 38 },
  { label: 'Jul', value: 42 },
  { label: 'Aug', value: 36 },
  { label: 'Sep', value: 44 },
  { label: 'Oct', value: 48 },
  { label: 'Nov', value: 52 },
  { label: 'Dec', value: 58 },
];

export const revenueData = [
  { label: 'Jan', value: 32000 },
  { label: 'Feb', value: 38000 },
  { label: 'Mar', value: 45000 },
  { label: 'Apr', value: 41000 },
  { label: 'May', value: 52000 },
  { label: 'Jun', value: 58000 },
  { label: 'Jul', value: 64000 },
  { label: 'Aug', value: 56000 },
  { label: 'Sep', value: 68000 },
  { label: 'Oct', value: 72000 },
  { label: 'Nov', value: 78000 },
  { label: 'Dec', value: 82000 },
];

export const categoryData = [
  { label: 'Wedding Photos', value: 120, color: '#3b82f6' },
  { label: 'Wedding Video', value: 80, color: '#22c55e' },
  { label: 'Pre-Wedding', value: 48, color: '#f97316' },
  { label: 'Reels & Shorts', value: 32, color: '#a855f7' },
];

export const employeePerformance = [
  { label: 'Rahul', value: 92, color: 'linear-gradient(180deg, #60a5fa 0%, #3b82f6 100%)' },
  { label: 'Priya', value: 88, color: 'linear-gradient(180deg, #4ade80 0%, #22c55e 100%)' },
  { label: 'Arjun', value: 76, color: 'linear-gradient(180deg, #fdba74 0%, #f97316 100%)' },
  { label: 'Sneha', value: 84, color: 'linear-gradient(180deg, #c084fc 0%, #a855f7 100%)' },
  { label: 'Vikram', value: 68, color: 'linear-gradient(180deg, #93c5fd 0%, #3b82f6 100%)' },
];

export interface Order {
  id: string;
  orderNumber: string;
  eventName: string;
  customer: string;
  category: string;
  deadline: string;
  status: string;
  progress: number;
  amount?: number;
  date?: string;
  task?: string;
  priority?: string;
  estimatedTime?: string;
  startedDate?: string;
}

export const orders: Order[] = [
  { id: '1', orderNumber: 'ORD-2401', eventName: 'Rahul & Priya Wedding', customer: 'Lens & Light Studios', category: 'Wedding Photos', deadline: '2026-07-18', status: 'in-progress', progress: 65, amount: 45000 },
  { id: '2', orderNumber: 'ORD-2402', eventName: 'Arjun & Divya Reception', customer: 'Frame Stories', category: 'Wedding Video', deadline: '2026-07-20', status: 'review', progress: 90, amount: 62000 },
  { id: '3', orderNumber: 'ORD-2403', eventName: 'Karthik Engagement', customer: 'Golden Hour Films', category: 'Pre-Wedding', deadline: '2026-07-15', status: 'assigned', progress: 0, amount: 28000 },
  { id: '4', orderNumber: 'ORD-2404', eventName: 'Vignesh Wedding Highlights', customer: 'Lens & Light Studios', category: 'Reels & Shorts', deadline: '2026-07-14', status: 'completed', progress: 100, amount: 15000 },
  { id: '5', orderNumber: 'ORD-2405', eventName: 'Suresh & Ananya Wedding', customer: 'Candid Moments', category: 'Wedding Photos', deadline: '2026-07-22', status: 'correction', progress: 85, amount: 52000 },
  { id: '6', orderNumber: 'ORD-2406', eventName: 'Mohan Reception Film', customer: 'Frame Stories', category: 'Wedding Video', deadline: '2026-07-25', status: 'processing', progress: 15, amount: 58000 },
  { id: '7', orderNumber: 'ORD-2407', eventName: 'Deepak & Lakshmi SDE', customer: 'Golden Hour Films', category: 'Wedding Video', deadline: '2026-07-19', status: 'in-progress', progress: 45, amount: 48000 },
  { id: '8', orderNumber: 'ORD-2408', eventName: 'Karthik & Meera Pre-Wedding', customer: 'Candid Moments', category: 'Pre-Wedding', deadline: '2026-07-28', status: 'completed', progress: 100, amount: 22000 },
  { id: '9', orderNumber: 'ORD-2409', eventName: 'Aditya Wedding Album', customer: 'Lens & Light Studios', category: 'Wedding Photos', deadline: '2026-07-30', status: 'assigned', progress: 0, amount: 38000 },
  { id: '10', orderNumber: 'ORD-2410', eventName: 'Ravi & Soumya Highlights', customer: 'Frame Stories', category: 'Reels & Shorts', deadline: '2026-07-12', status: 'rejected', progress: 70, amount: 12000 },
];

export const activityItems = [
  { id: '1', title: 'New project assigned', description: 'ORD-2401 assigned to Rahul Kumar', time: '10 min ago', status: 'current' },
  { id: '2', title: 'Upload completed', description: 'Arjun uploaded final cut for ORD-2407', time: '32 min ago', status: 'completed' },
  { id: '3', title: 'Correction received', description: 'Customer requested changes on ORD-2405', time: '1 hour ago', status: 'current' },
  { id: '4', title: 'Project approved', description: 'ORD-2404 approved by customer', time: '2 hours ago', status: 'completed' },
  { id: '5', title: 'New customer registered', description: 'Golden Hour Films joined', time: '4 hours ago', status: 'completed' },
  { id: '6', title: 'Payment received', description: '₹62,000 received from Frame Stories', time: '6 hours ago', status: 'completed' },
];

export interface Customer {
  id: string;
  company: string;
  email: string;
  phone: string;
  projects: number;
  status: string;
  logo?: string;
}

export const customers: Customer[] = [
  { id: '1', company: 'Lens & Light Studios', email: 'contact@lensandlight.com', phone: '+91 98765 43210', projects: 24, status: 'active' },
  { id: '2', company: 'Frame Stories', email: 'hello@framestories.com', phone: '+91 98765 12345', projects: 18, status: 'active' },
  { id: '3', company: 'Golden Hour Films', email: 'info@goldenhour.in', phone: '+91 90000 56789', projects: 12, status: 'active' },
  { id: '4', company: 'Candid Moments', email: 'team@candidmoments.com', phone: '+91 87654 32109', projects: 9, status: 'active' },
  { id: '5', company: 'Studio 24 Frames', email: 'info@studio24.in', phone: '+91 76543 21098', projects: 3, status: 'inactive' },
  { id: '6', company: 'Wedding Bell Films', email: 'contact@weddingbell.in', phone: '+91 65432 10987', projects: 6, status: 'active' },
  { id: '7', company: 'Memory Makers', email: 'hello@memorymakers.co', phone: '+91 54321 09876', projects: 0, status: 'inactive' },
];

export interface Employee {
  id: string;
  name: string;
  skills: string[];
  applications: string[];
  experience: number;
  rating: number;
  projects: number;
  status: string;
  email: string;
  avatar?: string;
}

export const employees: Employee[] = [
  { id: '1', name: 'Rahul Kumar', skills: ['Color Grading', 'Cinematic Edit'], applications: ['Premiere Pro', 'DaVinci'], experience: 6, rating: 4.8, projects: 142, status: 'working', email: 'rahul@editok.com' },
  { id: '2', name: 'Priya Sharma', skills: ['Photo Retouch', 'Album Design'], applications: ['Photoshop', 'Lightroom'], experience: 5, rating: 4.9, projects: 138, status: 'working', email: 'priya@editok.com' },
  { id: '3', name: 'Arjun Reddy', skills: ['Video Editing', 'Sound Design'], applications: ['Premiere Pro', 'Audition'], experience: 4, rating: 4.6, projects: 96, status: 'working', email: 'arjun@editok.com' },
  { id: '4', name: 'Sneha Patel', skills: ['Cinematic Color', 'Transitions'], applications: ['DaVinci', 'After Effects'], experience: 3, rating: 4.7, projects: 78, status: 'available', email: 'sneha@editok.com' },
  { id: '5', name: 'Vikram Singh', skills: ['Highlight Reels', 'Motion Graphics'], applications: ['Premiere Pro', 'After Effects'], experience: 2, rating: 4.3, projects: 52, status: 'available', email: 'vikram@editok.com' },
  { id: '6', name: 'Meera Iyer', skills: ['Photo Correction', 'Skin Retouch'], applications: ['Lightroom', 'Photoshop'], experience: 4, rating: 4.5, projects: 84, status: 'leave', email: 'meera@editok.com' },
];

export interface TaskTemplate {
  id: string;
  task: string;
  description: string;
  category: string;
  stage: string;
  priority: string;
  estimatedHours: number;
}

export const taskTemplates: TaskTemplate[] = [
  { id: '1', task: 'Culling & Selection', description: 'Select best photos from raw shoot', category: 'Wedding Photos', stage: 'Color Correction', priority: 'High', estimatedHours: 4 },
  { id: '2', task: 'Color Correction', description: 'Apply base color grading to all photos', category: 'Wedding Photos', stage: 'Color Correction', priority: 'High', estimatedHours: 6 },
  { id: '3', task: 'Skin Retouching', description: 'Retouch skin and blemishes on selected photos', category: 'Wedding Photos', stage: 'Color Correction', priority: 'Medium', estimatedHours: 8 },
  { id: '4', task: 'Album Layout Design', description: 'Design wedding album layout', category: 'Wedding Photos', stage: 'Layout Design', priority: 'Medium', estimatedHours: 10 },
  { id: '5', task: 'Layout Quality Check', description: 'Review album layout for consistency', category: 'Wedding Photos', stage: 'Quality Check', priority: 'High', estimatedHours: 3 },
  { id: '6', task: 'Customer Review', description: 'Send to customer for review and approval', category: 'Wedding Photos', stage: 'Review', priority: 'Medium', estimatedHours: 2 },
  { id: '7', task: 'Video Culling', description: 'Select best footage clips', category: 'Wedding Video', stage: 'Editing', priority: 'High', estimatedHours: 5 },
  { id: '8', task: 'Rough Cut', description: 'Assemble timeline with selected clips', category: 'Wedding Video', stage: 'Editing', priority: 'High', estimatedHours: 12 },
  { id: '9', task: 'Color Grading', description: 'Apply cinematic color grade', category: 'Wedding Video', stage: 'Editing', priority: 'High', estimatedHours: 8 },
  { id: '10', task: 'Sound Mixing', description: 'Mix audio levels and add music', category: 'Wedding Video', stage: 'Editing', priority: 'Medium', estimatedHours: 6 },
  { id: '11', task: 'Video Quality Check', description: 'Review final cut for quality and consistency', category: 'Wedding Video', stage: 'Quality Check', priority: 'High', estimatedHours: 4 },
  { id: '12', task: 'Customer Review', description: 'Send final cut to customer for approval', category: 'Wedding Video', stage: 'Review', priority: 'Medium', estimatedHours: 2 },
];

export interface PhotoMark {
  id: string;
  label: string;
  comment: string;
}

export interface VideoTimestamp {
  id: string;
  time: number;
  timeFormatted: string;
  comment: string;
}

export interface VoiceNoteItem {
  id: string;
  duration: string;
  context: 'photo' | 'video';
  refLabel?: string;
  time?: number;
}

export interface Correction {
  id: string;
  number: string;
  customer: string;
  orderId?: string;
  eventName?: string;
  comment: string;
  priority: string;
  editor: string;
  dueDate: string;
  status: string;
  attachments: number;
  photoMarks: PhotoMark[];
  videoTimestamps: VideoTimestamp[];
  voiceNotes: VoiceNoteItem[];
}

export const corrections: Correction[] = [
  {
    id: '1', number: 'COR-001', customer: 'Lens & Light Studios', orderId: 'ORD-2401', eventName: 'Rahul & Priya Wedding',
    comment: 'Skin tones look too warm in outdoor shots, please cool down slightly', priority: 'High', editor: 'Priya Sharma', dueDate: '2026-07-13', status: 'in-progress', attachments: 3,
    photoMarks: [
      { id: 'm1', label: 'Cover Shot', comment: 'Skin tones look too warm, please cool down slightly' },
      { id: 'm2', label: 'Couple Portrait', comment: 'Background is distracting, can we blur it more?' },
    ],
    videoTimestamps: [],
    voiceNotes: [
      { id: 'v1', duration: '0:24', context: 'photo', refLabel: 'Cover Shot' },
    ],
  },
  {
    id: '2', number: 'COR-002', customer: 'Candid Moments', orderId: 'ORD-2405', eventName: 'Suresh & Ananya Wedding',
    comment: 'Need more contrast in the album, some photos look flat', priority: 'Medium', editor: 'Rahul Kumar', dueDate: '2026-07-14', status: 'pending', attachments: 1,
    photoMarks: [
      { id: 'm3', label: 'Mandap Ceremony', comment: 'Need more contrast, photo looks flat' },
    ],
    videoTimestamps: [],
    voiceNotes: [],
  },
  {
    id: '3', number: 'COR-003', customer: 'Frame Stories', orderId: 'ORD-2402', eventName: 'Arjun & Divya Reception',
    comment: 'Background music too loud in the ceremony section', priority: 'High', editor: 'Arjun Reddy', dueDate: '2026-07-12', status: 'in-progress', attachments: 2,
    photoMarks: [],
    videoTimestamps: [
      { id: 't1', time: 12, timeFormatted: '0:12', comment: 'The transition here feels abrupt — can we add a crossfade?' },
      { id: 't2', time: 35, timeFormatted: '0:35', comment: 'Music is too loud during the vows, please lower it' },
    ],
    voiceNotes: [
      { id: 'v2', duration: '0:18', context: 'video', time: 35 },
    ],
  },
  {
    id: '4', number: 'COR-004', customer: 'Golden Hour Films', orderId: 'ORD-2407', eventName: 'Deepak & Lakshmi SDE',
    comment: 'Add slow-motion effect in the varmala sequence', priority: 'Low', editor: 'Sneha Patel', dueDate: '2026-07-16', status: 'completed', attachments: 0,
    photoMarks: [],
    videoTimestamps: [
      { id: 't3', time: 48, timeFormatted: '0:48', comment: 'Add slow-motion effect in the varmala sequence' },
    ],
    voiceNotes: [],
  },
  {
    id: '5', number: 'COR-005', customer: 'Lens & Light Studios', orderId: 'ORD-2401', eventName: 'Rahul & Priya Wedding',
    comment: 'Some candid shots are blurry, need resharping or replacement', priority: 'High', editor: 'Priya Sharma', dueDate: '2026-07-15', status: 'pending', attachments: 4,
    photoMarks: [
      { id: 'm4', label: 'Candid Laugh', comment: 'This shot is blurry, need resharping or replacement' },
    ],
    videoTimestamps: [],
    voiceNotes: [
      { id: 'v3', duration: '0:31', context: 'photo', refLabel: 'Candid Laugh' },
    ],
  },
];

export interface Notification {
  id: string;
  type: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
}

export const notifications: Notification[] = [
  { id: '1', type: 'project', title: 'New project assigned', description: 'ORD-2401 Rahul & Priya Wedding has been assigned to you', time: '10 min ago', read: false },
  { id: '2', type: 'deadline', title: 'Deadline reminder', description: 'ORD-2404 Vignesh Wedding Highlights due in 2 days', time: '1 hour ago', read: false },
  { id: '3', type: 'correction', title: 'Correction received', description: 'Customer requested changes on ORD-2405', time: '2 hours ago', read: false },
  { id: '4', type: 'approval', title: 'Project approved', description: 'ORD-2404 has been approved by the customer', time: '3 hours ago', read: true },
  { id: '5', type: 'payment', title: 'Payment received', description: '₹62,000 received from Frame Stories', time: '5 hours ago', read: true },
  { id: '6', type: 'project', title: 'New project assigned', description: 'ORD-2409 Aditya Wedding Album assigned to Rahul Kumar', time: '1 day ago', read: true },
];

export const leaderboard = [
  { rank: 1, name: 'Priya Sharma', projects: 24, score: 96, avatar: 'PS' },
  { rank: 2, name: 'Rahul Kumar', projects: 22, score: 92, avatar: 'RK' },
  { rank: 3, name: 'Arjun Reddy', projects: 18, score: 88, avatar: 'AR' },
  { rank: 4, name: 'Sneha Patel', projects: 14, score: 84, avatar: 'SP' },
  { rank: 5, name: 'Vikram Singh', projects: 10, score: 76, avatar: 'VS' },
];

export const announcements = [
  { id: '1', title: 'New color grading workflow', description: 'We have updated our color grading process for faster turnaround times.', time: '2 hours ago' },
  { id: '2', title: 'Team meeting on Friday', description: 'Monthly review meeting at 4 PM. All editors are required to attend.', time: '1 day ago' },
  { id: '3', title: 'New template library', description: '20 new album design templates have been added to the library.', time: '3 days ago' },
];

export interface StageDef {
  label: string;
  /** 0-based index of the stage that is currently active for this order */
  currentIndex: number;
}

export const categoryStages: Record<string, string[]> = {
  'Wedding Photos': ['Color Correction', 'Layout Design', 'Quality Check', 'Review'],
  'Wedding Video': ['Editing', 'Quality Check', 'Review'],
  'Pre-Wedding': ['Color Correction', 'Layout Design', 'Quality Check', 'Review'],
  'Reels & Shorts': ['Editing', 'Quality Check', 'Review'],
};

export function getStagesForOrder(order: { category: string; status: string; progress: number }) {
  const stages = categoryStages[order.category] || categoryStages['Wedding Photos'];
  const total = stages.length;
  let currentIdx: number;

  if (order.status === 'completed') {
    currentIdx = total; // all done
  } else if (order.status === 'processing' || order.status === 'assigned') {
    currentIdx = 0; // not started yet
  } else if (order.status === 'review') {
    currentIdx = total - 1; // at review
  } else if (order.status === 'correction') {
    currentIdx = total - 1; // back at review/correction
  } else if (order.status === 'rejected') {
    currentIdx = total - 1;
  } else {
    // in-progress: map progress to stage index
    currentIdx = Math.min(total - 1, Math.floor((order.progress / 100) * total));
  }

  return stages.map((label, i) => {
    let status: 'completed' | 'current' | 'pending';
    if (i < currentIdx) status = 'completed';
    else if (i === currentIdx && order.status !== 'completed') status = 'current';
    else status = 'pending';
    return { label, status, index: i };
  });
}
