# AI som studiekompis

Version 1.0.0, 11 november 2026.
workstream_id: WS-c2698ab2-9031-478e-b06b-a87d0d725320.
Relaterat metodspår: WS-6416164b-c31c-4516-b413-d7fc85f84514.

## Beställning och avsikt

Ny fristående forskningsbild som prövar den återanvändbara [metoden](../METOD.md). Den ska sammanställa studier om chattbottar som studiekompisar för elever. Ämnesanpassad interaktivitet och visuellt tema väljs för att stödja budskapet.

## Genomförande

Tre steg: övning med AI, självständigt prov och en jämförelse av fem studier. Huvudresultatet använder Bastanis två separata faser. Procenttal är relativa skillnader mot kontrollen i respektive fas, inte en tidskurva av samma poäng. Tutorgruppens osäkra provskillnad visas med ord och inte som noll.

Fem primärstudier: Bastani 2025, Fütterer 2026, De Simone 2025, Oreopoulos/Low 2026 och Kestin 2025. Fyra skolkontexter och en tydligt märkt universitetskontext. Arbetsrapporter skiljs från tidskriftsartiklar; paketinsatser skiljs från isolerad chatbot-effekt. Sammanställningen är ett riktat urval, inte en systematisk översikt.

Ljust papperstema, URW Gothic, grönt för övningsvinst och koppar för negativ provskillnad. Koncentriska linjer är dekor, inte data. Animationen avslöjar separata resultat i stället för att interpolera påhittade elevbanor. Källpanelerna anger deltagare, jämförelse, resultat, begränsning, referens och lässtatus. Slutsatser är märkta som egen syntes.

Källor finns i [studier.json](version-1/studier.json). Nigeria har verifierats via World Banks reproduktionspost och författarpresentation, inte genom full läsning av den stora rapport-PDF:en. Kestin har kontrollerats i indexerade primärpassager. Dessa läsgränser visas också i presentationen.

## Versionsprincip

[Stabil aktuelladress](./) pekar på [version 1](version-1/). [Versionsregister](versioner.json) innehåller första utgåvan. Inga tidigare versioner finns ännu. Framtida utgåvor ska bevara både visningsfil och matchande reserv-PDF före byte av aktuellpekare i MärkR. Källhistorik är en separat återställningsyta.

## Verifiering

Lokala kod- och innehållskontroller, renderad reserv-PDF och publicerade gränssnittsprov redovisas i releaskvittot. Lokal headless-Chrome start och lokal HTTP-bindning är blockerade av körmiljön. Browserpolicyn tillåter inte file-adresser; ingen alternativ file-visningsväg används. Detta begränsar förhandsprov, inte de självständiga kod-/PDF-kontrollerna. Publicerad sida måste provas separat innan den kallas gränssnittsverifierad.

[Återanvändbar metod](../METOD.md) · [Poängkompressionens erfarenhetslogg](../../moten/ai-2026-11-11/presentation/LOGG.md).

## Publiceringskvitto 11 november 2026

Release 9d0a89d7b1de1e0bab6fa1e0739c254adfb4ab90 i gaia-tools och 1d585534d0982cfd349894803308bf899f369191 i markr är skrivna till main och återlästa. Varje blob är jämförd med lokal Git-blobhash. Publika Pages-adresser visar det nya innehållet. Äldre version 3 är oförändrad. Lokala arbetskopior är begränsade exportkopior utan lokalt Git-repo; fjärrgrenen är auktoritativ.

440/440 MärkR-regressioner och 33 DOM/innehållsprov för forskningsbilden godkända. Fem genererade leveransfiler är byteidentiska efter upprepat bygge. Alla fyra PDF-sidor visuellt granskade. Oberoende källgranskning resulterade i två genomförda språkpreciseringar kring Bastanis grupper och icke-signifikant Tutorskillnad.

Verklig Chrome: resultatväxling, fem källpaneler och nästa-knapp, syntes, versionsinformation, spela till slutläge, återställ, piltangent och Escape verifierade. Breda och smala vyer kontrollerade vid 390, 768, 1024 och 1440 CSS-pixlar utan horisontell överflytning. MärkR:s poster 268 och 270 har rätt huvudlänkar och fungerande infällda versionspaneler. En tidigare utgåva med PDF testades i syntetisk testdata, inte fabricerad produktionshistorik.

Begränsning: Fullscreen API nekades i ansluten Chrome; reservläget som använder hela fönstret fungerade. Grov pekemulering och OS-växlad reducerad rörelse är inte liveprovade. Ingen alternativ väg runt webbläsarsäkerhet användes. Lokal file-visning var förbjuden; den publika sidan provades efter ordinarie behörig publicering.

work_status: publicerad, huvudflöden verifierade med ovanstående avgränsning.
documentation_status: metod, loggar, källunderlag och kvitto sammanförda; framtida tillämpningar följer samma versionsprincip.
event_id: EVT-4c4b9f46-b3c3-4541-ba4b-b14dbccd0f49.
[LEKTOR-krönika](https://drive.google.com/file/d/1q-YYp0aIU7GKGafeLvAxqWHxLKfMAQ2q/view) ↔ [huvudkrönika](https://drive.google.com/file/d/1c5gcTDT82TCl3pneLupbvMvQ9ZfD1wRW/view).
