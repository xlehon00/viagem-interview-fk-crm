alter table benefits
  add column category text not null default 'stadium'
  check (category in ('online', 'stadium', 'jerseys', 'matchday', 'vip', 'pr', 'csr'));

alter table benefits alter column category drop default;

alter table contracts
  add column in_kind_description text,
  add column in_kind_value bigint not null default 0 check (in_kind_value >= 0);

-- down

alter table contracts drop column in_kind_value, drop column in_kind_description;
alter table benefits drop column category;
