# Verifiering före publicering

## Automatiska kontroller

1. Kör `node --test ellabbet/tests/*.test.mjs` från repots rot.
2. Kör syntaxkontroll av samtliga `.mjs`.
3. Kontrollera att releasefilerna inte innehåller privata länkar, elevuppgifter, autentiseringsuppgifter, externa skript/fonter eller spårning.
4. Servera de oförändrade källfilerna. Ingen byggkedja genererar filer; en andra läsning/hashning ska därför vara byteidentisk.

## Browserkontroll (krävs utöver numeriska tester)

Använd Chrome/Chromium med 390, 768, 1024 och 1440 CSS-pixlars bredd, inklusive grov pekare och touch. Kontrollera både fritt läge och uppdrag, ljust och mörkt läge samt reducerad rörelse. Vid 200 % zoom ska text och reglage vara nåbara, utan att sidan som helhet får vågrät överströmning. Själva kretsytan får rullas.

### Kärnflöde från tom yta

- Lägg till ett batteri och en lampa, koppla med kontakter. Kontrollera 6/31 A och cirka 5,81 V över lampan.
- Lägg delarna i deras oförändrade startpositioner på samma höjd. E01 och E05 ska visa två tydliga, skilda ledningsvägar. E03:s fem anslutningar ska kunna följas utan att döljas bakom komponentkroppar eller passera genom oanslutna kontakter. Flytta även delarna till samma höjd manuellt; samma visuella regel ska gälla. Linjekorsningar ska ha lucka och aldrig en förbindelsepunkt om ingen uttrycklig kontakt finns.
- Bygg samma krets med anslutningslistan och enbart tangentbord. Upprepa flyttning med pilar från listknappens fokus och med flyttknappar. Kontrollera att fokus hålls kvar.
- Lägg till en andra lampa och skapa serie- respektive parallellkoppling utan mall. Kontrollera cirka 0,09836 A respektive totalt 0,375 A.
- Flytta och rotera en del. Mätvärden och förbindelser ska vara oförändrade. Ångra ska återställa borttagna delar och ledningar.
- Bygg ett blandat nät. Korsande linjer utan kontakt ska inte ge elektrisk förbindelse.

### Mätare, skydd och fel

- Genomför E03 med amperemeter i serie och voltmeter över lampan. Vänd mätarnas referensriktning. Kontrollera tecken och enheter.
- Öppna en serievoltmeterkrets: strömmen ska förbli noll. Fria prober ska inte visas som ett vanligt nollvärde. Prober på samma nod ska visa 0 V.
- Kortslut virtuellt mellan batteripolerna: frånslag, aktuell ström 0 A, föregående felström tydligt märkt. Ta bort felet eller ångra kopplingen: skyddet ska förbli frånslaget till uttrycklig återställning. Återställ med fel kvar: nytt frånslag.
- Prova en amperemeter direkt över källan och en förbikopplad lampa i annan serielast. Feltexterna ska skilja fallens innebörd.

### Uppdrag och historik

- Genomför E01, E03 och E08 med enbart tangentbord. Upprepa E01 med touch, utan drag.
- Använd alla tre ledtrådarna och läs begreppsstödet. Förutsägelsen får vara fel och fri text bedöms inte.
- Spara flera försök. Kontroll av uppdrag ska gälla sparade försök, inte påstå att varje senare krets är godkänd.
- Markera genomfört, ändra dagens krets, öppna historiken. Historiska värden, text och försök ska vara oförändrade. Markera att uppdraget behöver repeteras.
- Växla mellan fritt läge och minst två uppdrag. Återvänd och ladda om. Separata byggen och texter ska finnas kvar.
- Kontrollera att dialoger kan stängas med tangentbord och återlämnar rimligt fokus.

### Lagring och integritet

- Blockera localStorage och kör hela ett första bygge. Appen ska fungera i minnesläge, visa varning och tillåta export.
- Simulera fullt lagringsutrymme. Ingen falsk sparbekräftelse får visas.
- Exportera/importera ett fullständigt arbete och jämför kretsar, försök och historik.
- Prova fel dataversion, för stor fil, ogiltiga värden, saknade terminaler och HTML-liknande elevtext. Felaktig import ska inte ändra befintligt arbete. Text ska visas som text.
- Avbryt import/rensning och kontrollera oförändrat arbete. Bekräftad rensning får bara ta bort Ellabbets egen lagringsnyckel.
- Kontrollera nätverkspanelen. Endast lokala releasefiler ska begäras. Inga elevsvar får skickas.

## Efter publicering

Följ repots `PUBLICERINGSRUTIN.md`. Kontrollera den faktiska releasecommitten på den verkliga Pages-adressen och upprepa mus-, tangentbords- och mobilkärnflödet. En lokal testpassning eller en grön GitHub-kontroll är inte bevis för en publicerad, fungerande sida.
