export const DELETED_USER_ID = 'system-deleted-user';
export type User = {
  id: string;
  name: string;
  role: 'coordinator' | 'member';
  job: string;
  color: string;
  registration_email?: string | null;
};
export type Status = 'progress' | 'blocked' | 'done';
export type Task = {
  id: string;
  title: string;
  description: string;
  assignee_id: string;
  assignee_ids: string[];
  created_by: string;
  week: string;
  due_date: string | null;
  priority: 'normal' | 'high';
  status: Status;
  restricted: number;
  block_reason: string;
};
export const statuses: Record<Status, string> = {
  progress: 'Em andamento',
  blocked: 'Bloqueado',
  done: 'Concluído',
};
