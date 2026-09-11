import Link from 'next/link';
import { formatDate, formatDateTime, todayIso } from '@/lib/dates';
import { TASK_VIEW_LABELS, parseTaskView } from '@/lib/sections';
import { listActiveUsers, requireUser } from '@/lib/session';
import { dueState } from '@/lib/sponsorCard';
import { listTasks } from '@/lib/tasks';
import { addTask, completeTask } from './actions';

type SearchParams = { view?: string; error?: string; saved?: string };

export default async function TasksPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const view = parseTaskView(params.view);
  const user = await requireUser();
  const [tasks, users] = await Promise.all([listTasks({ view, userId: user.id }), listActiveUsers()]);
  const today = todayIso();

  return (
    <>
      <div className="page-header">
        <h1>Úkoly · {TASK_VIEW_LABELS[view]}</h1>
      </div>

      {params.error && <p className="alert error">{params.error}</p>}
      {params.saved && <p className="alert success">Úkol byl přidán.</p>}

      {view !== 'done' && (
        <form action={addTask} className="inline-form">
          <input name="title" placeholder="Nový úkol" required />
          <select name="assigneeId" defaultValue={user.id} aria-label="Řešitel">
            {users.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <input name="dueDate" type="date" aria-label="Termín" />
          <button type="submit">Přidat úkol</button>
        </form>
      )}

      {tasks.length === 0 ? (
        <p className="empty">Žádný úkol.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Úkol</th>
              <th>Sponzor</th>
              <th>Termín</th>
              <th>Řešitel</th>
              <th>Zadavatel</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id}>
                <td>{task.title}</td>
                <td>
                  {task.sponsorId && task.sponsorName ? (
                    <Link href={`/sponzori?section=manage&detail=${task.sponsorId}`}>{task.sponsorName}</Link>
                  ) : (
                    <span className="muted">–</span>
                  )}
                </td>
                <td className={task.doneAt ? undefined : `due-${dueState(task.dueDate, today) ?? 'none'}`}>
                  {formatDate(task.dueDate)}
                </td>
                <td>{task.assigneeName}</td>
                <td>{task.createdByName}</td>
                <td className="num">
                  {task.doneAt ? (
                    <span className="muted small">hotovo {formatDateTime(task.doneAt)}</span>
                  ) : (
                    <form action={completeTask.bind(null, task.id)}>
                      <button type="submit" className="small">
                        Hotovo
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
