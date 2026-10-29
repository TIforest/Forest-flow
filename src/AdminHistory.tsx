import { useEffect, useRef } from 'react';
import { X, History } from 'lucide-react';
import type { AdminState, AdminPerson } from './admin-model';
import { dateTime } from './admin-model';
const labels: Record<string, string> = {
  access: 'Alteração de acesso',
  membership: 'Participação no setor',
  workspace: 'Alteração de setor',
  link: 'Vínculo de identidade',
  review: 'Análise de solicitação',
  delete_profile: 'Exclusão de perfil',
  administrator: 'Papel de administrador',
  'member-profile': 'Cargo no setor',
};
export function AdminHistory({
  state,
  person,
  close,
}: {
  state: AdminState;
  person: AdminPerson | null;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
    return () => el?.close();
  }, []);
  const entries = state.audit.filter((a) => {
    if (!person) return true;
    try {
      const d = JSON.parse(a.details);
      return (
        a.actor_id === person.id ||
        [d.user_id, d.source_id, d.target_id].includes(person.id)
      );
    } catch {
      return a.actor_id === person.id;
    }
  });
  const resolve = (key: string, v: unknown) => {
    if (
      typeof v === 'string' &&
      ['user_id', 'source_id', 'target_id'].includes(key)
    )
      return state.users.find((u) => u.id === v)?.name || 'Perfil removido';
    if (key === 'workspace_id')
      return state.workspaces.find((w) => w.id === v)?.name || '—';
    if (key === 'role')
      return v === 'coordinator'
        ? 'Coordenador'
        : v === 'member'
          ? 'Membro'
          : 'Removido';
    if (key === 'status')
      return (
        (
          {
            active: 'Liberado',
            pending: 'Aguardando aprovação',
            blocked: 'Bloqueado',
          } as Record<string, string>
        )[String(v)] || String(v)
      );
    return typeof v === 'boolean' ? (v ? 'Sim' : 'Não') : String(v ?? '—');
  };
  return (
    <dialog ref={dialog} className="admin-history-dialog" onCancel={close}>
      <div className="admin-dialog-title">
        <div>
          <span className="admin-eyebrow">
            <History size={15} /> Histórico administrativo
          </span>
          <h2>{person ? person.name : 'Últimas alterações'}</h2>
        </div>
        <button
          className="icon-button"
          onClick={close}
          aria-label="Fechar histórico"
        >
          <X size={20} />
        </button>
      </div>
      <p className="admin-muted">
        Registros das últimas 50 alterações administrativas.
      </p>
      <div className="admin-audit-list">
        {entries.length ? (
          entries.map((a) => (
            <article key={a.id}>
              <div>
                <strong>{labels[a.action] || a.action}</strong>
                <time>{dateTime(a.created_at)}</time>
              </div>
              <p>{a.name}</p>
              <details>
                <summary>Detalhes do registro</summary>
                <dl>
                  {Object.entries(
                    (() => {
                      try {
                        return JSON.parse(a.details);
                      } catch {
                        return { registro: a.details };
                      }
                    })(),
                  ).map(([key, value]) => (
                    <div key={key}>
                      <dt>
                        {(
                          {
                            user_id: 'Pessoa',
                            source_id: 'Conta Microsoft',
                            target_id: 'Perfil histórico',
                            workspace_id: 'Setor',
                            role: 'Função',
                            status: 'Acesso',
                            name: 'Nome',
                            active: 'Ativo',
                            decision: 'Decisão',
                            note: 'Mensagem',
                            history: 'Histórico',
                            object_id: 'Identificação Microsoft',
                            is_admin: 'Administrador do sistema',
                            job: 'Cargo no setor',
                          } as Record<string, string>
                        )[key] || key}
                      </dt>
                      <dd>{resolve(key, value)}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            </article>
          ))
        ) : (
          <div className="admin-empty">
            <History size={24} />
            <strong>Nenhum registro encontrado</strong>
            <p>As alterações aparecerão aqui.</p>
          </div>
        )}
      </div>
      <button className="secondary" onClick={close}>
        Fechar histórico
      </button>
    </dialog>
  );
}
