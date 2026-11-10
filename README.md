# FK CRM

Interní CRM fotbalového klubu FK Lipov pro práci se sponzory: karta sponzora a jednání, protiplnění, smlouvy a splátkový kalendář, doklady, platby z banky a jejich párování, úkoly a historie změn.

Next.js 15 (App Router, server actions), React 19, TypeScript, PostgreSQL 16 přes `pg` bez ORM (tenká vrstva `lib/db.ts`).

## Interview task — rozcestník

| # | Úloha | Deliverable |
| --- | --- | --- |
| 1 | Platby sponzorů (přehled pro účtárnu) | **kód** — `/sponzori/platby`, [`lib/payments.ts`](lib/payments.ts), [`scripts/import-fk-data.mjs`](scripts/import-fk-data.mjs), migrace `006` |
| 2 | Review branche `upominky` | [`REVIEW_UPOMINKY.md`](REVIEW_UPOMINKY.md) |
| 3 | Odpověď majiteli + zadání pro vývojáře | [`ODPOVED_MAJITELI.md`](ODPOVED_MAJITELI.md), [`ZADANI_UPOMINKY.md`](ZADANI_UPOMINKY.md) |
| 4 | Prvních 30 dní | [`PRVNICH_30_DNI.md`](PRVNICH_30_DNI.md) |

Postup rozhodování je v [commit historii](../../commits/main) — každý commit nese ve zprávě **proč**, ne jen **co**. Pořadí je chronologické a reprodukuje objevování (schema → importer → kód → review → odpověď → 30 dní), ne retrofitovaná „čistá historie".

## Spuštění

Potřeba Node 20.6+ a Docker.

```bash
cp .env.example .env.local     # doplň hodnoty, viz níže
docker compose up -d           # Postgres na localhost:5432
npm install
npm run db:migrate
npm run db:seed                # referenční data (uživatelé, stavy, období, balíčky, benefity)
npm run db:seed:fk             # realistický dataset z ../data/ (40 sponzorů, 749 dokladů, 795 příchozích plateb)
npm run dev                    # http://localhost:3000
```

Pořadí je důležité: `db:seed` založí reference, `db:seed:fk` na to navazuje a doplní sponzory, smlouvy, doklady a bankovní pohyby z `../data/`. Bez druhého kroku jsou tabulky `invoices` a `bank_payments` skoro prázdné a přehled `/sponzori/platby` ukáže stejné malé demo jako výpisy sponzorů.

Lokální `DATABASE_URL` pro Postgres z `docker-compose.yml`: `postgres://fkcrm:fkcrm@localhost:5432/fkcrm`.

Přihlášení řeší klubové SSO: `middleware.ts` ověří JWT v cookie `fk_session` (`AUTH_JWT_SECRET`, `AUTH_ISSUER`) a nepřihlášené pošle na `AUTH_LOGIN_URL`. Lokálně stačí do `.env.local` dát `AUTH_DEV_EMAIL` s e-mailem uživatele z tabulky `users` (např. `jana.vesela@fk-lipov.example` ze seed dat); funguje jen při `next dev`.

Testy `npm test`, kontrola typů `npm run typecheck`.

## Jak je aplikace poskládaná

Agendy jsou v horním menu, podsekce vlevo odpovídají fázím práce, správa číselníků je na konci.

- **Sponzoři:** V jednání · Domluveno · Bez zájmu · Přehled · Správa sponzorů · Správa protiplnění · Správa balíčků · Správa období
- **Úkoly:** Moje · Zadáno ode mě · Všechny · Hotové

Výpis sponzorů (nadpis „Sponzoři: V jednání“) má filtry Priorita, Stav, Řešitel, Due date a hledání v názvu, telefonu a e-mailu; řadí se podle priority sestupně. „Přidat sponzora“ je jen ve V jednání. Klik na řádek otevře detail jako popup ve stylu OP: vlevo formulář karty a pod ním historie, vpravo navázané sekce (Protiplnění, Smlouvy, Úkoly). Karta se ukládá tlačítkem v patičce.

## Pojmy

