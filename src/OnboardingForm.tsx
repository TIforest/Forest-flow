import { useState } from 'react';
import type { CorporateUser } from './AuthGate';
import { Brand } from './Brand';
export type AccessRequest = {
  user_id?: string;
  name: string;
  job: string;
  department: string;
  unit: string;
  notes: string;
  status: 'submitted' | 'approved' | 'rejected';
  submitted_at: string;
  review_note: string;
  email?: string;
  display_name?: string;
  access_status?: string;
};
export function OnboardingForm({
  user,
  request,
  onChange,
  logout,
}: {
  user: CorporateUser;
  request: AccessRequest | null;
  onChange: () => Promise<void>;
  logout: () => Promise<void>;
}) {
  const [name, setName] = useState(request?.name || user.name),
    [job, setJob] = useState(
      request?.job || (user.job === 'Colaborador' ? '' : user.job),
    ),
    [department, setDepartment] = useState(request?.department || ''),
    [unit, setUnit] = useState(request?.unit || ''),
    [notes, setNotes] = useState(request?.notes || ''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/auth/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, job, department, unit, notes }),
      });
      const d = (await r.json()) as { error?: string };
      if (!r.ok)
        throw new Error(d.error || 'Não foi possível enviar seu cadastro.');
      await onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-shell">
      <div className="auth-card onboarding-card">
        <div className="brand">
          <Brand />
        </div>
        <h1>
          {request?.status === 'submitted'
            ? 'Cadastro enviado para análise'
            : 'Complete seu cadastro'}
        </h1>
        <p>
          {request?.status === 'submitted'
            ? 'O administrador recebeu suas informações no Forest Flow. Você poderá acessar as atividades depois da aprovação e da definição do seu setor.'
            : 'Seu login Microsoft foi confirmado. Preencha seus dados para o administrador validar sua entrada.'}
        </p>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {request?.status === 'rejected' && (
          <div className="auth-notice" role="status">
            <strong>O administrador solicitou uma correção:</strong>
            <p>{request.review_note}</p>
          </div>
        )}
        {request?.status === 'submitted' ? (
          <>
            <dl className="request-summary">
              <dt>Nome informado</dt>
              <dd>{request.name}</dd>
              <dt>Cargo</dt>
              <dd>{request.job}</dd>
              <dt>Setor solicitado</dt>
              <dd>{request.department}</dd>
              <dt>Conta Microsoft</dt>
              <dd>{user.email}</dd>
            </dl>
            <button
              className="primary"
              onClick={() => void onChange().catch((e) => setError(e.message))}
            >
              Verificar aprovação
            </button>
          </>
        ) : (
          <form onSubmit={submit}>
            <fieldset disabled={busy} className="onboarding-fields">
              <label>
                E-mail corporativo
                <input value={user.email} readOnly type="email" />
                <small>Confirmado pela Microsoft.</small>
              </label>
              <label>
                Nome completo *
                <input
                  autoFocus
                  required
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </label>
              <label>
                Cargo *
                <input
                  required
                  maxLength={120}
                  value={job}
                  onChange={(e) => setJob(e.target.value)}
                  placeholder="Ex.: Analista de TI"
                  autoComplete="organization-title"
                />
              </label>
              <label>
                Setor em que trabalha *
                <input
                  required
                  maxLength={120}
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="Ex.: TI, RH ou Financeiro"
                />
              </label>
              <label>
                Unidade / local de trabalho
                <input
                  maxLength={120}
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="Opcional"
                />
              </label>
              <label>
                Observações para o administrador
                <textarea
                  maxLength={1000}
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Opcional"
                />
              </label>
              <small>
                O administrador confirmará os dados e definirá seus setores e
                permissões.
              </small>
              <button className="primary" type="submit" disabled={busy}>
                {busy
                  ? 'Enviando…'
                  : request
                    ? 'Reenviar para análise'
                    : 'Enviar para aprovação'}
              </button>
            </fieldset>
          </form>
        )}
        <button
          className="auth-link onboarding-logout"
          onClick={() => void logout().catch((e) => setError(e.message))}
        >
          Sair
        </button>
      </div>
    </div>
  );
}
