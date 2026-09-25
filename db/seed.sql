insert into users (id, email, name) values
  (1, 'jana.vesela@fk-lipov.example', 'Jana Veselá'),
  (2, 'tomas.reznicek@fk-lipov.example', 'Tomáš Řezníček'),
  (3, 'petra.malkova@fk-lipov.example', 'Petra Málková');

insert into sponsors (id, name, ico, contact_name, contact_phone, contact_email, status_id, priority, due_date, created_by, assignee_id, note, created_at) values
  (1, 'Pekárna U Lípy s.r.o.', '27481234', 'Marie Lipová', '+420 600 100 201', 'marie.lipova@pekarna-ulipy.example',
    (select id from sponsor_statuses where key = 'agreed'), 3, '2026-09-25', 2, 1,
    'Partner mládeže, chce fotky a krátký report z každého turnaje.', '2026-05-12 10:00+02'),
  (2, 'Autodoprava Novotný s.r.o.', '25698741', 'Karel Novotný', '+420 600 100 202', 'karel.novotny@autodoprava-novotny.example',
    (select id from sponsor_statuses where key = 'agreed'), 2, null, 1, 1,
    'Mantinel u hlavní tribuny.', '2026-06-03 09:20+02'),
  (3, 'Stavebniny Kolář a.s.', '46357812', 'Ing. Petr Kolář', '+420 600 100 203', 'petr.kolar@stavebniny-kolar.example',
    (select id from sponsor_statuses where key = 'renewal'), 4, '2026-09-30', 2, 2,
    'Generální partner od 2023, chce slevu za delší smlouvu.', '2023-05-02 14:00+02'),
  (4, 'Elektro Vlček s.r.o.', '28945610', 'Martin Vlček', '+420 600 100 204', 'vlcek@elektro-vlcek.example',
    (select id from sponsor_statuses where key = 'sign'), 3, '2026-09-15', 1, 1, null, '2026-08-11 11:30+02'),
  (5, 'Restaurace Sokolovna', null, 'Eva Dušková', '+420 600 100 205', 'sokolovna@restaurace-sokolovna.example',
    (select id from sponsor_statuses where key = 'contact'), 1, '2026-09-20', 2, null,
    'Zájem o catering na domácí zápasy výměnou za reklamu.', '2026-09-01 16:45+02'),
  (6, 'Lékárna Na Rynku s.r.o.', '03458921', 'PharmDr. Hana Malá', null, 'hana.mala@lekarna-narynku.example',
    (select id from sponsor_statuses where key = 'temp_rejected'), 2, '2027-03-01', 1, 1,
    'Letos ne kvůli rekonstrukci, ozvat se na jaře.', '2026-04-14 08:50+02'),
  (7, 'Pneuservis Brož', '71234567', 'Jiří Brož', '+420 600 100 207', 'info@pneuservis-broz.example',
    (select id from sponsor_statuses where key = 'rejected'), 1, null, 2, 2, null, '2025-06-02 10:10+02'),
  (8, 'Kovovýroba Hájek s.r.o.', '26874512', 'Lubomír Hájek', '+420 600 100 208', 'hajek@kovovyroba-hajek.example',
    (select id from sponsor_statuses where key = 'waiting'), 3, '2026-09-18', 2, 2,
    'Poslána nabídka na dresy dorostu.', '2026-08-26 13:05+02');

insert into seasons (id, name, starts_on, ends_on) values
  (1, '2025/26', '2025-07-01', '2026-06-30'),
  (2, '2026/27', '2026-07-01', '2027-06-30');

insert into packages (id, season_id, name, price, description) values
  (1, 1, 'Generální partner', 35000000, 'Logo na dresu A-týmu, banner u hlavního hřiště, 4 VIP permanentky.'),
  (2, 2, 'Generální partner', 35000000, 'Logo na dresu A-týmu, banner u hlavního hřiště, 4 VIP permanentky.'),
  (3, 2, 'Partner mládeže', 12000000, 'Banner na turnajích mládeže, logo na webu, 2 VIP permanentky.'),
  (4, 2, 'Mantinel', 6000000, 'Reklama na mantinelu u hlavního hřiště.');

