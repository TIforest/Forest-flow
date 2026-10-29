import { useState } from 'react';
import type { AccessRequest } from './OnboardingForm';
import type { Workspace } from './AuthGate';
export function AccessReview({
  request,
  workspaces,
  save,
}: {
  request: AccessRequest;
  workspaces: Workspace[];
  save: (path: string, body: unknown) => Promise<boolean>;
}) {
  const [workspace, setWorkspace] = useState(''),
    [role, setRole] = useState('member'),
    [note, setNote] = useState('');
  return (
    <article className="access-review">
      <div className="admin-row">
        <strong>{request.name}</strong>
        <span>
          {request.status === 'submitted'
            ? 'Aguardando análise'
            : request.status === 'approved'
              ? 'Aprovado'
              : 'Correção solicitada'}
        </span>
      </div>
      <dl className="request-summary">
        <dt>Conta Microsoft</dt>
        <dd>
          {request.display_name} · {request.email}
        </dd>
        <dt>Cargo informado</dt>
        <dd>{request.job}</dd>
        <dt>Setor informado</dt>
        <dd>{request.department}</dd>
        {request.unit && (
          <>
            <dt>Unidade</dt>
            <dd>{request.unit}</dd>
          </>
        )}
        {request.notes && (
          <>
            <dt>Observações</dt>
            <dd>{request.notes}</dd>
          </>
        )}
        <dt>Enviado em</dt>
        <dd>
          {new Date(
            request.submitted_at.replace(' ', 'T') + 'Z',
          ).toLocaleString('pt-BR')}
        </dd>
      </dl>
      {request.status === 'submitted' && request.access_status === 'pending' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save('review', {
              user_id: request.user_id,
              decision: 'approve',
              workspace_id: workspace,
              role,
              note,
            });
          }}
        >
          <label>
            Setor autorizado
            <select
              required
              value={workspace}
              onChange={(e) => setWorkspace(e.target.value)}
            >
              <option value="">Selecione o setor</option>
              {workspaces
                .filter((w) => w.active)
                .map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Função autorizada
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="member">Membro</option>
              <option value="coordinator">Coordenador</option>
            </select>
          </label>
          <label className="review-note">
            Mensagem para a pessoa
            <textarea
              rows={2}
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Obrigatória ao solicitar correção"
            />
          </label>
          <button className="primary" type="submit">
            Aprovar entrada
          </button>
          <button
            className="secondary"
            type="button"
            disabled={!note.trim()}
            onClick={() =>
              void save('review', {
                user_id: request.user_id,
                decision: 'reject',
                note,
              })
            }
          >
            Solicitar correção
          </button>
        </form>
      ) : request.review_note ? (
        <p>Mensagem: {request.review_note}</p>
      ) : null}
    </article>
  );
}
