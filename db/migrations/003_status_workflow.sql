update sponsor_statuses
set color = case key
  when 'contact' then '#0f9ba8'
  when 'waiting' then '#dd6b20'
  when 'sign' then '#2b6cb0'
  when 'renewal' then '#38a169'
  when 'temp_rejected' then '#dd6b20'
  when 'agreed' then '#2f855a'
  when 'rejected' then '#c53030'
  else color
end;

create table sponsor_status_transitions (
  from_status_id int not null references sponsor_statuses (id),
  to_status_id int not null references sponsor_statuses (id),
  primary key (from_status_id, to_status_id),
  check (from_status_id <> to_status_id)
);

insert into sponsor_status_transitions (from_status_id, to_status_id)
select f.id, t.id
from (values
  ('contact', 'waiting'),
  ('contact', 'temp_rejected'),
  ('contact', 'rejected'),
  ('waiting', 'contact'),
  ('waiting', 'sign'),
  ('waiting', 'temp_rejected'),
  ('waiting', 'rejected'),
  ('sign', 'waiting'),
  ('sign', 'agreed'),
  ('sign', 'rejected'),
  ('renewal', 'sign'),
  ('renewal', 'agreed'),
  ('renewal', 'temp_rejected'),
  ('renewal', 'rejected'),
  ('temp_rejected', 'contact'),
  ('temp_rejected', 'waiting'),
  ('agreed', 'renewal'),
  ('rejected', 'contact')
) as pairs (from_key, to_key)
join sponsor_statuses f on f.key = pairs.from_key
join sponsor_statuses t on t.key = pairs.to_key;

-- down

drop table sponsor_status_transitions;

update sponsor_statuses
set color = case key
  when 'contact' then '#64748b'
  when 'waiting' then '#b7791f'
  when 'renewal' then '#6b46c1'
  when 'temp_rejected' then '#c05621'
  else color
end;
