create table seasons (
  id serial primary key,
  name text not null unique,
  starts_on date not null,
  ends_on date not null,
  check (starts_on < ends_on)
);

create table packages (
  id serial primary key,
  season_id int not null references seasons (id),
  name text not null,
  price bigint not null check (price >= 0),
  description text,
  unique (season_id, name)
);

create table benefits (
  id serial primary key,
  name text not null unique,
  description text,
  active boolean not null default true
);

create table sponsor_benefits (
  id serial primary key,
  sponsor_id int not null references sponsors (id),
  benefit_id int not null references benefits (id),
  season_id int not null references seasons (id),
  quantity int not null default 1 check (quantity > 0),
  note text,
  created_at timestamptz not null default now()
);

create index sponsor_benefits_sponsor_idx on sponsor_benefits (sponsor_id);

create table contracts (
  id serial primary key,
  sponsor_id int not null references sponsors (id),
  season_id int not null references seasons (id),
  package_id int references packages (id),
  number text not null unique,
  title text not null,
  total_amount bigint not null check (total_amount >= 0),
  signed_at date,
  created_at timestamptz not null default now()
);

create index contracts_sponsor_idx on contracts (sponsor_id);

create table installments (
  id serial primary key,
  contract_id int not null references contracts (id),
  due_date date not null,
  amount bigint not null check (amount > 0)
);

create index installments_contract_idx on installments (contract_id, due_date);

create table invoices (
  id serial primary key,
  sponsor_id int not null references sponsors (id),
  kind text not null check (kind in ('proforma', 'invoice', 'tax_document', 'credit_note')),
  number text not null unique,
  variable_symbol text not null,
  issued_at date not null,
  due_date date not null,
  amount bigint not null,
  created_at timestamptz not null default now()
);

create index invoices_sponsor_idx on invoices (sponsor_id);
create index invoices_vs_idx on invoices (variable_symbol);

create table bank_payments (
  id serial primary key,
  bank_ref text not null unique,
  received_at date not null,
  amount bigint not null,
  variable_symbol text,
  counterparty_account text,
  counterparty_name text,
  message text,
  matched_invoice_id int references invoices (id),
  imported_at timestamptz not null default now()
);

create index bank_payments_vs_idx on bank_payments (variable_symbol);
create index bank_payments_invoice_idx on bank_payments (matched_invoice_id);

-- down

drop table bank_payments;
drop table invoices;
drop table installments;
drop table contracts;
drop table sponsor_benefits;
drop table benefits;
drop table packages;
drop table seasons;