- **Sponzor** – karta sponzora: stav jednání, priorita 1–4 (Nízká, Střední, Vysoká, Nejvyšší), due date, zadavatel (kdo kartu založil), řešitel (kdo ji má na starost), IČO, kontakty.
- **Stav jednání** – číselník `sponsor_statuses` (`key`, `name`, `color`, `position`). V jednání = `contact`, `waiting`, `sign`, `renewal`, `temp_rejected`; Domluveno = `agreed`; Bez zájmu = `rejected`. Stav se mění jen na povolený další stav podle `sponsor_status_transitions`, nová karta začíná ve stavu Kontaktovat.
- **Období, balíček, protiplnění** – sezóna (`seasons`), nabídkový balíček pro sezónu (`packages`) a to, co klub sponzorovi poskytuje (`benefits` v kategoriích online, stadion, dresy, matchday, VIP, PR, CSR; u sponzora `sponsor_benefits`).
- **Smlouva**, **splátka** a **věcné plnění** – smlouva na období, splátkový kalendář v `installments`, co sponzor dává místo peněz v `contracts.in_kind_*`.
- **Doklad** – zálohová faktura, faktura, daňový doklad, dobropis (`invoices.kind`).
- **Platba** – pohyb z banky (`bank_payments`, import zatím mimo aplikaci). **Párování** – spárovaná platba má v `bank_payments.matched_invoice_id` doklad, ke kterému patří; nespárované platby čekají ve frontě párování.
- **Úkol** – datum zadání, deadline, zadavatel, jeden nebo více řešitelů (`task_assignees`) a stav v procentech, volitelně navázaný na sponzora.
- **Historie** – každá změna pole na kartě (kdo, kdy, pole, z čeho na co), založení a smazání karty, nové protiplnění, úkoly a párování plateb.

## Konvence

- UI texty česky, identifikátory anglicky. Hlášky v jednotném čísle s názvem položky („Přidat sponzora“, „Opravdu si přejete smazat tohoto sponzora?“).
- Stavy se v kódu porovnávají podle `key` z číselníku, nikdy podle názvu nebo `id`.
- Peníze jsou v haléřích (`bigint`), v TypeScriptu typ `Halere` (celé číslo). Na koruny se převádí až při zobrazení (`formatCzk`) a při zadání (`parseCzk`).
- Migrace jen v `db/migrations/`, číslované `NNN_nazev.sql`, každá s částí `-- down`. `npm run db:rollback` vrátí poslední.
- Secrets jen v proměnných prostředí, `.env.example` bez hodnot.

## Plánované úlohy

Endpointy v `app/api/cron/*` nejsou za přihlášením (middleware je vynechává), proto každý hned na začátku ověří hlavičku `Authorization: Bearer <CRON_SECRET>` přes `isAuthorizedCron` z `lib/auth.ts`. Plán spouštění se nastavuje v hostingu podle této tabulky.

| Endpoint | Kdy | Co dělá |
|---|---|---|
| `GET /api/cron/parovani` | každou hodinu | Nespárované platbě, jejíž VS a částka přesně odpovídají nezaplacenému dokladu, nastaví `matched_invoice_id` a zapíše to do historie sponzora. Ostatní platby nechá nespárované. |

Při přidání nové úlohy doplň řádek do tabulky a případné nové proměnné do `.env.example`.

## Co zatím chybí

- Zakládání smluv a dokladů v UI (zatím je zakládá účetní mimo CRM).
- Ruční ruchové párování plateb v UI (import z Fio CSV teď jen přes `db:seed:fk`, produkční párování řeší cron).
- Automatické upomínky — návrh v [`ZADANI_UPOMINKY.md`](ZADANI_UPOMINKY.md), proč ne „do pátku" v [`ODPOVED_MAJITELI.md`](ODPOVED_MAJITELI.md).

## Co se stalo v rámci interview tasku

