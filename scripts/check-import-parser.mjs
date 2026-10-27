import assert from 'node:assert/strict';
import { parsePlanning, importDueDate } from '../worker/planning-parser.ts';
const users = [
  ['gustavo', 'Gustavo Mendes'],
  ['bruno', 'Bruno Alves de Carvalho'],
  ['tonello', 'Tonello'],
  ['eduardo', 'Eduardo Fortes da Silva'],
].map(([id, name]) => ({
  id,
  name,
  role: 'member',
  job: 'TI',
  color: '#245940',
}));
const example = `👤 Gustavo

- Contrato parceria - melhoria
- Plugin (suporte) - Em testes
- Projeto Reembolso - Testes Tamara e Marcelo
- Chamados via Whatpsapp - orçamento API
- Orçamento Rede Mario
- Atualização Painel de qualidade
- Limpeza Painel de produção - Reestilização
- Readequação licenças copilot
- Manutenção notebook Mario

 👤 Bruno

- Devoluções impressoras - Chamado aberto
- Impressoras produção- Helyo
- Projeto Eliabe - Testes finais
- Projeto reembolso - testes tamara e Marcelo
- Projeto monitoramento

👤 Tonello

- Projeto Orvalho - Instalar estoque pcp.
- Monitoramento Notebooks
- Orçamento plataforma cloud para atividades via whatsapp + IA leitura de imagens
- Arrumar notebooks e organizar
- Melhoria Orvalho
- Varredura de segurança codex x claude

👤 Eduardo

- PCP`;
const originalFetch = globalThis.fetch;
globalThis.fetch = () => {
  throw new Error('Não pode chamar serviços externos.');
};
try {
  assert.equal(
    importDueDate(new Date('2026-10-26T15:00:00Z')),
    '2026-11-02',
    'Segunda vence na segunda seguinte',
  );
  assert.equal(
    importDueDate(new Date('2026-10-27T01:00:00Z')),
    '2026-11-02',
    'Usar a data de São Paulo, ainda segunda',
  );
  assert.equal(importDueDate(new Date('2026-12-28T15:00:00Z')), '2027-01-04');
  assert.equal(importDueDate(new Date('2028-02-23T15:00:00Z')), '2028-03-01');
  const dated = parsePlanning(
    '👤 Eduardo\nPCP',
    users,
    new Date('2026-10-26T15:00:00Z'),
  );
  assert.equal(dated.tasks[0].due_date, '2026-11-02');
  const result = parsePlanning(example, users);
  assert.equal(result.tasks.length, 21);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    users.map((u) => result.tasks.filter((t) => t.assignee_id === u.id).length),
    [9, 5, 6, 1],
  );
  assert.equal(result.tasks[1].title, 'Plugin (suporte) - Em testes');
  assert.equal(
    result.tasks[9].title,
    'Devoluções impressoras - Chamado aberto',
  );
  assert.ok(
    result.tasks.every(
      (t) =>
        t.status === 'progress' &&
        t.priority === 'normal' &&
        t.due_date === importDueDate(),
    ),
  );
  const withoutMarkers = parsePlanning(example.replace(/^- /gm, ''), users);
  assert.deepEqual(
    withoutMarkers,
    result,
    'Texto copiado sem marcadores deve gerar os mesmos 21 cartões',
  );
  const plainNested = parsePlanning(
    '👤 Eduardo\nCâmeras Douglas\n  Puxar cabeamento\n  Orçamento Paulo\nPCP',
    users,
  );
  assert.equal(plainNested.tasks.length, 2);
  assert.deepEqual(plainNested.tasks[0].checklist, [
    'Puxar cabeamento',
    'Orçamento Paulo',
  ]);
  const mixed = parsePlanning(
    '👤 Gustavo\nContrato parceria - melhoria\n- Plugin (suporte) - Em testes\nManutenção notebook Mario',
    users,
  );
  assert.equal(mixed.tasks.length, 3);
  assert.equal(mixed.warnings.length, 0);
  const nested = parsePlanning(
    '  👤 EDUÁRDO:\r\n\r\n  - Câmeras Douglas\r\n\u00a0   - Puxar cabeamento\r\n\t- Orçamento Paulo\r\n  - PCP',
    users,
  );
  assert.equal(nested.tasks.length, 2);
  assert.equal(nested.tasks[0].assignee_id, 'eduardo');
  assert.deepEqual(nested.tasks[0].checklist, [
    'Puxar cabeamento',
    'Orçamento Paulo',
  ]);
  const unknown = parsePlanning(
    '👤 Pessoa desconhecida\n- Alguma tarefa',
    users,
  );
  assert.equal(unknown.tasks[0].assignee_id, null);
  assert.ok(unknown.warnings.length);
  const ambiguous = parsePlanning('👤 Bruno\n- Alguma tarefa', [
    ...users,
    { ...users[1], id: 'another', name: 'Bruno Rech' },
  ]);
  assert.equal(ambiguous.tasks[0].assignee_id, null);
  const noHeader = parsePlanning('- Tarefa sem pessoa', users);
  assert.equal(noHeader.tasks[0].assignee_id, null);
  assert.ok(noHeader.warnings.length);
  const invalid = parsePlanning('Linha solta\n👤 Eduardo\n- PCP', users);
  assert.ok(invalid.warnings.some((w) => w.includes('Linha 1')));
  assert.equal(
    parsePlanning('👤 Eduardo\nSem marcador', users).tasks.length,
    1,
  );
  assert.throws(
    () =>
      parsePlanning(
        '👤 Eduardo\n' + Array(51).fill('- Tarefa').join('\n'),
        users,
      ),
    /50 cartões/,
  );
  assert.throws(
    () => parsePlanning('👤 Eduardo\n- ' + 'a'.repeat(181), users),
    /180 caracteres/,
  );
  assert.throws(
    () =>
      parsePlanning(
        '👤 Eduardo\n- Tarefa\n' + Array(31).fill('  - etapa').join('\n'),
        users,
      ),
    /30 etapas/,
  );
  assert.throws(
    () => parsePlanning('👤 Eduardo\n- Tarefa\n  - ' + 'a'.repeat(301), users),
    /300 caracteres/,
  );
  assert.throws(() => parsePlanning(' ', users), /20.000/);
  console.log(
    'OK: exemplo com 21 cartões (9/5/6/1), títulos preservados, nomes, ambiguidades, checklist, CRLF/NBSP/tabs, limites e nenhuma chamada externa.',
  );
} finally {
  globalThis.fetch = originalFetch;
}
