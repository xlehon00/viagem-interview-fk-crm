# Prvních 30 dní na FK CRM

300 tisíc řádků, jeden vývojář, žádné CI, většina commitů přímo do `main`, majitel, který mi mimo pracovní dobu posílá zprávy ve slohu „do pátku". Tak vypadá projekt, který přebírám. Tenhle dokument popisuje, co s ním budu prvních 30 kalendářních dnů dělat. **Ne refactor, ne přepsání, ne „Agile transformace"** — nejdřív poznat lidi, pak postavit podlahu, pak zastavit konkrétní krvácení.

## Pravidla, podle kterých to prvních 30 dní jede

1. **Nejprve poslouchám, pak píšu.** První týden jsem hlavně v hovorech a na poznámkách; code je nutné zlo, ne cíl. Senior, který hned otevře IDE, si chytí ten samý tunel, ve kterém byl Sebastián sám.
2. **Jedna změna = jeden revertovatelný commit.** Stejný princip, který jsem uplatnil v Platbách a v `legacy-app` při přechodu na PHP 8.5. V kódu bez testů nemá smysl velké PR — musíme umět vrátit konkrétní větu.
3. **Bus factor 1 je hlavní riziko**, ne tech-debt. První měsíc proto míří na to, aby Sebastián nebyl jediný, kdo projektu rozumí: psaný postup nasazení, deska s aktivními úkoly, review jako rituál, ne jako „na mě má ještě čas".
4. **Business metrika nad kvalitou kódu.** Majitel platí za to, že přehled plateb je přesnější, upomínky chodí, sponzoři obnovují smlouvy. V 30 dnech mu musím ukázat **jedno** konkrétní lepší číslo, ne refactored codebase.

---

## Týden 1 — pozorování a bezpečnostní podlaha

**Lidé.** 30–60minutové hovory v tomhle pořadí:

- **Majitel.** Co od CRM reálně potřebuje za nejbližší kvartál? Jaká čísla by chtěl mít v telefonu ráno v 7:00? Co ho v posledním roce štvalo? (Odpověď: pravděpodobně „platby" a „vidím, kdo chce obnovit smlouvu".)
- **Sebastián.** Procházka kódem bez posuzování, kde hoří, co by přepsal, kde se bojí sáhnout, kde ztrácí nejvíc času. Konec hovoru je můj závazek: „po review nic nerevertnu bez tebe, nic ti nevezmu".
- **Petra (účtárna).** Co udělala ručně kolem plateb za poslední dva týdny? To je přesný seznam věcí, které CRM dělá špatně.
- **Jana (sponzoři).** Co klikne denně, co ji štve, co obchází přes Excel?
- **Tomáš (IT).** Jak se nasazuje, kdo má přístupy, kde jsou credentials, co monitoruje produkci (pokud něco).

Výstup týdne 1 je **seznam pěti bolestivých míst**, jedna věta za každé, seřazený podle dopadu × nákladů. Pět, ne dvacet.

**Bezpečnostní podlaha.** Paralelně s hovory tři věci, které jdou bez diskuse:

