import type { ProjectRating, RatingQuestion } from '../data/db';

export interface QuestionStat {
  questionId: string;
  question: string;
  target_type: string;
  count: number;
  average: number;
  total: number;
}

export function computeQuestionStats(ratings: ProjectRating[], questions: RatingQuestion[]): QuestionStat[] {
  const map = new Map<string, QuestionStat>();
  for (const q of questions) {
    map.set(q.id, { questionId: q.id, question: q.question, target_type: q.target_type, count: 0, average: 0, total: 0 });
  }
  for (const r of ratings) {
    const stat = map.get(r.question_id);
    if (!stat) {
      map.set(r.question_id, { questionId: r.question_id, question: r.target_task_name || r.target_role || 'Unknown', target_type: r.target_type, count: 1, average: r.rating, total: r.rating });
    } else {
      stat.count += 1;
      stat.total += r.rating;
    }
  }
  for (const s of map.values()) {
    s.average = s.count > 0 ? s.total / s.count : 0;
  }
  return Array.from(map.values()).sort((a, b) => b.average - a.average);
}

export interface EmployeeStat {
  employeeId: string;
  count: number;
  average: number;
  total: number;
  byTask: Map<string, { count: number; total: number; average: number }>;
}

export function computeEmployeeStats(ratings: ProjectRating[]): Map<string, EmployeeStat> {
  const map = new Map<string, EmployeeStat>();
  for (const r of ratings) {
    if (!r.target_employee_id) continue;
    let stat = map.get(r.target_employee_id);
    if (!stat) {
      stat = { employeeId: r.target_employee_id, count: 0, average: 0, total: 0, byTask: new Map() };
      map.set(r.target_employee_id, stat);
    }
    stat.count += 1;
    stat.total += r.rating;
    const taskName = r.target_task_name || r.target_role || 'General';
    let taskStat = stat.byTask.get(taskName);
    if (!taskStat) {
      taskStat = { count: 0, total: 0, average: 0 };
      stat.byTask.set(taskName, taskStat);
    }
    taskStat.count += 1;
    taskStat.total += r.rating;
  }
  for (const s of map.values()) {
    s.average = s.count > 0 ? s.total / s.count : 0;
    for (const t of s.byTask.values()) {
      t.average = t.count > 0 ? t.total / t.count : 0;
    }
  }
  return map;
}

export function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function formatRating(n: number): string {
  return n.toFixed(2);
}
