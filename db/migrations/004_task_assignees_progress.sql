create table task_assignees (
  task_id int not null references tasks (id) on delete cascade,
  user_id int not null references users (id),
  primary key (task_id, user_id)
);

create index task_assignees_user_idx on task_assignees (user_id);

insert into task_assignees (task_id, user_id)
select id, assignee_id from tasks;

drop index tasks_assignee_open_idx;
alter table tasks drop column assignee_id;
alter table tasks add column progress smallint not null default 0 check (progress between 0 and 100);

-- down

alter table tasks drop column progress;
alter table tasks add column assignee_id int references users (id);
update tasks t set assignee_id = (select min(a.user_id) from task_assignees a where a.task_id = t.id);
update tasks set assignee_id = created_by where assignee_id is null;
alter table tasks alter column assignee_id set not null;
create index tasks_assignee_open_idx on tasks (assignee_id) where done_at is null;
drop table task_assignees;