4 úlohy ze zadání. **8 commitů nad startovním bodem** (poslední commit startovního projektu je `b0fe1ac` „Sladění s konvencemi hlavního CRM"), všechny jednotlivě revertovatelné.

| fáze | commit(y) | obsah |
| --- | --- | --- |
| schéma | `c04445a` | migrace 006: `invoices.canceled/canceled_at`, `corrects_invoice_id`, `advance_invoice_id` + indexy; `.gitignore` `.DS_Store`. |
| import dat | `dd90e02` | `scripts/import-fk-data.mjs` + `npm run db:seed:fk` — načte JSON a Fio CSV z `../data/`, idempotentní v jedné transakci, VS + exact-amount párování na konci. |
| přehled plateb (úloha 1) + review (úloha 2) | `a82be29` | `lib/payments.ts` (CTE `invoice_payments`), `app/sponzori/platby/page.tsx` (stat řádek, filtry, tabulka, sekce nespárované), `Nav.tsx` subsection „Platby", CSS třídy `stat-row/stat/pay-overdue/pay-paid`; `REVIEW_UPOMINKY.md`. |
| odpověď majiteli (úloha 3) | `783f0f8` | `ODPOVED_MAJITELI.md` + `ZADANI_UPOMINKY.md`. |
| prvních 30 dní (úloha 4) | `d387d08` | `PRVNICH_30_DNI.md`. |

### Platby sponzorů — rozhodnutí

- **Agenda, ne nová top-level sekce.** Platby jsou další podsekce **Sponzoři** vedle `Přehled` / `Správa sponzorů`. Konvence z `crm-konvence/README.md`: agenda je horní menu, podsekce vlevo odpovídají fázím práce. Platby jsou fáze práce účtárny se sponzory, nejsou samostatná agenda.
- **Agregace přes CTE `invoice_payments`**, ne per-řádkové dotazy. Jeden LEFT JOIN na `(select matched_invoice_id, sum(amount) from bank_payments group by matched_invoice_id)` + `FILTER` výrazy v hlavním SELECTu. Omezení sortu + HAVING podle filtru stavu. Žádný per-sponzor dotaz jako v `app/dluznici/_data.ts` z větve `upominky`.
- **Všechny částky v `Halere` (bigint)**, zobrazení přes `formatCzk`. Zero `parseFloat` kdekoli v nové práci. Důvody detailně v `REVIEW_UPOMINKY.md` bodu 4.
- **„Nespárované platby" jako sekce dole**, ne samostatná stránka. Na reálných datech to je 4,4 mil. Kč (víc než oficiálně po splatnosti) — pro účtárnu hlavní téma. Dávat to na druhou stránku je zbytečné kliknutí.
- **Modal detailu per sponzor používá existující `SponsorModal`** přes `/sponzori?section=manage&detail=X`. Žádný nový modal, žádná nová route. Business logika pro „co sponzor dluží" je už na jednom místě (`lib/payments.ts`), karta sponzora dědí existující historii a kontakty.

### Jak ověřit, že nic nespadlo

```bash
# 1) Čistý start + reprodukce všech čísel z přehledu
docker compose down -v
docker compose up -d
npm run db:migrate && npm run db:seed && npm run db:seed:fk
# Očekávaný výstup posledního kroku:
# Hotovo: 40 sponzoru, 60 smluv, 749 dokladu, 795 prichozich plateb (358 sparovano).

# 2) Typecheck a testy
npm run typecheck
npm test

# 3) Přehled plateb
npm run dev &
curl -s http://localhost:3000/sponzori/platby | grep -oE 'Vyfakturováno|Zaplaceno|Zbývá|Po splatnosti|Nespárované'
# Očekávaný výstup: pěti slovné labely nahoře, cca 29 sponzorů po splatnosti, 4,4 mil. Kč nespárovaných.
```

### Proč jsem to _nedělal_ jinak

- **Žádný nový agenda-root `/platby`.** Platby jsou view sponzorů, ne samostatný business objekt. Sladění s konvencemi hlavního CRM je jedním z explicitních cílů projektu.
- **Importer jako TS skript, ne UI.** Interview zadání dává data v příloze. Produkční Fio import s UI je plnohodnotná feature (upload, preview, confirm, audit) — v této fázi by to byl scope creep.
- **Matcher v importeru duplikuje logiku cronu, ale jen stejnou úroveň jako cron** (VS + exact amount). Žádné rozšiřování párování v importeru — kdyby se měnila logika, musí žít na jednom místě (cron). Rozšíření matcheru je plán na prvních 30 dní (viz `PRVNICH_30_DNI.md`).
- **Branch `upominky` jsem nemergnul, v `ZADANI_UPOMINKY.md` doporučuju novou větev** `feature/upominky-v2`. Důvody: tři blockery z `REVIEW_UPOMINKY.md` (credentials v kódu, cron bez auth, GDPR data), které se nejsnáz řeší reimplementací podle existujících konvencí (`isAuthorizedCron`, `Halere`, `insertHistory`).
