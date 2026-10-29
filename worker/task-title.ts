import { taskTitleKey } from '../src/task-title';
export { taskTitleKey };
export const duplicateTitleMessage =
  'Já existe uma atividade com esse título neste setor, inclusive em outra semana ou concluída. Abra o cartão existente ou escolha um título diferente.';
export async function titleExists(
  db: D1Database,
  workspace: string,
  title: string,
  except = '',
) {
  const rows = await db
    .prepare(
      'SELECT id,title FROM tasks WHERE workspace_id=? AND deleted_at IS NULL AND id!=?',
    )
    .bind(workspace, except)
    .all<{ id: string; title: string }>();
  return rows.results.some(
    (t) => taskTitleKey(t.title) === taskTitleKey(title),
  );
}
export function isDuplicateTitleError(error: unknown) {
  return /UNIQUE constraint failed: tasks.workspace_id, tasks.title_key/.test(
    String(error),
  );
}
