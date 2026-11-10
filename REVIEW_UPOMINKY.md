# Review větve `upominky`

Rozsah: `git diff main..upominky` — 1 commit, 10 souborů, +1 103 řádků.
Autor větve dle commit metadat: Sebastián; z komentářů v kódu figurují Honza (majitel klubu), Petra Málková (účetní), Tomáš Řezníček, Jana Veselá.

## TL;DR

Větev dodává byznysovou hodnotu (dashboard pro majitele, posílání upomínek), ale **nemá být mergnuta do `main` v tomto stavu**. Důvody jsou tři:

1. **Hard-coded SMTP heslo v commitované historii** (`lib/mail/smtp.ts:11`) — bezpečnostní incident sám o sobě; heslo se musí rotovat nezávisle na review.
2. **Cron endpoint bez autorizace** (`app/api/cron/upominky/route.ts`) — kdokoli zná URL, spustí hromadný mailing. Codebase má na stejnou věc helper `isAuthorizedCron`, který používá existující `app/api/cron/parovani/route.ts`.
3. **Citlivá data skutečných sponzorů v repu** (`app/dluznici/_data.ts`) — zdravotní informace o konkrétní osobě, finanční spekulace, osobní kontakty. GDPR čl. 9 (zvláštní kategorie) — zdraví. To do gitu nepatří, ani jako "dočasný workaround".

Zbylých 15 findings jsou technické/architektonické problémy (float místo `Halere`, chybějící audit, god-component 796 řádků, migrace mimo `db/migrations/`). Dají se opravit v dalším sprintu. Horní tři ne — ty blokují merge.

---

## 🔴 Blockery (fix before merge)

### 1. SMTP heslo v kódu (`lib/mail/smtp.ts:3,11`)

```ts
// schránku upominky@ zakládal Tomáš 1. 10. u hostingu, heslo mi poslal přes WhatsApp
...
    pass: 'Lipov1921!Upominky',
```

**Co je špatně:** hodnota je v commitu `4cb0655`. I kdyby se v dalším commitu přepsala na `process.env.SMTP_PASS`, **heslo zůstane v historii gitu navždy**. Komentář ještě dokumentuje, že se heslo předávalo přes WhatsApp — není potřeba, aby to review přečetl útočník, aby věděl, kam zaútočit.

**Co udělat:**
1. Okamžitě rotovat heslo na mailserveru (nezávisle na merge).
2. Přesunout do `.env` (viz `lib/db.ts` precedent: `process.env.DATABASE_URL`).
3. `git filter-branch` / `git filter-repo` historii **není potřeba, pokud je repo privátní a bude se tahle větev droppnout** — pokud ne, přepsat i historii.
4. Audit, co dalšího prošlo přes WhatsApp. Tenhle komentář to dokumentuje jako rutinu, ne výjimku.

**Verdict:** `CONFIRMED`.

---

### 2. Cron bez autorizace (`app/api/cron/upominky/route.ts:7`)

```ts
export async function GET() {
  const dluznici = await najdiDluzniky();
  ...
  for (const d of dluznici) {
    ...
    const ok = await posliUpominku(d);
    ...
```

**Co je špatně:** endpoint nemá kontrolu `Authorization` headeru. Existující paralelní endpoint v repu (`app/api/cron/parovani/route.ts:14`) to řeší správně:

```ts
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  ...
```

Tady se pattern ignoroval. `isAuthorizedCron` je v `lib/auth.ts:28` (jose/constant-time compare, čistá implementace). Není co znovu vymýšlet.

**Dopad:** kdokoli, kdo zná URL (nebo ji uhádne z konvence `/api/cron/<cesky-nazev>`), spustí hromadnou rozesílku — denial-of-reputation vektor. Hosting cron systémy (Vercel, Cloudflare) posílají `Authorization: Bearer $CRON_SECRET`, takže návrat 401 pro publika je bezpečný default.

**Fix:** doslovný copy-paste pattern z `parovani/route.ts:12–16`.

**Verdict:** `CONFIRMED`.

---

### 3. Osobní data v repu (`app/dluznici/_data.ts`)

Konkrétní citáty z commitovaného souboru:

