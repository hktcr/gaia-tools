# gAIa mötesunderlag

Enkla, statiska mötessidor på https://hktcr.github.io/gaia-tools/moten/.

## Ändra studieurvalet

Redigera `ai-2026-11-11/studies.json` och kör `node moten/build.mjs` från repots rot. Generatorn skriver en vanlig HTML-sida. Inget JavaScript, API, konto eller byggsteg behövs i besökarens webbläsare. Håll fynd, begränsning, publikationstyp och originaladress tillsammans. Lägg inte privata utkast eller elevmaterial här.

Utseendet ligger i `assets/style.css`. Bakgrunden är skapad för sidan med ImageGen. Liberation Sans efterfrågas lokalt, med Arial/sans-serif som reserv; fonten är ännu inte inbäddad.

## Kontroll före publicering

Följ `../PUBLICERINGSRUTIN.md`. `check.mjs` kontrollerar filernas Git-blob-hashar, två identiska byggen samt Chrome i 390, 768, 1024 och 1440 px, mus, tangentbord, pekskärm, mörkt läge och reducerad rörelse. Originalnavigering provas med kontrollerat navigeringsmål; förlagens tillgänglighet kontrolleras separat i källarbetet. Bildskärmsfoton sparas som CI-artifakt. Detta ersätter inte en mänsklig visuell granskning.

Uppdatera `release-manifest.json` med resultatet från `git hash-object` för de listade filerna vid varje ändring. Manifestet listar inte sig självt. Publiceringen ska därefter läsas tillbaka på den riktiga Pages-adressen.

## Källor

Sidan samlar ett preliminärt mötesurval, inte en systematisk översikt. Bedömningspaketets 14 huvudposter är med. De tre enbart abstractkontrollerade extraträffarna ingår inte. Källgranskningen har särskilt hållit isär begränsad skalanvändning, central tendens, generositet/stränghet och effekten av att väga samman kriterier.
