# Zadání: Upomínky a přehled dlužníků

**Pro:** Sebastián (vývojář FK CRM)
**Od:** Alex
**Odhad:** 2 dny vývoj + 2 dny test a review
**Deadline:** cron a UI na produkci do 2 týdnů od převzetí

---

## Kontext

Majitel chce na pátek schůzku s partnery, kde ukáže, kdo z sponzorů dluží a od kdy. Přehled s čísly za něj udělám já (`/sponzori/platby`, už je v `main`). Automatické upomínky, které si vyžádal, dostaneš Ty, a dáme na to **delší čas než čtyři dny** — předchozí pokus (větev `upominky`) jsem procházel a má několik věcí, které se musí opravit, než pustíme něco automatického na reálné sponzory. Podrobnosti v [`REVIEW_UPOMINKY.md`](REVIEW_UPOMINKY.md), stačí si projít blockery + high.

Větev `upominky` sám neslučuj do `main`. Vytvoř si novou větev `feature/upominky-v2` nad `main` a implementaci stav od nuly podle zadání níže. Některé kusy z `upominky` se dají použít (text upomínky, UX reakce na double-click — ta byla správná), ale drtivou většinu kódu je rychlejší napsat znovu, než ho přebarvit.

---

## Cíl

1. **Model** — DB tabulka, která pamatuje, komu / kterému dokladu / kdy šla upomínka.
2. **Odesílání** — jedna upomínka na jeden doklad jednou za N dní, přes SMTP, s auditem do historie sponzora.
3. **Trigger** — cron endpoint, který obchází všechny po splatnosti a pošle, co je na čase. Autorizace stejná jako u `/api/cron/parovani`.
4. **UI** — tlačítko „Poslat upomínku" na kartě sponzora (`SponsorModal`), seznam odeslaných upomínek v historii, přepínač „Neposílat upomínky" na kartě sponzora.

Všechno musí jít revertnout jedním PR.

---

## Požadavky

### Model (migrace `db/migrations/007_reminders.sql`)

```sql
create table reminders (
  id bigserial primary key,
  invoice_id int not null references invoices (id),
  sponsor_id int not null references sponsors (id),
  sent_at timestamptz not null default now(),
  channel text not null check (channel in ('email')),
  recipient text not null,
  level smallint not null default 1 check (level between 1 and 3),
  triggered_by text not null check (triggered_by in ('cron', 'user')),
  user_id int references users (id),
  message_id text,
  error text
);

create index reminders_invoice_idx on reminders (invoice_id, sent_at desc);
create index reminders_sponsor_idx on reminders (sponsor_id, sent_at desc);

alter table sponsors add column reminders_disabled boolean not null default false;
```

Poznámka: `reminders_disabled` **nemáme** teď v `main`, ignoruj to, co je v `sql/upominky.sql` z větve `upominky` (ta migrace tam nemá být, je mimo `db/migrations/`).

### Modul `lib/reminders.ts`

- `listDebtors({ today, throttleDays }): Promise<DebtorRow[]>` — faktury kind in `PAYABLE_INVOICE_KINDS`, `due_date < today`, `amount > paid` (coalesce), `sponsors.reminders_disabled = false`, poslední upomínka pro ten doklad starší než `throttleDays` dní (nebo žádná). Stejný styl queries jako `lib/payments.ts` (CTE `invoice_payments`, žádný `parseFloat`).
- `sendReminder({ invoiceId, userId }): Promise<ReminderResult>` — běží v transakci: zapíše řádek do `reminders`, zavolá `posliEmail`, při selhání nastaví `error`. Idempotence: pokud už záznam s `invoice_id` a `sent_at > now() - interval '1 hour'` existuje, vrátí `{ ok: false, reason: 'already_sent' }`.
- Text e-mailu v samostatné funkci `renderReminderText({ sponsor, invoice, level })`. Žádný `parseFloat`, částky přes `formatCzk(halere)` z `lib/money.ts`.

### SMTP (`lib/mail/smtp.ts`)

- Credentials **výhradně** přes `process.env.SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM`. Žádný literál v kódu, žádný komentář typu „heslo přes WhatsApp". Pokud `SMTP_HOST` není nastaveno, `sendReminder` vyhodí srozumitelnou chybu a cron logne, kolik sponzorů by jinak dostalo e-mail (test fail mode pro dev).
- `.env.example` musí novou konfiguraci dokumentovat.

### Cron `app/api/cron/reminders/route.ts`

- `GET(request)` — první řádek `if (!isAuthorizedCron(request)) return 401`. Precedent: `app/api/cron/parovani/route.ts`.
- Vrátí JSON `{ considered, sent, skipped: { noEmail, throttled, disabled }, errors }`.
- `throttleDays = 7` jako konstanta. (Hard-coded, komentovat proč. Změnit lze PR.)
- Rozesílá přes `Promise.allSettled` v dávkách po 20, aby jeden pomalý SMTP nesloupl celek.

### UI

- Nový server action `remindSponsor({ invoiceId })` v `app/sponzori/actions.ts`.
- `SponsorModal` (navázané sekce) — do bloku s doklady přidat na každou neuhrazenou po splatnosti tlačítko „Poslat upomínku". Zobrazit datum poslední upomínky, pokud existuje. Když je `reminders_disabled`, tlačítko disabled + tooltip „Upomínky vypnuté — odblokovat?".
- Nový checkbox na kartě sponzora: **„Neposílat upomínky"** — uloží se do `sponsors.reminders_disabled` přes existující `updateSponsor` action, do historie se zapíše změna pole stejně jako u ostatních.
- Historie karty sponzora: nový typ záznamu `reminder_sent` — např. „Upomínka 25. 10. k dokladu 25100017 (2 420 Kč)" — přes `insertHistory` z `lib/sponsors.ts` (stejný helper, co používá cron `parovani`).
- **Žádná nová samostatná stránka `/dluznici`.** Použij existující navigaci (`/sponzori/platby`).

