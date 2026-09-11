import 'server-only';
import type { PoolClient } from 'pg';
import { query, sqlParams } from './db';
import { FormError, parseId, readDate, readText } from './forms';
import type { TaskView } from './sections';

export type TaskRow = {
  id: number;
  title: string;
  dueDate: string | null;
  sponsorId: number | null;
  sponsorName: string | null;
  assigneeName: string;
  createdByName: string;
  doneAt: Date | null;
};

export async function listTasks(options: { view: TaskView; userId: number; sponsorId?: number }): Promise<TaskRow[]> {
  const params = sqlParams();
  const where: string[] = [];

  switch (options.view) {
    case 'mine':
      where.push(`t.assignee_id = ${params.add(options.userId)}`, 't.done_at is null');
      break;
    case 'assigned': {
      const me = params.add(options.userId);
      where.push(`t.created_by = ${me}`, `t.assignee_id <> ${me}`, 't.done_at is null');
      break;
    }
    case 'all':
      where.push('t.done_at is null');
      break;
    case 'done':
      where.push('t.done_at is not null');
      break;
  }
  if (options.sponsorId !== undefined) where.push(`t.sponsor_id = ${params.add(options.sponsorId)}`);

  return query<TaskRow>(
    `select t.id, t.title, to_char(t.due_date, 'YYYY-MM-DD') as "dueDate", t.sponsor_id as "sponsorId",
            s.name as "sponsorName", a.name as "assigneeName", c.name as "createdByName", t.done_at as "doneAt"
     from tasks t
     join users a on a.id = t.assignee_id
     join users c on c.id = t.created_by
     left join sponsors s on s.id = t.sponsor_id and s.deleted_at is null
     where ${where.join(' and ')}
     order by ${options.view === 'done' ? 't.done_at desc' : 't.due_date nulls last, t.id'}
     limit 300`,
    params.values,
  );
}

export type NewTask = { title: string; assigneeId: number; dueDate: string | null };

export function readTaskForm(form: FormData): NewTask {
  const title = readText(form, 'title');
  if (!title) throw new FormError('Vyplňte název úkolu.');
  const assigneeId = parseId(form.get('assigneeId'));
  if (assigneeId === null) throw new FormError('Vyberte řešitele úkolu.');
  return { title, assigneeId, dueDate: readDate(form, 'dueDate') };
}

export async function insertTask(
  client: PoolClient,
  task: NewTask & { sponsorId: number | null; createdBy: number },
): Promise<void> {
  await client.query(
    `insert into tasks (sponsor_id, title, due_date, assignee_id, created_by)
     values ($1, $2, $3, $4, $5)`,
    [task.sponsorId, task.title, task.dueDate, task.assigneeId, task.createdBy],
  );
}
