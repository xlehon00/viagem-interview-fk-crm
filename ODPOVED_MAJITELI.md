# Odpověď majiteli

> **Pondělí ráno, od majitele:**
> „Potřebuju, aby sponzorům, co nezaplatí, chodily automaticky upomínky a abych v přehledu viděl, kdo dluží. Ideálně do pátku, v pátek mám schůzku s partnery."

---

**Komu:** Honza · **Předmět:** Dlužníci a upomínky — co máme do pátku a jak dál

Ahoj Honzo,

**krátká verze.** Do pátku na schůzku budeš mít **přehled dlužníků s čísly, které si můžeš otevřít na notebooku** (žádný druhý člověk, žádný Excel, aktualizuje se při načtení stránky) a **tlačítko „Poslat upomínku" u každého sponzora** — to klikneš Ty nebo Jana a odejde jedna e-mailová upomínka. Plně **automatický cron**, který je sám rozešle každý den/týden, chci radši naplánovat do dvou týdnů — vysvětlím proč.

**Dlouhá verze.**

### 1) Co máš v pátek ráno

- **Přehled „Platby sponzorů"** v CRM (menu Sponzoři → Platby): celková suma vyfakturováno / zaplaceno / zbývá, kolik je **po splatnosti**, kdo konkrétně dluží a od kdy. Seřazené podle rizika. Klikem se dostaneš na kartu sponzora. Na reálných datech z účetnictví to teď ukazuje **1,5 mil. po splatnosti napříč 29 sponzory**, takže je to k něčemu okamžitě.
- **Bonus pro schůzku:** stránka obsahuje sekci **„Nespárované platby"** — 4,4 mil. Kč přišlo na účet klubu s variabilním symbolem, který neodpovídá žádnému dokladu. Petra to teď musí dohánět ručně a to je **podstatná část toho, proč „nám někdo dluží"** — ve skutečnosti už zaplatili, jen to nikdo nespáruje. Pokud s tím partnerům chceš něco udělat, tohle je lepší téma než chytat drobné.
- **Manuální „Poslat upomínku"** na detailu sponzora — jedno kliknutí, jedna upomínka, jednoduchý text. Udělá to z UI Ty nebo Jana, kontrola kdo komu co poslal je v historii karty sponzora.

Tohle **dám do pátku**, protože rozšiřuje už postavený přehled a tlačítko „pošli jeden e-mail" je stará dobrá úloha. Spouštím cron `/api/cron/parovani` a spáruje dalších cca 1500 plateb, které jsou dnes v bance, než půjdeš na schůzku — ten počet 1,5 mil. po splatnosti se po tomhle kroku pravděpodobně smrskne.

### 2) Automatický cron za 2 týdny, ne za 4 dny

**Proč to dělím.** Předchozí pokus (větev `upominky`) jsem procházel a má několik věcí, kvůli kterým ho **nemůžu jen tak stlačit do pátku**. Nejsou to kosmetické detaily, jsou to věci, které by Ti udělaly dvojnásobnou ostudu, kdybych je přehlédl:

1. **Přístupové údaje k mailové schránce byly v kódu** — teď je musím nechat rotovat a pořešit, jak je dostaneme do serveru bezpečně. Není to minuta.
2. **Cron se dal spustit zvenčí** — kdo zná URL, spustí tím rozesílku. Náš druhý cron (párování) to má ošetřené, tenhle ne. Musí se dorovnat.
3. **V kódu byly skutečné informace o některých sponzorech, které tam nepatří** (zdravotní stav, finanční spekulace). GDPR téma, potřebuju s Petrou vyřešit, kam to poděláme, než pustíme další automatiku.
4. **Chybí paměť, komu už upomínka šla.** Bez ní pošle Honzovi, Honzovi, Honzovi každý den, až zaplatí. Pekárně U Lípy se nedávno stalo, že dostala dvě najednou — to teď víme, že nám chyběla ta paměť, a opravu jsme dělali jen v UI, ne v backendu.
5. **Doklady se počítají přes `parseFloat` místo bigint v haléřích** — v této kódové základně máme jednotný typ `Halere` právě proto, aby se peníze nelámaly. Upomínky by to porušovaly a občas vyšla upomínka na částku s haléřovou chybou. Při jednom e-mailu to je úsměvné, při 30 mailech ročně si toho sponzor všimne.

Každá z těchto věcí sama o sobě není apokalypsa, ale součet je důvod, proč to nechci do pátku **cvaknout live**. Přepracování je přitom malá práce: **~2 dny nového vývojáře + 2 dny testování a review**. Zadání pro vývojáře máš v `ZADANI_UPOMINKY.md`, poslal jsem mu ho dnes ráno.

### 3) Co uděláš Ty, než zadání vývojář udělá

- Na schůzce s partnery **ukaž přehled plateb**. Kolik mají zaplatit, kolik je po splatnosti, jak to rozpadá podle sponzorů. Je to naše první interní **sdílené číslo**, prozatím jsme ho neměli nikde v jednom místě.
- Pokud chceš, aby někomu dnes **odešla upomínka**, pošli mi tři jména sponzorů, Jana nebo Petra je odbaví z karty sponzora. Nedělej to sám přes tlačítko „pošli všem" — i proto, že ho zatím v UI neuvidíš, zapínám ho až po tom cronu.

### 4) Jak poznám, že to funguje

- Pátek 09:00: **otevřeš `/sponzori/platby` a vidíš čísla**, která si můžeš bez obav ukázat partnerům.
- Pátek 14:00 (před schůzkou): **spárováno jde z 45 % na ~80 %**, protože cron pustil Fio import a párování.
- Do 2 týdnů: automatický cron odesílá upomínky **pouze jednou za sponzora/doklad za 7 dní**, zapisuje se historie, Ty v CRM vidíš „poslední upomínka 25. 10.".
- Do 3 týdnů: v detailu sponzora je tlačítko „Nepoštovat upomínky" (někdy chceš pauzu, zatím to děláme v DB ručně).

Pokud s tím rozdělením souhlasíš, sedneme si v úterý 15 minut k Janě, abych jí předal UI. Jinak zvedneš telefon.

Alex

---

**Co jsem _nezvládl_ slíbit:** hromadné odeslání upomínek „všem naráz" tlačítkem v pátek. Tenhle feature funkčně nepotřebujeme před pondělkem a nasadit ho bezpečně (potvrzovací dialog, limit počtu, auditní log) by znamenalo vzít si den navíc, který je lepší věnovat párování. Vrátím se k němu po cronu.