### Audit a observability

- Každá odeslaná upomínka = 1 řádek v `reminders` + 1 řádek v `history`. Žádné „pošlu a zapomenu".
- Cron po doběhnutí loguje do konzole souhrn ve tvaru `{ considered: N, sent: M, skipped: {...} }`. Pro produkci to postačí; strukturovaný log přidáme spolu s ostatními service.

### Testy

- `vitest` unit test pro `renderReminderText` — 3 případy: žádné jméno kontaktu, kontakt existuje, částka se zápornou korekcí (dobropis).
- Unit test pro throttle logic (pure function nad daty) — ne SQL mock, ale výpočet z `DebtorRow` co by vrátila DB. Dva testy: neposlat pokud poslední <7 dní, poslat pokud ≥7.
- Integrační test pro cron: spin nad testovací DB, naseed 2 sponzory (jeden `reminders_disabled`), 3 faktury (jedna uhrazená, jedna s nedávnou upomínkou, jedna otevřená bez upomínky), zavolat GET s `Authorization: Bearer <secret>`, očekávat `sent === 1`. Pokud v repu zatím není test harness pro DB, vytvoř v `tests/setup/` — bude se hodit i na zbytek (viz HANDOFF `legacy-app` téma testů).

---

## Non-goals (ne v tomhle PR)

- **Hromadné tlačítko „Poslat všem"** — Honza se už jednou dvakrát klikl, Pekárna U Lípy dostala dvě upomínky. Vrátíme se k tomu až cron poběží v klidu měsíc.
- **Šablonovací systém, HTML maily, přílohy PDF dokladů.** Plain text stačí pro první verzi. Když majitel bude chtít značku klubu, uděláme to v druhé iteraci.
- **Vlastní dashboard „Dlužníci".** `/sponzori/platby` na to stačí. Pokud bude majitel chtít view seřazené podle „days overdue desc", dodám nový sloupec do `listPaymentOverview`, ne novou stránku.
- **Napojení na SMS/Slack/WhatsApp.** Jednoho sposobu dost.
- **`reminders_disabled` per doklad.** Zatím per sponzor. Granularitu přidáme, až to někdo bude chtít.

---

## Acceptance criteria

PR se dostane do `main`, když všechno z této tabulky je zelené.

| # | Co ověřit | Jak |
| --- | --- | --- |
| 1 | Cron bez `Authorization` vrátí 401 | `curl http://localhost:3000/api/cron/reminders` → 401 |
| 2 | Cron s `Authorization` běží | `curl -H "Authorization: Bearer $CRON_SECRET" .../reminders` → 200 + JSON |
| 3 | Žádné credentials v kódu | `grep -riE "pass(word)?\s*=\s*['\"]" app lib` → 0 hitů |
| 4 | Jedna upomínka = jedna řádka v `reminders` + jedna v `history` | manuální smoke z UI + `select count(*) from reminders`, `select count(*) from history where field='reminder_sent'` |
| 5 | Throttle 7 dní funguje | druhý běh cronu ihned po prvním → `sent === 0`, `skipped.throttled` >0 |
| 6 | `reminders_disabled = true` vyřadí sponzora | nastavit v DB nebo UI, spustit cron, očekávat 0 e-mailů + `skipped.disabled > 0` |
| 7 | Žádná osobní data v kódu | `grep -riE "operace srdce|insolvenc|neposilat" app lib` → 0 hitů |
| 8 | Všechny částky přes `Halere`/`formatCzk` | code review: žádný `parseFloat` v nové práci, žádné manuální formátování Kč |
| 9 | Vitest testy zelené | `npm test` z PR CI běhu |
| 10 | Typecheck zelený | `npm run typecheck` |

---

## Pracovní návyky

- **Jedna PR = jedna věc.** Migrace samostatně, SMTP samostatně, cron samostatně, UI samostatně. Když se v produkci něco rozbije, ať víme, kterou PR revertnout. (Stejný postup, jako jsme teď dělali s Platbami — 3 commity, každý samostatně revertable.)
- **Commity v hlavní větvi branche:** pop chci vidět ve zprávě „co" a „proč", ne „fix", „wip" nebo „oprava Honzovy připomínky". Zpráva se čte za rok, když se na to budeme vracet.
- **`REVIEW_UPOMINKY.md` použij jako checklist čeho se vyvarovat.**
- **Review žádej dřív než pozdě.** Když budeš mít migraci a SMTP wrapper, pushni to na branch, dej vědět — projdu to za hodinu, nebudeš muset celý den čekat na „hotovo".

---

## Zdroje

- [`REVIEW_UPOMINKY.md`](REVIEW_UPOMINKY.md) — 18 findings nad `upominky` větví
- [`lib/payments.ts`](lib/payments.ts) — vzor pro queries (CTE `invoice_payments`, `sqlParams`)
- [`app/api/cron/parovani/route.ts`](app/api/cron/parovani/route.ts) — vzor cron routy
- [`lib/matching.ts`](lib/matching.ts) + [`lib/money.ts`](lib/money.ts) — existující konvence pro peníze a párování
- `crm-konvence/README.md` — dohodnuté názvosloví a UX hlavního CRM
