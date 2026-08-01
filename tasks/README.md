# gAIa Tasks

gAIa Tasks är ett chattstyrt task-system med en privat master och en mobilvänlig, statisk webbvy.

Systemets särdrag är ett transparent uppmärksamhetskontrakt. Det lagrar inte bara uppgifter utan bedömer om en uppgift förtjänar uppmärksamhet i den aktuella stunden. Nu-vyn visar högst ett fokus och två saker i sikte, redovisar varför valet gjordes och kan välja ett minsta, lagom eller fullt steg efter tillgänglig tid, energi och sammanhang. Tystnad tolkas aldrig som återkoppling.

## Uppmärksamhetskontrakt

- En behörighetsgrind stoppar otillgängliga, aktivt blockerade, tystade och oklara inkorgsposter.
- Behov, passning och hävstång redovisas var för sig. En totalsiffra visas inte som falsk precision.
- Väntande uppgifter får en separat kandidatväg när `followUpAt` har nåtts.
- En blockerad uppgift kan lyftas när samtliga uttryckliga blockerare har markerats som klara. Avbrutna eller raderade förutsättningar kräver omplanering.
- Kontextkapseln med tid, energi och sammanhang finns bara i minnet under den upplåsta sessionen och rensas vid låsning.
- Stegtrappan använder `minimumStep`, `normalStep` och `fullStep`, men påstår bara att hela steget ryms när ett tidsestimat faktiskt stöder det.
- ”Inte nu” kräver ett uttryckligt skäl. Endast ”Fel stund” gör en direkt, reversibel tvåtimmarssnooze. Övriga val öppnar uppgiften för granskning.
- Den schemalagda vakten kör 06, 08, 10, 12, 14, 16, 18 och 20 i `Europe/Stockholm`. Den är tyst när inget meningsfullt har förändrats.
- Enskilda gAIa Tasks blir inte egna ChatGPT Scheduled Tasks utan en senare uttrycklig begäran från Håkan.

## Datagränser

- `GAIA_TASKS_MASTER.json` i privat Google Drive är den kanoniska mastern.
- GitHub Pages innehåller appkod, ett manifest och en AES-GCM-krypterad vault.
- Webbläsarändringar ligger AES-GCM-krypterade i IndexedDB på den aktuella enheten.
- Revideringskoden innehåller bara operationer och resultatmetadata. Den innehåller inte hela mastern.
- Importverktyget verifierar SHA-256 och HMAC-SHA-256 innan en trevägsmerge får göras.
- Kalendern är en läskälla för uppmärksamhetskontrollen. Task-appen skriver aldrig till kalendern.
- `attention-v2` ger varje kontroll ett deterministiskt run-id. Den allmänna relevanshashen täcker alla beslutsfält, medan varje notice-id bara bygger på den aktuella anledningens tillstånd så att orelaterade ändringar inte upprepar en deadline. Historiska v1-poster bevaras vid loggmigreringen. Den schemalagda automationen är ensam loggskrivare.

## Schema och kompatibilitet

- Appen kan läsa master schema 1 och 2. En schema 1-master uppgraderas deterministiskt i minnet när den nya appen används.
- Den första revideringskoden som använder de nya uppmärksamhetsfälten deklarerar schema 2 och `minimumReaderVersion: 2`. Importen uppgraderar hela mastern innan operationer och resultat-hash verifieras.
- En äldre PWA-klient avvisar en publicerad schema 2-vault i stället för att riskera att skriva bort okända fält. En redan öppen äldre klient kan bara lämna en schema 1-revision, som mergas utan att sänka masterns schema eller radera schema 2-data.

## Normal användning

1. Ändra helst tasks i chatten. gAIa validerar, revisionshöjer och sparar mastern.
2. Använd webbsidan för mindre ändringar när chatten inte är lämplig.
3. Öppna `Ändringar`, exportera revideringskoden och klistra in den i chatten.
4. gAIa kör importverktyget, granskar eventuella konflikter och publicerar en ny krypterad vault.
5. När sidan öppnas mot den nya revisionen rensas lokala operationer som redan har tillämpats.

På mobil kan strikt integritet låsa appen direkt vid appbyte. Om detta stängs av används den ordinarie tidsgränsen i stället. Datanyckeln lämnar fortfarande aldrig webbläsarens minne.

