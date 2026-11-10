-- Vztahy mezi doklady a storno. Potrebne pro import historickych dat z uceta:
--  - CREDIT_NOTE (dobropis) odkazuje na opravovany doklad -> corrects_invoice_id
--  - TAX_DOC (danovy doklad k prijate platbe) odkazuje na zalohu -> advance_invoice_id
--  - storno (JSON "storno": true) -> canceled + datum
--
-- Sign constraint na amount nepridavam zamerne: dobropis je zaporny, danovy doklad
-- k platbe je 0, zalohova faktura / faktura je kladna. Agregacni dotazy to drzi.

alter table invoices
  add column canceled boolean not null default false,
  add column canceled_at date,
  add column corrects_invoice_id int references invoices (id),
  add column advance_invoice_id int references invoices (id);

create index invoices_corrects_idx on invoices (corrects_invoice_id) where corrects_invoice_id is not null;
create index invoices_advance_idx on invoices (advance_invoice_id) where advance_invoice_id is not null;

-- down

drop index invoices_corrects_idx;
drop index invoices_advance_idx;
alter table invoices
  drop column advance_invoice_id,
  drop column corrects_invoice_id,
  drop column canceled_at,
  drop column canceled;
