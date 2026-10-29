import type { User } from '../src/types';
import type { ImportTask, ImportPreview } from '../src/import-types';
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim();
// Display labels from meeting notes are metadata, not part of the person's name.
const personLabel = (text: string) =>
  text
    .trim()
    .replace(/\s+[-–—]\s+(?:forest(?:\s+paper)?|revita|ti)\s*$/iu, '')
    .trim();
function matchesPerson(name: string, users: User[]) {
  const alias = normalize(personLabel(name));
  const exact = users.filter((user) => normalize(user.name) === alias);
  if (exact.length) return exact;
  const words = alias.split(' ');
  return users.filter((user) => {
    const full = normalize(user.name).split(' ');
    if (!alias || words[0] !== full[0]) return false;
    let position = 0;
    return words.every((word) => {
      const index = full.indexOf(word, position);
      position = index + 1;
      return index >= 0;
    });
  });
}
function namesIn(label: string, users: User[]) {
  const name = personLabel(label);
  // A registered full name wins over separators that could occur in that name.
  if (matchesPerson(name, users).length) return [name];
  return name.split(/\s+(?:e|&)\s+|\s*[/+;]\s*/iu).filter(Boolean);
}
function knownPeople(label: string, users: User[]) {
  const names = namesIn(label, users);
  return (
    names.length > 0 &&
    names.every((name) => matchesPerson(name, users).length > 0)
  );
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
/** Resolve only dates connected to delivery language; do not turn stock codes into deadlines. */
function deadlineIn(
  text: string,
  fallback: string,
  warn: (message: string) => void,
): string {
  const normalized = normalize(text);
  const todayDate = new Date(fallback + 'T12:00:00Z');
  todayDate.setUTCDate(todayDate.getUTCDate() - 7);
  const today = todayDate.toISOString().slice(0, 10),
    year = todayDate.getUTCFullYear();
  const addDays = (days: number) => {
    const date = new Date(todayDate);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  };
  const months = [
    'janeiro',
    'fevereiro',
    'marco',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
  ];
  const calendar = (day: number, month: number, y: number) => {
    if (y < 1000 || y > 9999) return null;
    const date = new Date(Date.UTC(y, month - 1, day));
    return date.getUTCFullYear() === y &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
      ? date.toISOString().slice(0, 10)
      : null;
  };
  const dates: (string | null)[] = [];
  const token = String.raw`(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}(?:[/-](?:\d{4}|\d{2}))?|\d{1,2}\s+de\s+(?:${months.join('|')})(?:\s+(?:de\s+)?\d{4})?|hoje|amanha|(?:proxima\s+)?(?:segunda|terca|quarta|quinta|sexta)(?:-feira)?|(?:proximo\s+)?(?:sabado|domingo))`;
  const deadline = new RegExp(
    String.raw`\b(?:ate(?:\s+o)?(?:\s+dia)?|para(?:\s+o)?(?:\s+dia)?|prazo(?:\s+(?:de|para))?|entrega(?:\s+(?:em|para|prevista\s+para))?|vencimento|nesta|neste|na|no)\s*:?\s*(?:dia\s+)?(${token})(?![\p{L}\d/-])`,
    'gu',
  );
  for (const match of normalized.matchAll(deadline)) {
    const value = match[1];
    let date: string | null = null;
    const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const numeric = value.match(
      /^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}|\d{2}))?$/,
    );
    const written = value.match(
      /^(\d{1,2})\s+de\s+(\p{L}+)(?:\s+(?:de\s+)?(\d{4}))?$/u,
    );
    if (iso) date = calendar(+iso[3], +iso[2], +iso[1]);
    else if (numeric)
      date = calendar(
        +numeric[1],
        +numeric[2],
        numeric[3]
          ? numeric[3].length === 2
            ? 2000 + +numeric[3]
            : +numeric[3]
          : year,
      );
    else if (written)
      date = calendar(
        +written[1],
        months.indexOf(written[2]) + 1,
        written[3] ? +written[3] : year,
      );
    else if (value === 'hoje') date = today;
    else if (value === 'amanha') date = addDays(1);
    else {
      const days = [
        'domingo',
        'segunda',
        'terca',
        'quarta',
        'quinta',
        'sexta',
        'sabado',
      ];
      const day = value.replace(/^proxim[oa]\s+/, '').replace(/-feira$/, '');
      let delta = (days.indexOf(day) - todayDate.getUTCDay() + 7) % 7;
      if (!delta && /^proxim[oa]/.test(value)) delta = 7;
      date = addDays(delta);
    }
    if (!date)
      warn(
        `Data “${value}” inválida. O prazo padrão foi mantido; corrija na prévia.`,
      );
    dates.push(date);
  }
  for (const match of normalized.matchAll(
    /\b(?:daqui a|prazo (?:de|em)|entregar em)\s+(\d{1,3})\s+dias?\b/gu,
  )) {
    const days = Number(match[1]);
    if (days <= 365) dates.push(addDays(days));
  }
  const unique = [
    ...new Set(dates.filter((date): date is string => date !== null)),
  ];
  if (dates.includes(null) || unique.length > 1) {
    if (unique.length > 1)
      warn(
        'Mais de um prazo foi mencionado. O prazo padrão foi mantido; escolha a data correta na prévia.',
      );
    return fallback;
  }
  if (unique.length === 1) {
    if (unique[0] < today)
      warn(
        `O prazo identificado (${unique[0]}) já passou. Datas sem ano usam ${year}; confirme na prévia.`,
      );
    return unique[0];
  }
  if (
    /\bsemana (?:seguinte|que vem)|\bfim do mes|\bproxima semana|\d{1,2}\/\d{1,2}/u.test(
      normalized,
    )
  )
    warn(
      'Há uma referência de data sem prazo exato reconhecido. O prazo padrão de 7 dias foi mantido; revise na prévia.',
    );
  return fallback;
}
function collaboratorsIn(
  text: string,
  users: User[],
  warn: (message: string) => void,
): string[] {
  const ids = new Set<string>();
  function add(label: string, explicit: boolean) {
    const list = label
      .split(
        /\s+(?:para|at[eé]|prazo|entrega|no dia|na atividade|na tarefa|nesta atividade|nesta tarefa)\b|;\s*(?:prazo|entrega|vencimento)\s*:/iu,
      )[0]
      .trim();
    const people = list
      .split(/\s+(?:e|&)\s+|\s*[,/;+]\s*/iu)
      .map((name) =>
        name
          .trim()
          .replace(/^(?:o|a|os|as)\s+/iu, '')
          .replace(/^@/, ''),
      )
      .filter(Boolean);
    for (const name of people) {
      const matches = matchesPerson(name, users);
      if (matches.length === 1) ids.add(matches[0].id);
      else if (explicit || matches.length > 1)
        warn(
          `Participante “${name}” ${matches.length ? 'ambíguo' : 'não cadastrado'}. Não foi adicionado automaticamente; confira na prévia.`,
        );
    }
  }
  const clauses =
    /(?:em conjunto com|em parceria com|junto(?:s)? com|com (?:o |a )?(?:apoio|ajuda|participa[cç][aã]o) (?:de|do|da|dos|das)|(?:participantes|membros|apoio|colaboradores|respons[aá]veis)\s*:)\s*([^\n.]+)/giu;
  for (const match of text.matchAll(clauses)) {
    const before = normalize(
      text.slice(Math.max(0, match.index! - 35), match.index),
    );
    if (/\b(?:nao|sem|exceto)\b/u.test(before)) {
      warn(
        'Há uma indicação de participação com negação. Confira os membros manualmente.',
      );
      continue;
    }
    add(match[1], true);
  }
  // Generic “com Nome” is accepted for execution, but consultation, recipients
  // and meeting guests must not acquire task permissions merely by being mentioned.
  for (const match of text.matchAll(/\bcom\s+([^\n.]+)/giu)) {
    const before = normalize(
      text.slice(Math.max(0, match.index! - 100), match.index),
    );
    if (
      /\b(?:nao|sem|exceto)\b/u.test(before) ||
      /\b(?:converse|conversar|fale|falar|contato|reuniao|alinhe|alinhar|consulte|consultar|envie|enviar|entregue|entregar)\b[^.;\n]*$/u.test(
        before,
      ) ||
      /\b(?:verifique|verificar|valide|validar|compare|comparar)\s*$/u.test(
        before,
      )
    )
      continue;
    add(match[1], false);
  }
  return [...ids];
}