insert into benefits (id, category, name, description) values
  (1, 'jerseys', 'Logo na dresu A-týmu', 'Přední strana dresu, domácí i venkovní sada.'),
  (2, 'stadium', 'Banner u hlavního hřiště', 'Banner 6 × 1 m za brankou.'),
  (3, 'stadium', 'Reklama na mantinelu', 'Panel 3 × 0,8 m.'),
  (4, 'vip', 'VIP permanentka', 'Vstup do VIP zóny na všechny domácí zápasy.'),
  (5, 'online', 'Logo na webu a sociálních sítích', null),
  (6, 'csr', 'Banner na turnajích mládeže', null),
  (7, 'matchday', 'Hlášení v rozhlase při zápase', 'Dvakrát za zápas, o poločase a po zápase.'),
  (8, 'pr', 'Tisková zpráva o partnerství', null);

insert into sponsor_benefits (sponsor_id, benefit_id, season_id, quantity, note) values
  (1, 5, 2, 1, null),
  (1, 6, 2, 2, 'Turnaje přípravek'),
  (1, 4, 2, 2, null),
  (2, 3, 2, 1, 'U hlavní tribuny'),
  (3, 1, 1, 1, null),
  (3, 2, 1, 1, null),
  (3, 4, 1, 4, null);

insert into contracts (id, sponsor_id, season_id, package_id, number, title, total_amount, signed_at, in_kind_description, in_kind_value) values
  (1, 1, 2, 3, 'SP-2026-001', 'Partner mládeže 2026/27', 12000000, '2026-06-20', 'Pečivo a občerstvení na turnaje mládeže', 1500000),
  (2, 2, 2, 4, 'SP-2026-002', 'Mantinel 2026/27', 6000000, '2026-07-25', null, 0),
  (3, 3, 1, 1, 'SP-2025-014', 'Generální partner 2025/26', 35000000, '2025-06-15', 'Stavební materiál na opravu tribuny', 8000000),
  (4, 7, 1, null, 'SP-2025-009', 'Reklama na rukávu dresu 2025/26', 4000000, '2025-07-20', null, 0);

insert into installments (id, contract_id, due_date, amount) values
  (1, 1, '2026-07-15', 3000000),
  (2, 1, '2026-10-15', 3000000),
  (3, 1, '2027-01-15', 3000000),
  (4, 1, '2027-04-15', 3000000),
  (5, 2, '2026-08-31', 3000000),
  (6, 2, '2027-02-28', 3000000),
  (7, 3, '2025-07-31', 17500000),
  (8, 3, '2026-01-31', 17500000),
  (9, 4, '2025-09-30', 4000000);

insert into invoices (id, sponsor_id, kind, number, variable_symbol, issued_at, due_date, amount) values
  (1, 1, 'proforma', 'ZF-2026-0001', '20260001', '2026-07-01', '2026-07-15', 3000000),
  (2, 1, 'tax_document', 'DD-2026-0001', '20260001', '2026-07-14', '2026-07-14', 3000000),
  (3, 1, 'proforma', 'ZF-2026-0002', '20260002', '2026-09-01', '2026-10-15', 3000000),
  (4, 2, 'proforma', 'ZF-2026-0003', '20260003', '2026-08-17', '2026-08-31', 3000000),
  (5, 3, 'invoice', 'F-2025-0101', '20250101', '2025-07-10', '2025-07-31', 17500000),
  (6, 3, 'invoice', 'F-2025-0140', '20250140', '2026-01-10', '2026-01-31', 17500000),
  (7, 7, 'invoice', 'F-2025-0098', '20250098', '2025-09-15', '2025-09-30', 4000000);

insert into bank_payments (id, bank_ref, received_at, amount, variable_symbol, counterparty_account, counterparty_name, message, matched_invoice_id) values
  (1, 'BANK-2025-07-29-0003', '2025-07-29', 17500000, '20250101', '1000000001/0800', 'STAVEBNINY KOLAR A.S.', 'F-2025-0101', 5),
  (2, 'BANK-2025-09-29-0011', '2025-09-29', 4000000, '20250098', '1000000002/0100', 'BROZ JIRI', null, 7),
  (3, 'BANK-2026-02-12-0002', '2026-02-12', 10000000, '20250140', '1000000001/0800', 'STAVEBNINY KOLAR A.S.', 'castecna uhrada F-2025-0140', 6),
  (4, 'BANK-2026-07-14-0001', '2026-07-14', 3000000, '20260001', '1000000003/0300', 'PEKARNA U LIPY SRO', 'mladez 1. splatka', 1),
  (5, 'BANK-2026-09-02-0004', '2026-09-02', 3630000, '20260003', '1000000004/2010', 'AUTODOPRAVA NOVOTNY', 'mantinel 2026/27', null);