```ts
poznamka: 'Pan Šťastný byl od léta v nemocnici (operace srdce), Honza říkal neurgovat do listopadu.',
...
poznamka: 'Druhá splátka 2025/26, domluveno doplatit po skončení sezóny. Má problémy s cash flow, prý zvažují insolvenci.',
...
poznamka: 'Honza řeší osobně, je to jeho kamarád ze školy. NEPOSÍLAT UPOMÍNKY!',
```

**Co je špatně:**
- **GDPR čl. 9 (zvláštní kategorie):** zdravotní stav identifikovatelné osoby. Explicitní souhlas se zpracováním zdravotních údajů by byl potřeba, a i s ním do veřejného nebo širšího repa to nepatří.
- **Obchodní tajemství cizích osob** v kódu: spekulace o insolvenci třetí strany, osobní vztahy.
- **Plné kontaktní údaje:** jméno, telefon, e-mail, IČO — 10× ve stejném souboru.

Komentář hlavičky souboru uvádí: *"Do CRM se to importovat nebude (Honza: 'stará sezóna, to dotáhneme ručně')"* — ale to je právě ten problém. "Ručně" skončilo v `_data.ts` a odtamtud do gitu. To není soubor s daty, to je **úniková cesta kolem CRM a kolem GDPR procesů.**

**Co udělat:**
1. Soubor smazat (ne upravit — i smazání neprošoupne historii).
2. Data přesunout do interní tabulky `legacy_debtors_2025_26` v DB (s access-logem a RLS) **nebo** do CSV mimo repo s omezeným přístupem.
3. Dohodnout s Petrou cut-over termín (prý "do konce října" — teď je 10. 11., termín byl, že se to vybere nebo napersistuje jinam).
4. Zvážit `git filter-repo` jestli už je repo mimo malou skupinu lidí.

**Verdict:** `CONFIRMED` (data), `PLAUSIBLE` (GDPR expozice — zavisí na tom, kdo má k repu přístup).

---

## 🟠 High (fix do dvou sprintů)

### 4. `parseFloat(r.dluh)` — float místo bigint `Halere` (`lib/upominky.ts:48,51`)

```ts
// v SELECTu:
sum(i.amount - coalesce(z.zaplaceno, 0)) / 100.0 as dluh,
...
// v mapperu:
castka: parseFloat(r.dluh),
```

**Co je špatně:** codebase má konvenci **`Halere` jako bigint v haléřích** (`lib/money.ts:1`, `formatCzk`, `parseCzk`, `paymentState`) právě proto, aby se peníze **neukládaly jako float**. Tahle větev z toho ve své hot cestě vyskočí: `/100.0` v SQL konvertuje na numeric, `string_agg`/CAST do textu, pak `parseFloat` v Node, pak `toFixed(2)` při zobrazení. Každý krok zavádí riziko ztráty koruny (0.1 + 0.2 ≠ 0.3 floating-point).

**Fix:**
```ts
sum(i.amount - coalesce(z.zaplaceno, 0)) as dluh_halere,
...
castka: Number(r.dluh_halere),  // bezpečné do 2^53 halerech = 90 bilionů Kč
// zobrazení pak dělá formatCzk z lib/money.ts
```

Konzistentní s `app/api/cron/parovani/route.ts:44`, kde `formatCzk(payment.amount)` dostává `Halere`.

**Verdict:** `CONFIRMED`.

### 5. Hardcoded `('proforma', 'invoice')` místo `PAYABLE_INVOICE_KINDS` (`lib/upominky.ts:29`)

```sql
where i.kind in ('proforma', 'invoice')
```

Codebase už má konstantu v `lib/money.ts:16`:
```ts
export const PAYABLE_INVOICE_KINDS: readonly InvoiceKind[] = ['proforma', 'invoice'];
```

A používá se v `parovani/route.ts:28` jako parametr: `where i.kind = any($1), [PAYABLE_INVOICE_KINDS]`. Tahle větev to duplikuje jako SQL literal.

**Navíc:** při změně business logiky (`tax_document` se dostane mezi platitelné) se musí měnit na dvou místech. Tohle je přesně typ driftu, který způsobí, že pak něco někde posílá upomínky a něco jinde ne.

**Verdict:** `CONFIRMED`.

### 6. Žádný audit odeslaných upomínek

`posliUpominku` v `lib/upominky.ts:70` pošle e-mail přes `nodemailer` a vrátí `boolean`. Nikam se nic nezapíše.

