# GeoR

GeoR är gAIa-systemets kanoniska bibliotek för rese- och upptäcktskartor.

## Syfte

GeoR samlar körsträckor och platsbaserade sammanställningar där natur, kultur, historia och praktisk navigering kan vägas samman. Varje resa ska kunna väljas i en lista och öppnas som en klickbar karta.

## Kanonisk placering

- Publik webbkälla: `gaia-tools/geor/`
- Publik adress: `https://hktcr.github.io/gaia-tools/geor/`
- Intern dokumentation och återställningskopia: denna katalog i `hktcr/gaia-tools`
- Registerpekare: `geor/site-manifest.json`

## Första karta

- Sarpsborg till Beito
- Datum: 5 augusti 2026
- Fokus: natur, kultur och valbara stopp
- Start: Borregård Hotell, Sarpsborg
- Mål: Lykkjetjednet 12, Beitostølen

## Datamodell

Första versionen är helt fristående och har resor och hållpunkter inbäddade i `index.html`. Vid nästa strukturella utbyggnad ska resor flyttas till versionshanterad JSON, men sidan ska fortsätta fungera utan externa kartbibliotek.

Varje resa ska minst innehålla:

- stabilt id
- titel och datum
- start och mål
- region
- sammanfattning
- taggar
- hållpunkter med typ, koordinater, tidsåtgång, beskrivning och motiv
- navigationslänk

## Publiceringsrutin

Den gemensamma och auktoritativa rutinen finns i [`../PUBLICERINGSRUTIN.md`](../PUBLICERINGSRUTIN.md). Stegen nedan är GeoR:s tilläggskontroller.

1. Uppdatera källan i `gaia-tools/geor/`.
2. Kontrollera att sidan öppnas utan externa script eller kartbibliotek.
3. Kontrollera listval, sökning, markörer, informationsruta och navigationslänkar.
4. Läs tillbaka filerna från GitHub efter skrivning.
5. Verifiera den publika adressen separat.
6. Uppdatera MärkR och relevanta krönikor när en ny karta eller större funktion läggs till.

## Statusord

- Byggd: källkod finns i kanoniskt repo.
- Publicerad: GitHub Pages har levererat aktuell version.
- Verifierad: den publika sidan har öppnats och kärnfunktionerna har provats.

En lägre status får aldrig beskrivas som en högre.

## Återställning

GeoR kan återskapas från `hktcr/gaia-tools/geor/` utan ChatGPT-konversationen. All funktionell kod, innehåll, rutiner och adresspekare ska därför finnas i repot.
