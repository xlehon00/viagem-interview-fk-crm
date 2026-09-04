create table users (
  id serial primary key,
  email text not null unique,
  name text not null,
  active boolean not null default true
);

create table sponsor_statuses (
  id serial primary key,
  key text not null unique,
  name text not null,
  color text not null,
  position int not null
);

insert into sponsor_statuses (key, name, color, position) values
  ('contact', 'Kontaktovat', '#64748b', 10),
  ('waiting', 'Čekáme na reakci', '#b7791f', 20),
  ('sign', 'Podepsat smlouvy', '#2b6cb0', 30),
  ('renewal', 'Jednáme o prodloužení', '#6b46c1', 40),
  ('temp_rejected', 'Zatím odmítnuto', '#c05621', 50),
  ('agreed', 'Domluveno', '#2f855a', 60),
  ('rejected', 'Odmítnuto', '#c53030', 70);

create table sponsors (
  id serial primary key,
  name text not null,
  ico text,
  contact_name text,
  contact_phone text,
  contact_email text,
  status_id int not null references sponsor_statuses (id),
  priority smallint not null default 2 check (priority between 1 and 4),
  due_date date,
  created_by int not null references users (id),
  assignee_id int references users (id),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index sponsors_status_idx on sponsors (status_id) where deleted_at is null;
create index sponsors_assignee_idx on sponsors (assignee_id) where deleted_at is null;

create table tasks (
  id serial primary key,
  sponsor_id int references sponsors (id),
  title text not null,
  due_date date,
  assignee_id int not null references users (id),
  created_by int not null references users (id),
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create index tasks_assignee_open_idx on tasks (assignee_id) where done_at is null;
create index tasks_sponsor_idx on tasks (sponsor_id);

create table history (
  id bigserial primary key,
  sponsor_id int not null references sponsors (id),
  user_id int references users (id),
  field text not null,
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);

create index history_sponsor_idx on history (sponsor_id, created_at desc);

-- down

drop table history;
drop table tasks;
drop table sponsors;
drop table sponsor_statuses;
drop table users;