Lokala webbändringar påverkar inte automatiska påminnelser innan de har importerats till mastern.

## Säkerhetsprofil v1

- PBKDF2-HMAC-SHA-256 med exakt 600 000 iterationer och 16 byte salt
- NFC-normaliserad lösenfras
- slumpmässig 256-bitars datanyckel
- AES-GCM med 96-bitars slumpmässig IV och 128-bitars tagg
- HKDF-SHA-256 med separata labels för snapshot, lokal overlay och revision
- HMAC-SHA-256 för revideringskod
- `connect-src 'self'`, inga externa script och inga tredjepartsberoenden i webbläsaren
- manifest och vault hämtas med `no-store`
- vaultens SHA-256 verifieras före dekryptering
- strikt integritetsläge låser direkt vid bakgrundsläge eller sidbyte; annars låser appen efter tio minuters inaktivitet
- låsning tömmer renderad taskdata, formulär, kontextval och revideringskod ur DOM:en
- service workern cachar endast appskalet, aldrig `tasks/data/`

GitHub Pages är statisk publicering, inte serverautentisering. En svag eller röjd lösenfras ger inget gott skydd mot offlinegissning. Vid ett verkligt lösenfrasläckage måste datanyckeln roteras, inte bara wrappas om. En projektsida under `hktcr.github.io` delar dessutom webbläsar-origin med andra projektsidor för samma konto. Känslig produktion bör därför senare flyttas till en dedikerad origin.

## Chatkontrakt

Följande avsikter ska stödjas i chatten:

- fånga: skapa i `inbox`
- klargör: ange nästa handling, projekt, status och eventuell granskning
- prioritera: ändra prioritet eller tidsbegränsad nålning
- planera: sätt mjukt måldatum, skarp deadline, tillgänglig från eller granska igen
- vänta: sätt `waiting` och vem eller vad uppgiften väntar på
- slutför: sätt `done` och `completedAt`
- ta bort: mjuk radering till `trash`; en permanent tombstone skapas först vid en separat, uttrycklig purge
- importera revideringskod: autentisera, simulera merge, visa konflikter, skriv först efter godkänd kontroll

Varje chattmutation ska läsa aktuell master, kontrollera förväntad basrevision, validera schemat, skriva en ny revision och läsa tillbaka filen innan den kvitteras.

## Verktyg

Validera en privat master:

```bash
node tasks/tools/vault-cli.mjs validate --master GAIA_TASKS_MASTER.json
```

Finalisera masterhash:

```bash
node tasks/tools/vault-cli.mjs finalize \
  --master GAIA_TASKS_MASTER.draft.json \
  --out GAIA_TASKS_MASTER.json
```

Skapa publik vault. Lösenfrasen tillförs endast via processen och skrivs inte till repo:

```bash
GAIA_TASKS_PASSWORD='...' node tasks/tools/vault-cli.mjs encrypt \
  --master GAIA_TASKS_MASTER.json \
  --out-dir tasks/data \
  --manifest tasks/data/manifest.json \
  --data-key GAIA_TASKS_DEK.txt
```

Granska och autentisera kod:

```bash
node tasks/tools/vault-cli.mjs inspect-revision \
  --code revision.txt \
  --data-key GAIA_TASKS_DEK.txt
```

Importera till en ny fil:

```bash
node tasks/tools/vault-cli.mjs apply-revision \
  --master GAIA_TASKS_MASTER.json \
  --code revision.txt \
  --data-key GAIA_TASKS_DEK.txt \
  --out GAIA_TASKS_MASTER.next.json
```

Datanyckeln ska inte lagras i klartext i Drive eller GitHub. Vid en senare publicering kan den återskapas till en tillfällig lokal fil genom den lösenfras-wrappade nyckeln i aktuell vault:

```bash
GAIA_TASKS_PASSWORD='...' node tasks/tools/vault-cli.mjs recover-data-key \
  --vault tasks/data/tasks.HASH.vault.json \
  --out /tmp/GAIA_TASKS_DEK.txt
```

Publicera aldrig master, datanyckel, lösenfras, återställningsfil eller revideringskod i repo.

## Test

```bash
node --test tasks/test/*.test.mjs
node tasks/tools/validate-public.mjs tasks
```