**Důsledek:**
- Honza nemá v CRM "poslední upomínka: 7. 10., 14:32" na detailu sponzora.
- Soudní vymahatelnost (předžalobní výzva) žádá doložení odeslání. Tady nemáte nic.
- Nemáte throttle: pokud sponzor dluží 60 dní, cron mu pošle 60 upomínek (bod 7).

**Fix:** precedent je `insertHistory(client, { sponsorId, userId, field: 'payment', newValue: ... })` v `parovani/route.ts:51`. Stejný vzor použít pro `field: 'reminder_sent'` (+ sloupec `reminders.last_sent_at` nebo samostatná tabulka `reminders`).

**Verdict:** `CONFIRMED`.

### 7. Cron není idempotentní per-den — denní rozesílka každému overdue

`cron/upominky/route.ts:12`:
```ts
const dluznici = await najdiDluzniky();
for (const d of dluznici) {
  ...
  const ok = await posliUpominku(d);
```

`najdiDluzniky` vrací **všechny** sponzory po splatnosti. Žádná kontrola "poslední upomínka byla před méně než 7 dny" nebo počet kol (1. upomínka, 2. upomínka, předžalobní). Cron má komentář *"spouští se každý den v 7:00"* → **sponzor dostane e-mail denně až do zaplacení**.

Reálná konsekvence (dokumentovaná v kódu): v `DluzniciBoard.tsx:293` je komentář o *Pekárně U Lípy*, která dostala 2 upomínky zároveň a volala paní Lipová. Druhá chyba stejného typu, menší velikost.

**Fix:** tabulka `reminders(sponsor_id, invoice_id, sent_at, level)`, select v `najdiDluzniky` dostane `where not exists (select 1 from reminders r where r.sponsor_id = s.id and r.sent_at > current_date - interval '7 days')`.

**Verdict:** `CONFIRMED`.

### 8. Server action pracuje s plným loadem (`actions.ts:7`)

```ts
const dluznik = (await najdiDluzniky()).find((d) => d.sponzorId === sponzorId);
```

Každé kliknutí "Send reminder" → plný SQL join přes `sponsors × invoices × bank_payments_subquery × group by × order by`. Při růstu CRM na 1000 sponzorů je to zbytečný round-trip. Dedikovaný `najdiDluznikaPodleId(id)` je 5 řádků SQL.

**Verdict:** `CONFIRMED`.

### 9. Migrace mimo `db/migrations/` (`sql/upominky.sql`)

Soubor je v `sql/`, ne v `db/migrations/`. Komentář přiznává: *"spustit ručně na DB: `psql $DATABASE_URL -f sql/upominky.sql`"*. Repo konvence (`db/migrations/001..005`) chce sekvenční číslovaný soubor, aby `deploy` script pokryl schema změny.

**Důsledek:**
- Nová instance (dev, staging) nedostane `sponsors.reminders_disabled` → crash cronu s `column does not exist`.
- Rollback schema není možný (migrace není součástí tracking systému).

**Fix:** přesunout na `db/migrations/006_reminders.sql`. Když tam přibude i samostatná `reminders` tabulka (bod 7), smysl je hned větší.

**Verdict:** `CONFIRMED`.

### 10. `requireUser` v action, ale žádný RBAC

`actions.ts:5`: `await requireUser()`. `requireUser` jen ověří, že je někdo přihlášený; nekontroluje roli. V legacy-app world by **manažer sponzoringu** (Jana) mohl posílat upomínky, ale **brigádník na soustředění** by neměl. Tady může kdokoli přihlášený kliknout "Send reminders (46)" v hlavičce.

**Fix:** `requireRole('finance')` nebo `requireUser()` + per-action permission check. V codebase zatím role nejsou → aspoň `TODO: add role gate` a návrh v `HANDOFF`/`ZADANI`.

**Verdict:** `PLAUSIBLE` (tohle je product decision, ne bug — ale pro majitel-only funkci by to měl být gate).

---

## 🟡 Medium (architektonické)

### 11. God-component 796 řádků (`app/dluznici/DluzniciBoard.tsx`)

Jeden soubor obsahuje:
- state management (12 `useState`, 3 `useMemo`, `useTransition`, `useEffect`)
- výpočty (`dnyPoSplatnosti`, `urciStav`, `formatujCastku`)
- modal (`DetailDluznika`)
- toast systém (`Zpravy`, `pridejZpravu`, `zavriZpravu`)
- tabulku, filtry, hledání, souhrnné karty
- 150 řádků inline `CSSProperties`

