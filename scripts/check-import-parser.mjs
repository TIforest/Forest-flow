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
  assert.equal(invalid.tasks[0].title, 'Linha solta');
  assert.equal(invalid.tasks[0].assignee_id, null);
  assert.ok(invalid.warnings.length);
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
  const long = parsePlanning('👤 Eduardo\n- ' + 'a'.repeat(181), users);
  assert.ok(long.tasks[0].title.length <= 180);
  assert.equal(long.tasks[0].description, 'a'.repeat(181));
  assert.ok(long.warnings.length);
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
  const meetingText = `Eduardo

Eduardo Silva - Forest: Envie a Luiza os dois relatórios de contagem de estoque na sexta-feira.

Eduardo Silva - Forest: Compare a contagem da planilha com os registros do Proteus para a Forest e a Revita.

Eduardo Silva - Forest: Verifique presencialmente o estoque da Revita, converse com Henrique e apresente os resultados na semana
Eduardo Silva - Forest: Envie a Luiza uma atualização sobre as definições da reunião relativa ao estoque de R$ 48 milhões.
Eduardo Silva - Forest: Conclua a limpeza dos itens fantasma na semana seguinte.
Eduardo Silva - Forest: Agende uma reunião com Júlio para esclarecer a situação do custeio na semana seguinte.
Eduardo Silva - Forest: Agende uma apresentação dos chamados e reembolsos via WhatsApp.
Eduardo Silva - Forest: Levante o valor mensal do Force DML e informe Luiza.
Eduardo Silva - Forest: Envie o posicionamento e as medidas das tomadas, além do modelo das caixinhas, para a preparação do recorte na cabeceira.`;
  const fixedNow = new Date('2026-10-28T15:00:00Z');
  const meeting = parsePlanning(meetingText, users, fixedNow);
  assert.equal(meeting.tasks.length, 9);
  assert.ok(
    meeting.tasks.every(
      (t) =>
        t.assignee_id === 'eduardo' &&
        !t.title.includes('Eduardo Silva - Forest:') &&
        !!t.due_date,
    ),
  );
  assert.equal(meeting.tasks[0].due_date, '2026-10-30');
  assert.equal(meeting.tasks[1].due_date, importDueDate(fixedNow));
  assert.equal(
    meeting.tasks[0].title,
    'Envie a Luiza os dois relatórios de contagem de estoque na sexta-feira.',
  );
  assert.ok(meeting.tasks[3].title.includes('R$ 48 milhões'));
  assert.ok(meeting.warnings.some((w) => w.includes('prazo padrão')));
  assert.deepEqual(
    parsePlanning(
      meetingText
        .split('\n')
        .filter((l) => l.includes('Forest:'))
        .join('\n'),
      users,
      fixedNow,
    ).tasks,
    meeting.tasks,
    'Cabeçalho de grupo é opcional quando cada linha tem o responsável',
  );
  const variants = parsePlanning(
    '## Eduardo\n1. Revisar o painel\n2) Conferir estoque\n  a compra de telas\n\n**Bruno:**\n- [ ] Configurar notebook\n- [x] Conferir backup',
    users,
  );
  assert.equal(variants.tasks.length, 4);
  assert.deepEqual(variants.tasks[1].checklist, ['a compra de telas']);
  assert.equal(variants.tasks[2].assignee_id, 'bruno');
  assert.equal(variants.tasks[3].status, 'progress');
  const inline = parsePlanning(
    'Eduardo: Enviar relatórios\nBruno - Revisar backup\nGustavo: Power BI: testes finais',
    users,
  );
  assert.deepEqual(
    inline.tasks.map((t) => t.assignee_id),
    ['eduardo', 'bruno', 'gustavo'],
  );
  assert.equal(inline.tasks[2].title, 'Power BI: testes finais');
  const group = parsePlanning(
    'Responsáveis: Eduardo e Bruno\nRevisar estoque',
    users,
  );
  assert.equal(group.tasks[0].assignee_id, 'eduardo');
  assert.deepEqual(group.tasks[0].extra_assignee_ids, ['bruno']);
  const contextual = parsePlanning(
    'Eduardo\nBackup: validar restauração\nContrato parceria - melhoria',
    users,
  );
  assert.deepEqual(
    contextual.tasks.map((t) => t.title),
    ['Backup: validar restauração', 'Contrato parceria - melhoria'],
  );
  const wrapped = parsePlanning(
    'Eduardo: Verifique o estoque na semana\nseguinte.\nEduardo: Envie os relatórios',
    users,
  );
  assert.equal(wrapped.tasks.length, 2);
  assert.equal(
    wrapped.tasks[0].title,
    'Verifique o estoque na semana seguinte.',
  );
  const transcript = parsePlanning(
    '[28/10/2026, 09:00] Eduardo Silva - Forest: Conferir estoque\n09:20 - Bruno: Validar backup',
    users,
  );
  assert.deepEqual(
    transcript.tasks.map((t) => t.title),
    ['Conferir estoque', 'Validar backup'],
  );
  const ambiguousInline = parsePlanning('Eduardo: Revisar estoque', [
    ...users,
    { ...users[3], id: 'second-eduardo', name: 'Eduardo Silva' },
  ]);
  assert.equal(ambiguousInline.tasks[0].assignee_id, null);
  assert.ok(ambiguousInline.warnings.length);
  const arbitrary = parsePlanning(
    'Conferir o servidor. Validar o backup.\nEnviar relatório para Luiza.',
    users,
  );
  assert.equal(arbitrary.tasks.length, 2);
  assert.ok(arbitrary.tasks.every((t) => t.assignee_id === null));
  const extract = (text) =>
    parsePlanning('👤 Eduardo\n' + text, users, fixedNow);
  for (const phrase of [
    'para o dia 09/11',
    'até 09/11/2026',
    'prazo:09/11',
    'com entrega prevista para 9 de novembro de 2026',
    'até 2026-11-09',
  ]) {
    assert.equal(
      extract('Revisar estoque ' + phrase).tasks[0].due_date,
      '2026-11-09',
      phrase,
    );
  }
  assert.equal(
    extract('Revisar estoque para amanhã').tasks[0].due_date,
    '2026-10-29',
  );
  assert.equal(
    extract('Revisar estoque até hoje').tasks[0].due_date,
    '2026-10-28',
  );
  assert.equal(
    extract('Revisar estoque até sexta-feira').tasks[0].due_date,
    '2026-10-30',
  );
  assert.equal(
    extract('Revisar estoque até próxima quarta-feira').tasks[0].due_date,
    '2026-11-04',
  );
  assert.equal(
    extract('Concluir daqui a 3 dias').tasks[0].due_date,
    '2026-10-31',
  );
  const invalidDate = extract('Concluir para o dia 31/02');
  assert.equal(invalidDate.tasks[0].due_date, '2026-11-04');
  assert.ok(invalidDate.warnings.some((w) => w.includes('inválida')));
  const conflict = extract('Concluir até 09/11 ou até 10/11');
  assert.equal(conflict.tasks[0].due_date, '2026-11-04');
  assert.ok(conflict.warnings.some((w) => w.includes('Mais de um prazo')));
  const past = extract('Concluir até 09/01');
  assert.equal(past.tasks[0].due_date, '2026-01-09');
  assert.ok(past.warnings.some((w) => w.includes('já passou')));
  assert.equal(
    extract('Conferir relatório referente a 09/11').tasks[0].due_date,
    '2026-11-04',
  );
  const collaborators = extract(
    'Conferir estoque junto com Tonello e Gustavo Mendes para o dia 09/11',
  );
  assert.equal(collaborators.tasks[0].due_date, '2026-11-09');
  assert.deepEqual(collaborators.tasks[0].extra_assignee_ids, [
    'tonello',
    'gustavo',
  ]);
  assert.deepEqual(
    extract('Revisar com apoio de Bruno Carvalho').tasks[0].extra_assignee_ids,
    ['bruno'],
  );
  assert.equal(
    extract('Enviar o relatório para Bruno Carvalho e conversar com Tonello')
      .tasks[0].extra_assignee_ids,
    undefined,
  );
  assert.equal(
    extract('Revisar sem apoio de Bruno Carvalho').tasks[0].extra_assignee_ids,
    undefined,
  );
  const external = extract('Revisar em conjunto com Pessoa Externa');
  assert.equal(external.tasks[0].extra_assignee_ids, undefined);
  assert.ok(external.warnings.some((w) => w.includes('não cadastrado')));
  const ambiguousParticipant = parsePlanning(
    'Eduardo: Revisar com apoio de Bruno',
    [...users, { ...users[1], id: 'other-bruno', name: 'Bruno Rech' }],
    fixedNow,
  );
  assert.equal(ambiguousParticipant.tasks[0].extra_assignee_ids, undefined);
  assert.ok(ambiguousParticipant.warnings.some((w) => w.includes('ambíguo')));
  const metadata = extract(
    'Revisar estoque\nPrazo: 09/11\nParticipantes: Tonello, Gustavo Mendes',
  );
  assert.equal(metadata.tasks.length, 1);
  assert.equal(metadata.tasks[0].due_date, '2026-11-09');
  assert.deepEqual(metadata.tasks[0].extra_assignee_ids, [
    'tonello',
    'gustavo',
  ]);
  assert.ok(metadata.tasks[0].description.includes('Prazo: 09/11'));
  const merged = parsePlanning(
    'Responsáveis: Eduardo e Bruno\nRevisar junto com Tonello e Bruno',
    users,
    fixedNow,
  );
  assert.deepEqual(merged.tasks[0].extra_assignee_ids, ['bruno', 'tonello']);
  const own = extract('Revisar junto com Eduardo Fortes e Tonello');
  assert.deepEqual(own.tasks[0].extra_assignee_ids, ['tonello']);
  assert.equal(
    parsePlanning(
      'Tonello: Revisar até 01/01',
      users,
      new Date('2026-12-31T15:00:00Z'),
    ).tasks[0].due_date,
    '2026-01-01',
  );
  assert.equal(
    parsePlanning(
      'Tonello: Revisar até 29/02/2028',
      users,
      new Date('2028-02-28T15:00:00Z'),
    ).tasks[0].due_date,
    '2028-02-29',
  );
  assert.deepEqual(
    extract('Conferir estoque com Tonello e Gustavo Mendes para o dia 09/11')
      .tasks[0].extra_assignee_ids,
    ['tonello', 'gustavo'],
  );
  assert.deepEqual(
    extract('Revisar com apoio do Bruno Carvalho').tasks[0].extra_assignee_ids,
    ['bruno'],
  );
  assert.equal(
    extract('Agendar reunião com Bruno Carvalho').tasks[0].extra_assignee_ids,
    undefined,
  );
  assert.equal(
    extract('Confirmar com o fornecedor e conversar com Tonello').tasks[0]
      .extra_assignee_ids,
    undefined,
  );
  assert.equal(
    extract('Validar com Bruno Carvalho').tasks[0].extra_assignee_ids,
    undefined,
  );
  assert.deepEqual(
    extract('Revisar estoque; responsáveis: Tonello, Gustavo Mendes').tasks[0]
      .extra_assignee_ids,
    ['tonello', 'gustavo'],
  );
  const checklistMetadata = extract(
    '- Revisar estoque\n  - Conferir planilha\nPrazo: 09/11\nParticipantes: Tonello',
  );
  assert.equal(checklistMetadata.tasks.length, 1);
  assert.equal(checklistMetadata.tasks[0].due_date, '2026-11-09');
  assert.deepEqual(checklistMetadata.tasks[0].checklist, ['Conferir planilha']);
  assert.deepEqual(checklistMetadata.tasks[0].extra_assignee_ids, ['tonello']);
  console.log(
    'OK: Teams com 21 cartões, reunião com 9, nomes e prefixos, listas numeradas, vários responsáveis, texto livre, quebras de linha, prazos explícitos e relativos, participantes, metadados, conflitos, datas inválidas e nenhuma chamada externa.',
  );
} finally {
  globalThis.fetch = originalFetch;
}
