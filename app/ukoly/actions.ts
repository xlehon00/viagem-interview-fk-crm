'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { PoolClient } from 'pg';
import { transaction } from '@/lib/db';
import { FormError } from '@/lib/forms';
import { requireUser } from '@/lib/session';
import { insertHistory } from '@/lib/sponsors';
import { TASK_PROGRESS_STEPS, insertTask, readTaskForm, type NewTask } from '@/lib/tasks';

export async function addTask(form: FormData) {
  const user = await requireUser();
  let task: NewTask;
  try {
    task = readTaskForm(form);
  } catch (error) {
    if (!(error instanceof FormError)) throw error;
    redirect(`/ukoly?view=assigned&error=${encodeURIComponent(error.message)}`);
  }

  await transaction((client) => insertTask(client, { ...task, sponsorId: null, createdBy: user.id }));

  revalidatePath('/ukoly');
  redirect(task.assigneeIds.includes(user.id) ? '/ukoly?view=mine&saved=1' : '/ukoly?view=assigned&saved=1');
}

async function updateProgress(client: PoolClient, taskId: number, progress: number, userId: number) {
  const { rows } = await client.query<{ sponsorId: number | null; title: string }>(
    `update tasks
     set progress = $2, done_at = case when $2 = 100 then coalesce(done_at, now()) end
     where id = $1 and progress <> $2
     returning sponsor_id as "sponsorId", title`,
    [taskId, progress],
  );
  const task = rows[0];
  if (task?.sponsorId) {
    await insertHistory(client, {
      sponsorId: task.sponsorId,
      userId,
      field: 'task',
      newValue: progress === 100 ? `Hotovo: ${task.title}` : `${task.title}: ${progress} %`,
    });
  }
}

export async function setTaskProgress(taskId: number, form: FormData) {
  const user = await requireUser();
  const progress = TASK_PROGRESS_STEPS.find((step) => step === Number(form.get('progress')));
  if (progress === undefined) throw new Error('Neplatný stav úkolu.');

  await transaction((client) => updateProgress(client, taskId, progress, user.id));

  revalidatePath('/ukoly');
  revalidatePath('/sponzori');
}

export async function completeTask(taskId: number) {
  const user = await requireUser();

  await transaction((client) => updateProgress(client, taskId, 100, user.id));

  revalidatePath('/ukoly');
  revalidatePath('/sponzori');
}
