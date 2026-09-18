# FK CRM

Interní CRM fotbalového klubu FK Lipov pro práci se sponzory: karta sponzora a jednání, protiplnění, smlouvy a splátkový kalendář, doklady, platby z banky a jejich párování, úkoly a historie změn.

Next.js 15 (App Router, server actions), React 19, TypeScript, PostgreSQL 16 přes `pg` bez ORM (tenká vrstva `lib/db.ts`).

## Spuštění

Potřeba Node 20.6+ a Docker.

```bash
cp .env.example .env.local     # doplň hodnoty, viz níže
docker compose up -d           # Postgres na localhost:5432
npm install
npm run db:migrate
npm run db:seed                # testovací data
npm run dev                    # http://localhost:3000
```

Lokální `DATABASE_URL` pro Postgres z `docker-compose.yml`: `postgres://fkcrm:fkcrm@localhost:5432/fkcrm`.

Přihlášení řeší klubové SSO: `middleware.ts` ověří JWT v cookie `fk_session` (`AUTH_JWT_SECRET`, `AUTH_ISSUER`) a nepřihlášené pošle na `AUTH_LOGIN_URL`. Lokálně stačí do `.env.local` dát `AUTH_DEV_EMAIL` s e-mailem uživatele z tabulky `users` (např. `jana.vesela@fk-lipov.example` ze seed dat); funguje jen při `next dev`.

Testy `npm test`, kontrola typů `npm run typecheck`.

## Jak je aplikace poskládaná

Menu je po agendách, uvnitř podle fází práce.

- **Sponzoři:** V jednání · Domluveno · Bez zájmu · Přehled · Správa sponzorů · Správa protiplnění · Správa balíčků · Správa období
- **Úkoly:** Moje · Zadáno ode mě · Všechny · Hotové

Výpis sponzorů má filtry Priorita, Stav, Řešitel, Due date a hledání v názvu, telefonu a e-mailu; řadí se podle priority sestupně. Detail se otevírá jako popup nad výpisem: vlevo formulář karty, vpravo navázané sekce (Protiplnění, Smlouvy, Úkoly), pod tím Historie. Karta se ukládá tlačítkem v patičce.

## Pojmy

- **Sponzor** – karta sponzora: stav jednání, priorita 1–4 (Nízká, Střední, Vysoká, Nejvyšší), due date, zadavatel (kdo kartu založil), řešitel (kdo ji má na starost), IČO, kontakty.
- **Stav jednání** – číselník `sponsor_statuses` (`key`, `name`, `color`, `position`). V jednání = `contact`, `waiting`, `sign`, `renewal`, `temp_rejected`; Domluveno = `agreed`; Bez zájmu = `rejected`.
- **Období, balíček, protiplnění** – sezóna (`seasons`), nabídkový balíček pro sezónu (`packages`) a to, co sponzor za podporu dostává (`benefits`, u sponzora `sponsor_benefits`).
- **Smlouva** a **splátka** – smlouva na období, splátkový kalendář v `installments`.
- **Doklad** – zálohová faktura, faktura, daňový doklad, dobropis (`invoices.kind`).
- **Platba** – pohyb z banky (`bank_payments`, import zatím mimo aplikaci). **Párování** – spárovaná platba má v `bank_payments.matched_invoice_id` doklad, ke kterému patří; nespárované platby čekají ve frontě párování.
- **Úkol** – řešitel, zadavatel a termín, volitelně navázaný na sponzora.
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
- Import výpisů z banky a ruční párování plateb z fronty.
