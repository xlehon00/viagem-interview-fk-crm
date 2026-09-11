'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { transaction } from '@/lib/db';
import { FormError } from '@/lib/forms';
import { requireUser } from '@/lib/session';
import { insertHistory } from '@/lib/sponsors';
import { insertTask, readTaskForm, type NewTask } from '@/lib/tasks';

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
  redirect(task.assigneeId === user.id ? '/ukoly?view=mine&saved=1' : '/ukoly?view=assigned&saved=1');
}

export async function completeTask(taskId: number) {
  const user = await requireUser();

  await transaction(async (client) => {
    const { rows } = await client.query<{ sponsorId: number | null; title: string }>(
      `update tasks set done_at = now()
       where id = $1 and done_at is null
       returning sponsor_id as "sponsorId", title`,
      [taskId],
    );
    const task = rows[0];
    if (task?.sponsorId) {
      await insertHistory(client, {
        sponsorId: task.sponsorId,
        userId: user.id,
        field: 'task',
        newValue: `Hotovo: ${task.title}`,
      });
    }
  });

  revalidatePath('/ukoly');
  revalidatePath('/sponzori');
}
