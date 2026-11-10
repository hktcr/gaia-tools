# gAIa mötesunderlag

Enkla, statiska mötessidor på https://hktcr.github.io/gaia-tools/moten/.

## Ändra studieurvalet

Redigera `ai-2026-11-11/studies.json` och kör `node moten/build.mjs` från repots rot. Generatorn skriver en vanlig HTML-sida. Inget API, konto eller byggsteg behövs i besökarens webbläsare. `assets/article-reader.js` lägger till en rundad dialog för originalkällor. Utan JavaScript fungerar länkarna som vanliga direktlänkar. Håll fynd, begränsning, publikationstyp och originaladress tillsammans. Lägg inte privata utkast eller elevmaterial här.

Utseendet ligger i `assets/style.css`. Mötessidans bakgrund `assets/academic-futures.webp` är skapad för sidan med ImageGen: akademisk gravyr möter ett diskret digitalt nät. Liberation Sans (Regular och Bold) är inbäddad för samma teckensnitt på olika enheter. Oförändrade version 2.00.1-filer från https://github.com/shantigilbert/liberation-fonts-ttf, med SIL OFL i `assets/FONT-LICENSE.txt`.

## Kontroll före publicering

Följ `../PUBLICERINGSRUTIN.md`. `check.mjs` kontrollerar filernas Git-blob-hashar, två identiska byggen samt Chrome i 390, 768, 1024 och 1440 px, mus, tangentbord, pekskärm, mörkt läge och reducerad rörelse. Dialog, fokus, stängning, ny flik, blockerad inbäddning och vanliga länkar utan JavaScript provas med kontrollerade originalmål. Verkliga förlag kan blockera inbäddning med CSP eller X-Frame-Options. En reservlänk till originalet visas därför alltid, och sidan försöker aldrig kringgå skydden. PDF-länkar använder webbläsarens visare utan sandbox; andra original öppnas i sandbox. Förlagens tillgänglighet kontrolleras separat. Bildskärmsfoton sparas som CI-artifakt. Detta ersätter inte en mänsklig visuell granskning.

Uppdatera `release-manifest.json` med resultatet från `git hash-object` för de listade filerna vid varje ändring. Manifestet listar inte sig självt. Publiceringen ska därefter läsas tillbaka på den riktiga Pages-adressen.

## Källor

Sidan samlar ett preliminärt mötesurval, inte en systematisk översikt. Bedömningspaketets 14 huvudposter är med. De tre enbart abstractkontrollerade extraträffarna ingår inte. Källgranskningen har särskilt hållit isär begränsad skalanvändning, central tendens, generositet/stränghet och effekten av att väga samman kriterier.
