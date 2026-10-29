import type { CorporateUser, Workspace } from './AuthGate';
import type { AccessRequest } from './OnboardingForm';
export type AdminPerson = CorporateUser & {
  object_id: string | null;
  tenant_id: string | null;
  display_name: string | null;
  registration_email: string | null;
  protected_admin?: number;
};
export type Membership = {
  user_id: string;
  workspace_id: string;
  role: 'member' | 'coordinator';
  sector_job?: string | null;
};
export type AuditEntry = {
  id: string;
  actor_id: string;
  name: string;
  action: string;
  details: string;
  created_at: string;
};
export type AdminState = {
  scope: 'global' | 'sector';
  requests: AccessRequest[];
  users: AdminPerson[];
  workspaces: Workspace[];
  memberships: Membership[];
  audit: AuditEntry[];
};
export type AdminSave = (path: string, body: unknown) => Promise<boolean>;
export type BoardView = 'mine' | 'team' | 'meeting';
export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}
export function personStatus(user: AdminPerson) {
  return !user.object_id ? 'legacy' : user.access_status;
}
export const statusLabels: Record<string, string> = {
  active: 'Ativo',
  pending: 'Aguardando aprovação',
  blocked: 'Bloqueado',
  legacy: 'Sem vínculo',
};
export function dateTime(value: string) {
  return new Date(value.replace(' ', 'T') + 'Z').toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}
