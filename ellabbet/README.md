# Ellabbet

Ett svenskt, fristående virtuellt ellabb för stationära likströmskretsar. Version 1.0.0.

## Kör lokalt

Ingen byggkedja eller applikationsinstallation behövs. Servera den här katalogen med en vanlig statisk HTTP-server. Exempel från repots rot:

```sh
python3 -m http.server 8000
```

Öppna sedan `http://localhost:8000/ellabbet/`. ES-moduler behöver serveras över HTTP, inte öppnas direkt som `file://`.

Alla tillgångssökvägar är relativa. Appen kan ligga i en underkatalog på GitHub Pages, exempelvis `/gaia-tools/ellabbet/`. Ingen backend, CDN, fjärrfont eller analyskod ingår.

## Innehåll

- Fri grafbaserad kretsbyggnad från tom yta: ett ändringsbart batteri, flera lampor, motstånd, brytare, amperemetrar, voltmetrar, förgreningar och ledningar.
- Klick–klick-koppling och ett likvärdigt anslutningsformulär. Drag är valfritt. Piltangenter, flyttknappar, rotation, borttagning och ångra.
- Tolv vägledda uppdrag, tre stegvisa ledtrådar per uppdrag, förutsägelse, egna förklaringar och regelstyrd kontroll av sparade försök.
- Fristående mall för en egen undersökning i fritt läge.
- Upp till tolv mätögonblick per arbetsyta. Historiskt genomförande hålls skilt från ändringar i dagens bygge. Bockar är egen avstämning, inte betyg eller validerad förståelse.
- Lokal, versionsmärkt lagring, återläsningskontroll, minnesläge vid lagringsfel, validerad JSON-import/export och explicit rensning av endast labbets nyckel.
- Ljust/mörkt systemläge eller eget val, reducerad rörelse och inga ljudkrav.

## Fysikmodell

Batteriets tomgångsspänning kan vara 1,5–9,0 V i steg om 0,1 V. Dess inre resistans är 1 Ω. Modellampor har fast 30 Ω. Motstånd kan vara 10–1000 Ω. Amperemetern har 0,01 Ω; voltmetern är ideal och leder ingen ström. Ledningar och slutna brytare är ideala.

Kretsen löses med nodanalys, inte genom att identifiera färdiga mallbilder. Ledningskorsningar skapar inte kontakt. Flyttning ändrar inte topologin. Flytande spänningsmätningar mellan separata delnät visas som obestämda. Ström i redundanta ideala grenar visas inte som ett påhittat värde.

Vid beräknad källström över 0,75 A slår modellens skydd från och förblir frånslaget tills eleven uttryckligen återställer. Ström och lampeffekt är då noll; normala spänningsvärden döljs. Felström visas endast märkt som beräknad före frånslag. Tröskeln är en undervisningsregel, inte en gräns för verklig elsäkerhet.

Modellen omfattar inte temperaturberoende glödtrådar, batteriurladdning, snabba förlopp, jordfel, växelström eller magnetism. Appen ska kompletteras med lärarledd verklig laboration. Gör aldrig försök i vägguttag eller avsiktliga kortslutningar med riktiga batterier.

## Integritet

Lagringsnyckeln är `se.gaia-tools.ellabbet.v1`. Appen ber inte om namn, konto eller andra personuppgifter och gör inga externa anrop från elevvyn. CSP förbjuder nätverksanrop med `connect-src 'none'`. Webbhotellet kan fortfarande behandla tekniska besöksuppgifter.

localStorage hör till samma ursprung och webbläsarprofil, inte en elev. På delad dator kan nästa användare se arbetet. Privat surfning eller rensning kan ta bort det. Andra appar på samma webbplatsursprung kan tekniskt dela lagringsåtkomst. Skriv inga känsliga uppgifter i fälten. Exportfilen innehåller elevens lokala arbete och bör hanteras därefter.

## Tester

```sh
node --test ellabbet/tests/*.test.mjs
node --check ellabbet/app.mjs
node --check ellabbet/model.mjs
node --check ellabbet/tasks.mjs
node --check ellabbet/solver.mjs
node --check ellabbet/routing.mjs
```

Kärntester omfattar exakta referenskretsar, kortslutning och skydd, flytande mätningar, 300 deterministiska slumpnät, effekt-/strömbalans, ogiltiga indata och permutationsinvarians. Appmodelltesterna kör riktiga fixtures genom adaptern, alla tolv uppdragspositiver, relevanta falskpositiver, lagringsschema, gränser och historik.

Läs `TESTPLAN.md` för obligatorisk gränssnitts- och publiceringskontroll. Automatiska numeriska tester utgör inte ensamma en visuell eller full tillgänglighetsgranskning.

## Filer

- `index.html`, `style.css`, `icon.svg`: elevvy och egna vektorsymboler.
- `app.mjs`: gränssnitt, interaktion, sparande och historik.
- `model.mjs`: dataformat, gränser, validering och solveradapter.
- `tasks.mjs`: uppdragsinnehåll och regelkontroll.
- `solver.mjs`: ren fysikkärna utan DOM, lagring eller nätverk.
- `routing.mjs`: enbart visuell ledningsdragning runt kroppar och andra kontakter; ändrar aldrig kretsgrafen. Korsningar får synliga luckor. Om överlappande delar gör en fri ritväg omöjlig markeras ledningen streckad; flytta då isär delarna.
- `tests/`: körbara numeriska och appmodelltester.

## Avgränsningar i första versionen

- Ingen automatisk bedömning av fri text, elevkonto, läraröversikt eller molnsynkronisering.
- Ingen återskapad laddningsanimation. Lampans sken är bara en kvalitativ illustration av modellens beräknade effekt.
- En källa, högst 24 övriga komponenter, 16 förgreningspunkter och 60 ledningar.
- Byggytan har en fast logisk storlek och rullas på små skärmar. Anslutningslistan erbjuder alla kopplingsfunktioner utan precisionspekning.
- Ingen full WCAG-överensstämmelse eller förbättrad inlärning jämfört med andra verktyg påstås. Elevpilot återstår.