insert into tasks (id, sponsor_id, title, due_date, created_by, progress, done_at, created_at) values
  (1, 1, 'Domluvit focení s Pekárnou U Lípy na zápas 26. 9.', '2026-09-24', 2, 25, null, '2026-09-01 09:00+02'),
  (2, 3, 'Připravit návrh prodloužení smlouvy pro Stavebniny Kolář', '2026-09-30', 1, 50, null, '2026-08-28 14:30+02'),
  (3, 2, 'Dohledat platbu Autodopravy Novotný (nesedí částka, poslali i s DPH)', '2026-09-10', 1, 0, null, '2026-09-03 08:45+02'),
  (4, 4, 'Poslat smlouvu Elektro Vlček k podpisu', '2026-09-02', 1, 100, '2026-09-02 16:10+02', '2026-08-28 10:00+02'),
  (5, null, 'Aktualizovat ceník reklamních ploch na sezónu 2027/28', '2026-12-15', 2, 0, null, '2026-09-01 10:00+02');

insert into task_assignees (task_id, user_id) values
  (1, 1),
  (2, 2),
  (2, 1),
  (3, 3),
  (4, 1),
  (5, 2),
  (5, 3);

insert into history (sponsor_id, user_id, field, old_value, new_value, created_at) values
  (1, 2, 'created', null, 'Pekárna U Lípy s.r.o.', '2026-05-12 10:00+02'),
  (1, 1, 'status', 'Podepsat smlouvy', 'Domluveno', '2026-06-20 15:00+02'),
  (1, null, 'payment', null, '30 000,00 Kč k dokladu ZF-2026-0001', '2026-07-14 11:00+02'),
  (3, 2, 'status', 'Domluveno', 'Jednáme o prodloužení', '2026-06-01 10:00+02'),
  (3, 2, 'priority', 'Vysoká', 'Nejvyšší', '2026-08-20 09:15+02'),
  (4, 1, 'created', null, 'Elektro Vlček s.r.o.', '2026-08-11 11:30+02'),
  (4, 1, 'status', 'Čekáme na reakci', 'Podepsat smlouvy', '2026-09-02 16:05+02'),
  (4, 1, 'task', null, 'Hotovo: Poslat smlouvu Elektro Vlček k podpisu', '2026-09-02 16:10+02'),
  (5, 2, 'created', null, 'Restaurace Sokolovna', '2026-09-01 16:45+02'),
  (6, 1, 'status', 'Jednáme o prodloužení', 'Zatím odmítnuto', '2026-08-20 09:30+02'),
  (6, 1, 'due_date', null, '1. 3. 2027', '2026-08-20 09:30+02'),
  (7, 2, 'status', 'Jednáme o prodloužení', 'Odmítnuto', '2026-07-01 08:00+02'),
  (8, 2, 'status', 'Kontaktovat', 'Čekáme na reakci', '2026-08-31 10:40+02');

select setval(pg_get_serial_sequence('users', 'id'), (select max(id) from users));
select setval(pg_get_serial_sequence('sponsors', 'id'), (select max(id) from sponsors));
select setval(pg_get_serial_sequence('seasons', 'id'), (select max(id) from seasons));
select setval(pg_get_serial_sequence('packages', 'id'), (select max(id) from packages));
select setval(pg_get_serial_sequence('benefits', 'id'), (select max(id) from benefits));
select setval(pg_get_serial_sequence('contracts', 'id'), (select max(id) from contracts));
select setval(pg_get_serial_sequence('installments', 'id'), (select max(id) from installments));
select setval(pg_get_serial_sequence('invoices', 'id'), (select max(id) from invoices));
select setval(pg_get_serial_sequence('bank_payments', 'id'), (select max(id) from bank_payments));
select setval(pg_get_serial_sequence('tasks', 'id'), (select max(id) from tasks));
