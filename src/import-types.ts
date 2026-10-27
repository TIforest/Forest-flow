import type { Status } from './types';
export type ImportTask = {
  title: string;
  description: string;
  assignee_id: string | null;
  responsible_name: string;
  due_date: string | null;
  priority: 'normal' | 'high';
  status: Status;
  block_reason: string;
  checklist: string[];
};
export type ImportPreview = { tasks: ImportTask[]; warnings: string[] };
export type ChecklistItem = { id: string; text: string; done: boolean };
