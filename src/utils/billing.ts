import type { ProjectPayment } from '../data/db';

export function sumVerifiedPaid(payments: ProjectPayment[]): number {
  return payments.filter((p) => p.status === 'verified').reduce((s, p) => s + p.amount, 0);
}
