import 'server-only';
import type { PoolClient } from 'pg';
import { query, sqlParams } from './db';
import { FormError, parseId, readDate, readText } from './forms';
import type { TaskView } from './sections';

export const TASK_PROGRESS_STEPS = [0, 25, 50, 75, 100] as const;

export type TaskRow = {
  id: number;
  title: string;
  createdAt: Date;
  dueDate: string | null;
  sponsorId: number | null;
  sponsorName: string | null;
  createdByName: string;
  assigneeNames: string | null;
  progress: number;
  doneAt: Date | null;
};

export async function listTasks(options: { view: TaskView; userId: number; sponsorId?: number }): Promise<TaskRow[]> {
  const params = sqlParams();
  const where: string[] = [];
  const assignedTo = (userId: string) =>
    `exists (select 1 from task_assignees ta where ta.task_id = t.id and ta.user_id = ${userId})`;

  switch (options.view) {
    case 'mine':
      where.push(assignedTo(params.add(options.userId)), 't.done_at is null');
      break;
    case 'assigned': {
      const me = params.add(options.userId);
      where.push(`t.created_by = ${me}`, `not ${assignedTo(me)}`, 't.done_at is null');
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
    `select t.id, t.title, t.created_at as "createdAt", to_char(t.due_date, 'YYYY-MM-DD') as "dueDate",
            t.sponsor_id as "sponsorId", s.name as "sponsorName", c.name as "createdByName",
            (select string_agg(u.name, ', ' order by u.name)
             from task_assignees ta
             join users u on u.id = ta.user_id
             where ta.task_id = t.id) as "assigneeNames",
            t.progress, t.done_at as "doneAt"
     from tasks t
     join users c on c.id = t.created_by
     left join sponsors s on s.id = t.sponsor_id and s.deleted_at is null
     where ${where.join(' and ')}
     order by ${options.view === 'done' ? 't.done_at desc' : 't.due_date nulls last, t.id'}
     limit 300`,
    params.values,
  );
}

export type NewTask = { title: string; assigneeIds: number[]; dueDate: string | null };

export function readTaskForm(form: FormData): NewTask {
  const title = readText(form, 'title');
  if (!title) throw new FormError('Vyplňte název úkolu.');
  const assigneeIds = [...new Set(form.getAll('assigneeIds').map(parseId))].filter((id): id is number => id !== null);
  if (assigneeIds.length === 0) throw new FormError('Vyberte alespoň jednoho řešitele úkolu.');
  return { title, assigneeIds, dueDate: readDate(form, 'dueDate') };
}

export async function insertTask(
  client: PoolClient,
  task: NewTask & { sponsorId: number | null; createdBy: number },
): Promise<number> {
  const { rows } = await client.query<{ id: number }>(
    `insert into tasks (sponsor_id, title, due_date, created_by)
     values ($1, $2, $3, $4)
     returning id`,
    [task.sponsorId, task.title, task.dueDate, task.createdBy],
  );
  const taskId = rows[0].id;
  await client.query('insert into task_assignees (task_id, user_id) select $1, unnest($2::int[])', [
    taskId,
    task.assigneeIds,
  ]);
  return taskId;
}