- **Rotace credentials** z `upominky` větve + audit celého repa: `grep -riE "pass(word)?|secret|key|token" app lib scripts` i přes `git log -p`. Co najdu, rotovat na úrovni providerů, ne jen přepsat v souboru (`REVIEW_UPOMINKY.md` blocker #1 je živý).
- **GitHub (nebo GitLab) Actions CI**: první iterace stačí `npm run typecheck` + `npm test` na každý push. Žádný lint, žádný deploy, nic chytřejšího — jen ať PR drží zelenou. 1 soubor, 20 řádků YAML, hotovo za hodinu, ušetří pár týdenních incidentů.
- **Branch protection na `main`**: vyžadováno „CI green" a jedno review od jiného člověka. Review může být minutové, ale **musí být**. Důvod nejsou pedanterské dvojitý check-ins, je to to, aby Sebastián ztratil pocit, že on sám drží všechno a spolu s tím i jediný způsob, jak něco ověřit.

---

## Týdny 2–3 — zastavit konkrétní krvácení

Tady už konkrétní práce. V tomhle pořadí, protože každá další položka těží z předchozí:

1. **Dotáhnout párování plateb** (`/api/cron/parovani`). Interview dataset ukazuje **4,4 mil. Kč nespárovaných plateb** — víc, než kolik je po splatnosti. Důvod: matcher trvá na exact VS + exact amount. V reálu sponzor zaplatí s DPH přes zaokrouhlení, VS s překlepem, nebo částku rozdělí. Chci rozšířit matcher o:
   - **VS + rozsah ±1 Kč** (haléřová tolerance),
   - **IČO protiúčtu, pokud máme sponzorův účet v `sponsors.bankovni_ucty`** (prefix match `prefix-cislo/kod`),
   - **částečné platby** — jedna banka → více dokladů via nová tabulka `bank_payment_allocations`.

   Očekávaný dopad: z 45 % spárovaných na 80+ %, tím se **Zbývá** v přehledu plateb smrští o stovky tisíc, aniž by někdo cokoli zaplatil navíc.

2. **Upomínky v2 podle `ZADANI_UPOMINKY.md`.** Sebastián dostává zadání, já dělám review. Vrátí na mě PR po PR (migrace, lib, cron, UI) — ne jednu bombu na konci. Soudě podle tempa, do konce týdne 3 je cron v produkci. Zároveň tím Sebastián dostává první skutečné review za poslední dobu — buduje se návyk.

3. **Historie plateb na kartě sponzora.** Dnes už `insertHistory` zapisuje spárované platby. Je to tam, ale v UI to není. Dodat na detail sponzora. ~1 den práce, majitel přestane klikat „kolik ten sponzor zaplatil celkem" do mailu Petře.

4. **První měření, které majitel uvidí.** Jednoduchá stránka nebo mail s denními čísly: *Vyfakturováno YTD / Zaplaceno YTD / Po splatnosti dnes / Nejvíc nad lhůtou*. Ne dashboard, ne grafy — čtyři čísla, ráno v telefonu. Tohle dělá rozdíl mezi „Alex je tam" a „Alex tam musí zůstat".

**Co z toho _nemůže_ počkat další měsíc:** rotace credentials + CI. Zbytek v tomhle pořadí, ale pokud něco vypadne (nemoc, incident), výměnný plán bude „méně, ale dokončené".

---

## Týden 4 — rituály, aby to po mně jelo samo

- **Pondělní 20min standup** jen Sebastián + já + Jana: na čem jsme, co bude tenhle týden, kde jsme zablokovaní. Majitel chodí „na pozvání", ne by default — obstojíme sami.
- **Páteční review slot 90 min:** projdu otevřené PR, Sebastián projde moje, dvě hodiny týdně si vyhradíme na to, že si o kódu povídáme. Ne na issue tracker — na kód.
- **Changelog `CHANGELOG.md`** ve formátu „datum / commit short / jedna věta pro majitele". Majitel do něj nahlédne, Sebastián cvičí psát srozumitelně.
- **Runbook `docs/runbooks/`** pro tři reálně provozní věci: „Fio CSV nechodí", „cron selhal", „sponzor chce vymazat údaje (GDPR)". Žádné polymerizovaný wiki — tři markdowny ve stejném repu.
- **Priority na kvartál**, jedna strana, posvěcená majitelem. Ne 30 cílů, ale **tři**. Zbytek je buffer.

---

## Co _nebudu_ dělat v prvních 30 dnech

- **Nepřepíšu `SponsorModal` ani jiný god-component.** Nefunguje to jako chirurgie na živo bez testů. Hranici rozdělení určíme, až budeme mít base-line.
- **Nezavedu Prisma / Drizzle / jakékoli ORM.** `lib/db.ts` je tenká a konzistentní, bolest není v `pg` wrapperu, ale jinde. ORM = měsíc refactoringu bez nového čísla pro majitele.
- **Nebudu měřit „code coverage" ani zavádět Storybook, Chromatic apod.** Testy přibývají tam, kde je testovatelné, ne jako samoúčel. (Postup, který detailněji rozebírám v `legacy-app/HANDOFF.md`, bod 1 „Testy — integrační před unit".)
- **Neoznámím „velkou technickou vizi na rok".** Za 30 dní nemám dost dat. Vize přijde v 60. dni, s měřením v ruce.
- **Nebudu nahrazovat Sebastiána.** Pokud bude chtít odejít, je to signál, že jsem něco zpackal, ne výhra.

---

## Jak poznám, že jsem prvních 30 dní nezkazil

| metrika | den 0 | cíl den 30 |
| --- | --- | --- |
| Commits do `main` mimo PR | ~100 % | 0 % |
| CI na PR | neexistuje | typecheck + test, zelené |
| Credentials v gitu | ≥1 (SMTP v `upominky`) | 0, rotované |
| % spárovaných plateb | 45 % | ≥ 80 % |
| Automatické upomínky s auditem | 0 | běží, throttle 7 dní, historie |
| Bus factor projektu | 1 (Sebastián) | 2 (Sebastián + já) |
| Majitel umí sám otevřít denní čísla | ne | ano |

Tyhle metriky vyvěsím na kanban/notion stránku, kterou vidí majitel i Sebastián. Nejenže se tím měří pokrok, ale hlavně **se tím komunikuje, že senior není jen ten, kdo zapíná lint** — je to ten, kdo za měsíc může ukázat čísla.

**Jedna věta na závěr.** Prvních 30 dní není sprint ani demo — je to nastavení prostředí, ve kterém půjde dál pracovat bez hrdinství. Hrdinství škáluje jen do bus factoru 1.
