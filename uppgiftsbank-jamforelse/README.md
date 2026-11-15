# Uppgiftsbankens modeller

Granskningsversion av en fristående 2D-jämförelse. Ersätter inte den publicerade 3D-demon. Endast fiktiva biologiska exempel, ingen KM-export.

## Underlag och avgränsning

Principerna har jämförts med RFC: Innehållsenheter eller Flockmodellen (9 november 2026), Sekvenskurser och flervägskurser (12 november 2026) och beställarens förtydliganden om två redaktionella arbetsytor.

- Innehållsenheter: gemensamma enheter, första versionens gräns på ett kapitel per bok, flest gemensamma enheter och bokens ordning vid lika. Fler placeringar markeras uttryckligen som skissad utbyggnad.
- Flockmodellen: majoritet bland kända syskon, ett förberett semantiskt delurval och separata manuella respektive spärrade länkar. Ingen verklig AI. En spärrad vinnare ger i bilden ingen automatisk reservplacering; någon sådan regel har inte antagits.
- Taggar och paket: arbetssätt nära Innehållsenheter, inte en fullständig tredje implementation. Uppgiftens taggar och paketens villkor är självständigt redigerbara. Förmågor blandas inte in som ämnesbegrepp.
- Behörighet är en separat begränsning. Matchningen körs bara på de fyra fiktiva tillgängliga uppgifterna; den är inte ett behörighetssystem.
- Säkra länkar, AI-stöd och manuella undantag är inte unika nya egenskaper. Befintliga RFC-funktioner märks som sådana.

## Kontroller

Kör: `node model.test.cjs`, `node --check app.js`, `node --check model.js`.

17 rena modellkontroller körda i verktygets JavaScript-miljö. Samma kontroller finns här för reproduktion med Node. JavaScript parsades och statiska DOM-ID-referenser kontrollerades. Detta är inte ett webbläsartest.

## Före publicering

Följ ../PUBLICERINGSRUTIN.md. En fungerande lokal körmiljö och webbläsare saknades under framtagningen. Återstår: Chrome på 390, 768, 1024 och 1440 CSS-pixlar; tangentbord, mus, pekemulering, mörkt läge; alla tre vyer; återställning och tomma urval. Kontrollera även Page-förhandsvisningen i sin riktiga sandbox. Publicera inte som verifierad förrän de föreskrivna kontrollerna är gjorda.

## Kärnflöden

1. Innehållsenheter: ärvda enheter ger fel förstaval; redaktionell precisering förbättrar valet; den märkta utbyggnaden visar två platser.
2. Flock: hela flocken och delurvalet ger olika förslag; manuell placering ligger kvar; spärrad länk återkommer inte.
3. Taggar: ta bort Endosymbios från U1, se urval ändras; blockera, prova det förberedda AI-förslaget och kontrollera att inget tilldelas.
4. Paket: välj ELLER, OCH och UTESLUT, pröva tomt resultat; lägg till Endosymbios utan att ändra några original.
5. Återställ i alla lägen. Ingen kontroll bakom en panel får få dolt fokus; inga överlagrade dialoger används.