Testovatelné z toho není nic. Rozdělit do `components/` + `hooks/` (např. `useDluznici`, `useVyberSponzoru`) + `lib/dluznici-utils.ts` pro čisté funkce.

### 12. Inline styly (`styly` object na konci souboru)

Komentář: *"Styly inline, CSS moduly jsem nechtěl zavádět kvůli jedné stránce (Tomáš souhlasil 16. 9.)"*. Jedna stránka se stane dvěma, dvě pěti — tenhle argument se v každém projektu používá, jednou. Ale `app/sponzori/`, `app/ukoly/` a další už existují a mají jiný přístup — hodí se zjistit, který, a sjednotit, ne otvírat nový precedent.

### 13. Mixed-language identifiers + `StavDluhu`

`type StavDluhu = 'overdue' | 'Pending' | 'zaplaceno'` — 3 hodnoty, 2 jazyky, 1 má velké písmeno (`Pending`), ostatní malé. Komentář přiznává proč: *"'zaplaceno' je česky, protože tak to má Petra ve sloupci Stav v exportu, ať se to dá porovnat 1:1"*.

**Co je špatně:** adaptéry do business modelu patří na ingestion edge (`zExportu`), ne do shared typu. Discriminated union by měl být jednojazyčný (`'overdue' | 'pending' | 'paid'`), mapování `zaplaceno → paid` do `zExportu`, zobrazení přes existující `POPISKY_STAVU`. Teď má `_data.ts` 10 záznamů se `stav: 'zaplaceno'` — a každý nový import ze staré sezóny přinese stejný zmatek.

### 14. `_data.ts` jako business code

Kromě GDPR problému (viz bod 3) má 135 řádků hardcoded data v repu formu, kde je součástí buildu. Je to **cold data**, které by patřilo do fixtures/DB. Když Petra 25. 10. přidá "pí Kalinová zaplatila", jde to přes PR + review + CI + deploy — proces pro změnu production dat. CRM má mít UI (ne editaci souboru v repu).

### 15. `Nav.tsx`: tlačítko "Dlužníci" vybočuje

```tsx
style={{ background: '#c0392b', color: '#fff', fontWeight: 700, marginLeft: 'auto' }}
```

Červené tlačítko napravo od ostatních navigačních položek. Codebase má consistent `agenda-link` třídu — tady je přepsaná inline stylem. Design intent ("majitel chce ať je to vidět") by se měl vyřešit přes design system / badge, ne přes jednorázový inline style v navigaci.

### 16. `dnyPoSplatnosti` na klientu i serveru (`DluzniciBoard.tsx:76`)

```ts
function dnyPoSplatnosti(splatnost: string): number {
  const dnes = new Date();
  dnes.setHours(0, 0, 0, 0);
  const datum = new Date(`${splatnost}T00:00:00`);
  return Math.round((dnes.getTime() - datum.getTime()) / 86_400_000);
}
```

Použito **v server component** (`page.tsx` nepřepočítává, ale `urciStav` v `zDb`/`zExportu` běží taky), a **v client component** (tabulka). Pokud server běží v UTC (Vercel defaults) a klient v CET, kolem půlnoci dostaneš jiný počet dní → hydration mismatch nebo nekonzistentní "status". Fix: počítat jednou v DB (`current_date - due_date`) a vracet s payloadem.

### 17. Sub-select bez indexu na `bank_payments.matched_invoice_id`

`lib/upominky.ts:31`:
```sql
left join (
  select matched_invoice_id, sum(amount) as zaplaceno
  from bank_payments
  group by matched_invoice_id
) z on z.matched_invoice_id = i.id
```

V aktuálních datech (1 509 transakcí) ještě ok. Při růstu je potřeba `create index bank_payments_matched_invoice_id_idx on bank_payments (matched_invoice_id) where matched_invoice_id is not null;` (partial index) — patří do té samé migrace jako `reminders_disabled`.

### 18. Žádná rate-limit na odesílání

`posliVybranym` v kódu je nahrazeno "poslední upomínka všem" s potvrzením (pozitivní), ale backend neomezuje. Pokud klient obchází UI (přímé volání server action nebo cron s poškozeným state), nic nebrání poslat 100 e-mailů v jedné sekundě. SMTP provider rate-limit by hitnul, ale to je špatné místo na detection.