type Entry = {
  indent: number;
  text: string;
  line: number;
  root: boolean;
  marked: boolean;
  metadata?: string[];
};
type Section = { name: string; entries: Entry[] };
function cleanHeading(text: string) {
  return text
    .trim()
    .replace(/^#{1,6}\s+/, '')
    .replace(/^\*\*(.*?)\*\*\s*:?(?:\s*)$/u, '$1')
    .replace(/:\s*$/, '')
    .trim();
}
function listItem(line: string) {
  const match =
    line.match(
      /^(\s*)(?:[-*•‣▪–—]|\d{1,3}[.)])\s+(?:\[[ xX]\]\s*)?(.+?)\s*$/u,
    ) || line.match(/^(\s*)\[[ xX]\]\s+(.+?)\s*$/u);
  return match
    ? { indent: match[1].length, text: match[2], marked: true }
    : {
        indent: line.match(/^\s*/u)![0].length,
        text: line.trim(),
        marked: false,
      };
}
/** Format-based extraction only. No network calls; only explicit format, deadline and collaboration rules. */
export function parsePlanning(
  text: string,
  users: User[],
  now = new Date(),
): ImportPreview {
  if (!text.trim() || text.length > 20000)
    throw new Error('Cole um texto de até 20.000 caracteres.');
  const lines = text
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/\t/g, '    ')
    .split('\n');
  const sections: Section[] = [],
    warnings: string[] = [];
  const seenWarnings = new Set<string>();
  const warn = (message: string) => {
    if (!seenWarnings.has(message) && warnings.length < 100) {
      seenWarnings.add(message);
      warnings.push(message);
    }
  };
  let current: Section | undefined;
  function section(name: string) {
    if (name.length > 100)
      throw new Error('O nome do responsável deve ter até 100 caracteres.');
    if (current?.name === name) return current;
    current = { name, entries: [] };
    sections.push(current);
    return current;
  }
  for (const [index, raw] of lines.entries()) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const line = index + 1;
    if (/^(?:-{3,}|_{3,}|\*{3,})$/u.test(trimmed)) continue;
    const emoji = trimmed.match(/^👤\uFE0F?\s*(.*?)\s*:?$/u);
    const explicit = trimmed.match(
      /^(?:respons[aá]ve(?:l|is)|colaborador(?:es)?|atividades\s+(?:de|do|da)|tarefas\s+(?:de|do|da))\s*:\s*(.+)$/iu,
    );
    if (emoji || explicit) {
      const name = cleanHeading((emoji || explicit)![1]);
      if (!name)
        throw new Error(`Linha ${line}: informe um nome de responsável.`);
      section(name);
      continue;
    }
    if (
      /^(?:prazo|vencimento|participantes|membros|apoio|colaboradores)\s*:\s*\S/iu.test(
        trimmed,
      ) &&
      current?.entries.length
    ) {
      const base = Math.min(...current.entries.map((entry) => entry.indent));
      let previous = current.entries.at(-1)!;
      for (let i = current.entries.length - 1; i >= 0; i--) {
        if (current.entries[i].root || current.entries[i].indent === base) {
          previous = current.entries[i];
          break;
        }
      }
      (previous.metadata ||= []).push(trimmed);
      continue;
    }
    const heading = cleanHeading(trimmed);
    // Known names can be plain headings, including abbreviated or ambiguous names.
    if (knownPeople(heading, users)) {
      section(heading);
      continue;
    }
    const next =
      lines
        .slice(index + 1)
        .find((value) => value.trim())
        ?.trim() || '';
    const beforeBlank = index === 0 || !lines[index - 1].trim();
    const afterBlank = index + 1 < lines.length && !lines[index + 1].trim();
    const looksName =
      /^[\p{Lu}][\p{Ll}]+(?:\s+(?:(?:da|de|do|das|dos)\s+)?[\p{Lu}][\p{Ll}]+){0,4}$/u.test(
        heading,
      );
    if (
      looksName &&
      beforeBlank &&
      afterBlank &&
      (/^(?:[-*•‣▪–—]|\d+[.)])\s/u.test(next) ||
        /^[^:]{1,100}:\s*\S/u.test(next))
    ) {
      section(heading);
      continue;
    }
    const item = listItem(raw);
    if (!item.text || /^[-*•‣▪–—]$/u.test(item.text)) {
      warn(
        `Linha ${line}: marcador sem atividade. Preencha ou remova essa linha.`,
      );
      continue;
    }
    // Also accept exported chat timestamps before a sender label.
    const body = item.text
      .replace(
        /^\[\d{1,2}\/\d{1,2}(?:\/\d{2,4})?,?\s+\d{1,2}:\d{2}(?::\d{2})?\]\s*/u,
        '',
      )
      .replace(/^\d{1,2}:\d{2}\s*[-–—]\s*/u, '');
    const colon = body.match(/^(.{1,100}?):\s*(.+)$/u);
    const dash = body.match(/^(.{1,100}?)\s+[-–—]\s+(.+)$/u);
    let prefix: { name: string; text: string } | undefined;
    if (
      colon &&
      (knownPeople(colon[1], users) ||
        /\s+[-–—]\s+(?:forest(?:\s+paper)?|revita|ti)$/iu.test(colon[1]) ||
        normalize(personLabel(colon[1])) === normalize(current?.name || ''))
    )
      prefix = { name: personLabel(colon[1]), text: colon[2] };
    else if (dash && knownPeople(dash[1], users))
      prefix = { name: personLabel(dash[1]), text: dash[2] };
    if (prefix) {
      const target = section(prefix.name);
      target.entries.push({ ...item, text: prefix.text, line, root: true });
      continue;
    }
    const target = current || section('');
    if (!target.name)
      warn(
        'Há atividades sem responsável identificado. Escolha os responsáveis na prévia; o texto foi preservado.',
      );
    const previous = target.entries.at(-1);
    // Join only obvious line wrapping; indentation still creates checklist items.
    if (
      !item.marked &&
      previous &&
      !previous.marked &&
      !previous.metadata?.length &&
      index > 0 &&
      lines[index - 1].trim() &&
      item.indent === previous.indent &&
      /[\p{Ll}]/u.test(item.text[0]) &&
      /(?:,|\b(?:e|com|para|na|no|de|da|do)|\bna semana)\s*$/iu.test(
        previous.text,
      )
    ) {
      previous.text += ' ' + item.text;
      continue;
    }
    target.entries.push({ ...item, text: item.text, line, root: false });
  }
  const tasks: ImportTask[] = [],
    dueDate = importDueDate(now);
  for (const group of sections) {
    if (!group.entries.length) continue;
    const names = group.name ? namesIn(group.name, users) : [];
    const matches = names.map((name) => matchesPerson(name, users));
    const primary = matches[0]?.length === 1 ? matches[0][0].id : null;
    const extras = [
      ...new Set(
        matches
          .slice(1)
          .filter((result) => result.length === 1)
          .map((result) => result[0].id),
      ),
    ].filter((id) => id !== primary);
    if (names.some((_, i) => matches[i].length !== 1))
      warn(
        `Responsável “${group.name}” não encontrado ou ambíguo. Confira os responsáveis na prévia.`,
      );
    const base = Math.min(...group.entries.map((entry) => entry.indent));
    let task: ImportTask | undefined;
    for (const entry of group.entries) {
      if (entry.indent > base && !entry.root && task) {
        if (entry.text.length > 300)
          throw new Error(
            `Linha ${entry.line}: etapa maior que 300 caracteres. Reduza o texto antes de importar.`,
          );
        if (task.checklist.length >= 30)
          throw new Error(
            `Linha ${entry.line}: limite de 30 etapas por cartão. Divida a atividade.`,
          );
        task.checklist.push(entry.text);
        continue;
      }
      if (tasks.length >= 50)
        throw new Error(
          'Limite de 50 cartões por importação. Divida o texto em partes menores.',
        );
      if (entry.text.length > 5000)
        throw new Error(
          `Linha ${entry.line}: atividade maior que 5.000 caracteres. Divida o texto.`,
        );
      const source = [entry.text, ...(entry.metadata || [])].join('\n');
      if (source.length > 5000)
        throw new Error(
          `Linha ${entry.line}: atividade maior que 5.000 caracteres. Divida o texto.`,
        );
      const report = (message: string) =>
        warn(`Linha ${entry.line}: ${message}`);
      const deadline = deadlineIn(source, dueDate, report);
      const additional = [
        ...new Set([...extras, ...collaboratorsIn(source, users, report)]),
      ].filter((id) => id !== primary);
      if (additional.length > 19)
        throw new Error(
          'Limite de 20 responsáveis por atividade. Revise os participantes.',
        );
      let title = entry.text,
        description = (entry.metadata || []).join('\n');
      if (title.length > 180) {
        description = source;
        const cutoff = title.slice(0, 177).lastIndexOf(' ');
        title = title.slice(0, cutoff > 80 ? cutoff : 177) + '…';
        warn(
          `Linha ${entry.line}: título abreviado para caber no cartão. O texto completo foi preservado na descrição.`,
        );
      }
      task = {
        title,
        description,
        assignee_id: primary,
        responsible_name: group.name,
        due_date: deadline,
        priority: 'normal',
        status: 'progress',
        block_reason: '',
        checklist: [],
      };
      if (additional.length) task.extra_assignee_ids = additional;
      tasks.push(task);
    }
  }
  if (!tasks.length)
    warn(
      'Nenhuma atividade identificada. Cole uma lista ou texto com uma atividade por linha.',
    );
  return { tasks, warnings };
}
