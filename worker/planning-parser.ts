import type { User } from '../src/types';
import type { ImportTask, ImportPreview } from '../src/import-types';
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim();
function resolvePerson(name: string, users: User[]) {
  const alias = normalize(name);
  const exact = users.filter((user) => normalize(user.name) === alias);
  const matches = exact.length
    ? exact
    : users.filter((user) => normalize(user.name).startsWith(alias + ' '));
  return matches.length === 1 ? matches[0].id : null;
}
export function importDueDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (name: string) =>
    Number(parts.find((p) => p.type === name)!.value);
  return new Date(Date.UTC(part('year'), part('month') - 1, part('day') + 7))
    .toISOString()
    .slice(0, 10);
}
/** Pure format parser: no network calls and no inference of deadlines or status. */
export function parsePlanning(
  text: string,
  users: User[],
  now = new Date(),
): ImportPreview {
  if (!text.trim() || text.length > 20000)
    throw new Error('Cole um texto de até 20.000 caracteres.');
  type Bullet = { indent: number; text: string; line: number };
  type Section = { name: string; bullets: Bullet[] };
  const sections: Section[] = [];
  const warnings: string[] = [];
  let current: Section | undefined;
  const warn = (message: string) => {
    if (warnings.length < 100) warnings.push(message);
  };
  for (const [index, original] of text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .entries()) {
    const line = original.replace(/\u00a0/g, ' ').replace(/\t/g, '    ');
    if (!line.trim()) continue;
    const header = line.trim().match(/^👤\uFE0F?\s*(.*?)\s*:?$/u);
    if (header) {
      const name = header[1].replace(/:\s*$/, '').trim();
      if (!name || name.length > 100)
        throw new Error(
          `Linha ${index + 1}: informe um nome de até 100 caracteres após 👤.`,
        );
      current = { name, bullets: [] };
      sections.push(current);
      continue;
    }
    const marked = line.match(/^(\s*)[-*•]\s+(.+?)\s*$/u);
    // Copying Teams lists can omit visual bullets. Under a named header,
    // each remaining text line is an activity; preserve its indentation.
    const plain =
      current?.name && !/^\s*[-*•]\s*$/u.test(line)
        ? line.match(/^(\s*)(\S.*?)\s*$/u)
        : null;
    const bullet = marked || plain;
    if (bullet) {
      if (!current) {
        current = { name: '', bullets: [] };
        sections.push(current);
        warn(
          `Linha ${index + 1}: atividade sem cabeçalho 👤 Nome. Escolha o responsável na prévia.`,
        );
      }
      current.bullets.push({
        indent: bullet[1].length,
        text: bullet[2],
        line: index + 1,
      });
    } else
      warn(
        `Linha ${index + 1} não reconhecida: “${line.trim().slice(0, 160)}”. Coloque 👤 Nome antes das atividades e use uma tarefa por linha.`,
      );
  }
  const tasks: ImportTask[] = [];
  const dueDate = importDueDate(now);
  for (const section of sections) {
    if (!section.bullets.length) {
      warn(`O grupo ${section.name} não contém atividades.`);
      continue;
    }
    const assignee_id = section.name
      ? resolvePerson(section.name, users)
      : null;
    if (section.name && !assignee_id)
      warn(
        `Responsável “${section.name}” não encontrado ou ambíguo. Selecione o integrante de cada cartão na prévia.`,
      );
    const base = Math.min(...section.bullets.map((b) => b.indent));
    let task: ImportTask | undefined;
    for (const bullet of section.bullets) {
      if (bullet.indent > base && task) {
        if (bullet.text.length > 300)
          throw new Error(
            `Linha ${bullet.line}: etapa maior que 300 caracteres. Reduza o texto antes de importar.`,
          );
        if (task.checklist.length >= 30)
          throw new Error(
            `Linha ${bullet.line}: limite de 30 etapas por cartão. Divida a atividade.`,
          );
        task.checklist.push(bullet.text);
      } else {
        if (bullet.text.length > 180)
          throw new Error(
            `Linha ${bullet.line}: título maior que 180 caracteres. Reduza o título antes de importar.`,
          );
        if (tasks.length >= 50)
          throw new Error(
            'Limite de 50 cartões por importação. Divida o texto em partes menores.',
          );
        task = {
          title: bullet.text,
          description: '',
          assignee_id,
          responsible_name: section.name,
          due_date: dueDate,
          priority: 'normal',
          status: 'progress',
          block_reason: '',
          checklist: [],
        };
        tasks.push(task);
      }
    }
  }
  if (!tasks.length)
    warn(
      'Nenhuma atividade identificada. Use 👤 Nome e uma tarefa por linha, com ou sem marcador -.',
    );
  return { tasks, warnings };
}