---

## 🔵 Nits (při příští návštěvě)

- **`DluzniciBoard.tsx:273`** komentář *"Pozor na Autodopravu Novotný: pan Novotný volal 3. 10., ...že platil už 2. 9. ... Platba je prý v bance, ale nespárovaná..."* — provozní poznámka v source code. Patří do ticketu, ne do souboru.
- **`DluzniciBoard.tsx:86`**: `formatujCastku` dělá vlastní thousands-separator regex, místo `new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK' })` — který už je použitý v `lib/money.ts:14`. Opět duplikace konvence.
- **`DluzniciBoard.tsx:91`**: formát data `${den}/${mesic}/${rok}` — DD/MM/YYYY. CZ konvence je `D. M. YYYY`. Když jeden text v UI je anglicky kvůli p. Hubrovi, OK, ale nekonzistentní s `textUpominky` v `lib/upominky.ts:79` kde český text má `${Number(den)}. ${Number(mesic)}. ${rok}`.
- **`DluzniciBoard.tsx:200`**: `useEffect(() => { ... window.addEventListener('keydown', ...) ... }, [detail])` — listener se naváže i když `detail === null` (early `return`), následně se při každé změně `detail` re-nainstaluje. OK, ale `useEffect(() => detail && ..., [detail])` by byl explicitnější.
- **`textUpominky`** dělá `d.nejstarsiSplatnost.split('-')` a `Number(den)` → `Number(mesic)`. `new Date(splatnost).toLocaleDateString('cs-CZ')` dělá to samé čitelněji a s localizací.

---

## Co je uděláno dobře (fair)

- **UX insight z Honzovy chyby** (double-click → 2 upomínky) vedl k potvrzovacímu kroku v UI (`DluzniciBoard.tsx:306`) a odstranění "Send to all". To je dobrá reakce na reálnou událost, ne hypotetický edge case.
- **`posliEmail` wrapper** (`lib/mail/smtp.ts:22`) je úzký a snadno testovatelný (čistá fce + konstruktor transporteru). Jen ten `pass` v konstruktoru…
- **Aggregace** v SQL (sum per invoice) místo per-row dotazů z aplikace. Pattern správný, jen typ hodnoty špatný (bod 4).
- **`force-dynamic` + refresh na každé zobrazení** pro admin dashboard je rozumné (aspoň pro MVP).
- **Oddělený server action** pro posílání (`'use server'`) místo client-side fetch — lepší pro audit & types.

---

## Doporučení

**Merge → NE.** Blockery 1, 2, 3 vyžadují akci mimo review (rotace hesla, GDPR cleanup), nestačí "squash & fix on next commit".

**Co dělat:**

1. **Okamžitě** (ne review, zákaz čekat na sprint):
   - Rotovat SMTP heslo na mailserveru.
   - Audit dalších credentials v repu: `grep -r -E "(password|pass|secret|key|token)['\" ]*[:=]" app lib` — tahle věta najde víc než jen `Lipov1921!Upominky`.
   - Rozhodnout s majitelem a Petrou, co se stane s `_data.ts` obsahem (GDPR revize).

2. **Pro refactor** (podle 2–3 sprintů):
   - Vzít feature `DluzniciBoard` jako product spec, implementovat znovu podle codebase konvencí: `isAuthorizedCron`, `Halere` typy, `insertHistory` audit, migrace v `db/migrations/`, komponenty rozdělené.
   - Oddělit **model** (tabulka `reminders`, throttle, úrovně upomínek) od **UI** (dashboard). Model je 60 % hodnoty a je dnes v codebase úplně mimo.
   - Konzultovat s Janou (CRM only toggle chtěla ona 2. 10.) jak upomínky zapadnou do workflow zbytku CRM, ne jako samostatná stránka.

3. **Zdokumentovat jako precedent**:
   - PR review checklist: migrace v `db/migrations/`, cron s `isAuthorizedCron`, žádné credentials v kódu, osobní data mimo repo.
   - Tenhle REVIEW použít jako první položku ve sbírce "co se už stalo a nemá se opakovat".

Konkrétní text pro majitele i pro vývojáře k přepracování upomínek je v `ODPOVED_MAJITELI.md` a `ZADANI_UPOMINKY.md` (Fáze 3).
