/* All records in this file are independently written, fictional examples. */
(function (root) {
  'use strict';
  const subjects = [
    { id: 'cell', label: 'Cellen', color: '#82d9e9' },
    { id: 'energy', label: 'Energi & materia', color: '#ffd77a' },
    { id: 'ecology', label: 'Ekologi', color: '#9dd7a1' },
    { id: 'genetics', label: 'Genetik', color: '#c3adfa' },
    { id: 'methods', label: 'Metod & resonemang', color: '#f7a797' }
  ];
  const books = [
    { id: 'book-1', label: 'Bok 1', color: '#91bdf4' },
    { id: 'book-2', label: 'Bok 2', color: '#ecaecb' },
    { id: 'book-3', label: 'Bok 3', color: '#a8d9b5' }
  ];
  const packages = [
    { id: 'carbon', label: 'Kolhydrater & kolets kretslopp', short: 'Kol & kolhydrater', color: '#ffd77a' },
    { id: 'modification', label: 'Genmodifiering', color: '#c3adfa' },
    { id: 'cell-organism', label: 'Från cell till organism', color: '#82d9e9' }
  ];
  const make = (id, title, subject, concepts, skill, placements, packs, prompt) => ({
    id: 'EX-' + String(id).padStart(2, '0'), title, subject, concepts, skill,
    placements: placements.map(([book, chapter]) => ({ book: 'book-' + book, chapter })),
    packages: packs, prompt, course: 'Exempelkurs: Biologi', source: 'Nyskrivet syntetiskt exempel', version: 1
  });
  const tasks = [
    make(1, 'Cellens olika rum', 'cell', ['cellstruktur', 'membran'], 'Jämföra', [[1, '1. Cellens delar']], ['cell-organism'], 'Jämför två förenklade cellmodeller. Vilka strukturer finns i båda, och vilka funktioner hjälper modellerna dig att förstå?'),
    make(2, 'Vad passerar membranet?', 'cell', ['membran', 'transport'], 'Tolka modell', [[1, '1. Cellens delar']], ['cell-organism'], 'Använd en förenklad modell för att resonera om hur ämnen passerar ett cellmembran. Beskriv också en begränsning hos modellen.'),
    make(3, 'Ljus blir kemisk energi', 'energy', ['fotosyntes', 'kolhydrater', 'energiomvandling'], 'Förklara', [[1, '2. Energi i levande system'], [2, '1. Materia i kretslopp']], ['carbon'], 'Följ en kolatom från koldioxid till en kolhydrat i en förenklad bild av fotosyntesen. Skilj flödet av materia från omvandlingen av energi.'),
    make(4, 'Energi ur en kolhydrat', 'energy', ['cellandning', 'kolhydrater', 'energiomvandling'], 'Förklara', [[1, '2. Energi i levande system']], ['carbon', 'cell-organism'], 'Beskriv på en övergripande nivå hur celler kan frigöra användbar energi ur kolhydrater. Vilka ämnen måste finnas med i din beskrivning?'),
    make(5, 'Kolets väg genom en skog', 'ecology', ['kolcykel', 'fotosyntes', 'cellandning'], 'Tolka modell', [[2, '1. Materia i kretslopp'], [3, '2. Teman över ämnesgränser']], ['carbon'], 'Rita ett enkelt kretslopp som binder samman atmosfär, växter, djur och nedbrytare. Förklara vad två av pilarna betyder.'),
    make(6, 'Nedbrytarnas roll', 'ecology', ['nedbrytning', 'kolcykel', 'näringsväv'], 'Förklara', [[2, '1. Materia i kretslopp']], ['carbon'], 'Förklara varför nedbrytare behövs i en modell av materiens kretslopp. Vad skulle en modell utan nedbrytare missa?'),
    make(7, 'Energi i en näringsväv', 'ecology', ['näringsväv', 'energiflöde'], 'Resonera', [[2, '2. Ekologiska samband']], ['carbon'], 'Jämför hur energi och kol rör sig genom en näringsväv. Vilka delar går att beskriva som ett kretslopp, och vilka gör det inte?'),
    make(8, 'Kolhydrat på två sätt', 'energy', ['kolhydrater', 'molekylmodell'], 'Jämföra', [[1, '2. Energi i levande system'], [3, '2. Teman över ämnesgränser']], ['carbon'], 'Jämför en förenklad molekylbild med en text om samma kolhydrat. Vilken information syns i den ena representationen men inte i den andra?'),
    make(9, 'Från DNA till egenskap', 'genetics', ['DNA', 'genuttryck', 'egenskaper'], 'Förklara', [[1, '3. Ärftlighet']], ['modification', 'cell-organism'], 'Beskriv ett förenklat samband mellan DNA, protein och en egenskap. Ge ett skäl till att sambandet inte alltid kan visas med en enda rak pil.'),
    make(10, 'Vad kan en mutation ändra?', 'genetics', ['DNA', 'variation', 'mutation'], 'Resonera', [[1, '3. Ärftlighet']], ['modification'], 'Resonera om varför en förändring i DNA ibland kan påverka en egenskap och ibland inte ger någon tydlig effekt.'),
    make(11, 'Samma DNA, olika celler', 'cell', ['genuttryck', 'celldifferentiering'], 'Förklara', [[1, '1. Cellens delar'], [3, '1. Biologi och samhälle']], ['cell-organism', 'modification'], 'Hur kan olika celltyper i samma organism ha olika funktioner trots att de i stort sett har samma DNA? Använd begreppet genuttryck.'),
    make(12, 'Förädling och genmodifiering', 'genetics', ['genmodifiering', 'ärftlighet', 'förädling'], 'Jämföra', [[3, '1. Biologi och samhälle']], ['modification'], 'Jämför förädling och genmodifiering på begreppsnivå. Beskriv en likhet, en skillnad och en fråga som kräver mer information.'),
    make(13, 'Vad vet en riskbedömning?', 'methods', ['genmodifiering', 'evidens', 'osäkerhet'], 'Granska argument', [[3, '1. Biologi och samhälle']], ['modification'], 'Läs två påhittade påståenden om en förändrad gröda. Skilj observationer, antaganden och värderingar åt. Vilken ytterligare information behövs för en bedömning?'),
    make(14, 'Egenskap i en ny miljö', 'ecology', ['genmodifiering', 'ekosystem', 'miljö'], 'Resonera', [[2, '2. Ekologiska samband'], [3, '1. Biologi och samhälle']], ['modification'], 'Resonera på konceptuell nivå om varför effekten av en egenskap kan bero på miljön. Använd ett helt påhittat växtexempel.'),
    make(15, 'Är diagrammet tillräckligt?', 'methods', ['diagram', 'evidens', 'fotosyntes'], 'Tolka data', [[2, '3. Undersöka samband']], ['carbon'], 'Ett påhittat diagram visar ett samband mellan ljus och tillväxt. Nämn en möjlig tolkning och två saker diagrammet inte ensamt kan visa.'),
    make(16, 'En rimlig jämförelse', 'methods', ['kontrollgrupp', 'variabler', 'osäkerhet'], 'Planera undersökning', [[2, '3. Undersöka samband']], [], 'Beskriv hur två grupper av ofarliga modellobjekt kan jämföras rättvist. Identifiera en variabel att ändra och en att hålla konstant.'),
    make(17, 'Var finns kolet nu?', 'energy', ['kolcykel', 'materia', 'molekylmodell'], 'Tillämpa', [[2, '1. Materia i kretslopp']], ['carbon'], 'Följ samma tänkta kolatom genom tre olika delar av ett kretslopp. Ange vilket ämne eller material den ingår i vid varje steg.'),
    make(18, 'Påstående eller belägg?', 'methods', ['evidens', 'källkritik', 'genmodifiering'], 'Granska argument', [[3, '1. Biologi och samhälle']], ['modification'], 'Sortera fyra nyskrivna exempelmeningar som påståenden eller belägg. Förklara varför ett belägg kan vara relevant utan att avgöra hela frågan.'),
    make(19, 'Variation i en population', 'genetics', ['variation', 'ärftlighet', 'miljö'], 'Tolka modell', [[1, '3. Ärftlighet'], [2, '2. Ekologiska samband']], [], 'Använd en förenklad populationsmodell för att skilja variation mellan individer från förändring över generationer.'),
    make(20, 'Cell till vävnad', 'cell', ['celldifferentiering', 'organisationsnivå'], 'Tolka modell', [[1, '1. Cellens delar']], ['cell-organism'], 'Ordna cell, vävnad, organ och organism som nivåer i en modell. Beskriv vad modellen förenklar.'),
    make(21, 'Två bilder av samma kretslopp', 'methods', ['kolcykel', 'modeller', 'osäkerhet'], 'Jämföra', [[2, '3. Undersöka samband'], [3, '2. Teman över ämnesgränser']], ['carbon'], 'Jämför två schematiska kretsloppsbilder. Vad behöver vara känt för att avgöra om deras pilar faktiskt beskriver samma relation?'),
    make(22, 'Information går i arv', 'genetics', ['DNA', 'ärftlighet'], 'Förklara', [[1, '3. Ärftlighet']], ['cell-organism'], 'Förklara på övergripande nivå hur genetisk information kan föras vidare mellan cellgenerationer. Skilj informationen från den egenskap som kan uppstå.'),
    make(23, 'Andning är inte bara luft', 'energy', ['cellandning', 'organisationsnivå'], 'Jämföra', [[1, '2. Energi i levande system']], ['cell-organism', 'carbon'], 'Skilj cellandning från gasutbyte. Beskriv ett samband mellan processerna utan att behandla dem som samma sak.'),
    make(24, 'Ett förändrat ekosystem', 'ecology', ['ekosystem', 'näringsväv', 'osäkerhet'], 'Resonera', [[2, '2. Ekologiska samband'], [3, '2. Teman över ämnesgränser']], [], 'I ett förenklat ekosystem minskar en population. Beskriv två möjliga följder och vilken ytterligare information du behöver för att välja mellan dem.')
  ];
  // Direction is semantic: from the task needing prior knowledge to the prerequisite.
  const relations = [
    { from: 'EX-04', to: 'EX-03', type: 'related', status: 'approved', reason: 'Kompletterande perspektiv på kolhydrater och energi.' },
    { from: 'EX-05', to: 'EX-03', type: 'prerequisite', status: 'approved', reason: 'Fotosyntesens roll behövs för denna kretsloppsmodell.' },
    { from: 'EX-05', to: 'EX-04', type: 'prerequisite', status: 'approved', reason: 'Cellandning binder samman flera delar av kretsloppet.' },
    { from: 'EX-06', to: 'EX-05', type: 'related', status: 'approved', reason: 'Nedbrytning fördjupar samma modell.' },
    { from: 'EX-07', to: 'EX-05', type: 'related', status: 'approved', reason: 'Materiens kretslopp jämförs med energiflöde.' },
    { from: 'EX-09', to: 'EX-22', type: 'prerequisite', status: 'approved', reason: 'Genetisk information ligger till grund för förklaringen.' },
    { from: 'EX-11', to: 'EX-09', type: 'prerequisite', status: 'approved', reason: 'Genuttryck kopplar information till cellfunktion.' },
    { from: 'EX-12', to: 'EX-09', type: 'prerequisite', status: 'approved', reason: 'Relationen mellan DNA och egenskap ger begreppslig grund.' },
    { from: 'EX-13', to: 'EX-18', type: 'related', status: 'approved', reason: 'Båda tränar skillnaden mellan påstående och belägg.' },
    { from: 'EX-17', to: 'EX-05', type: 'related', status: 'approved', reason: 'Samma kretslopp följs med ett annat perspektiv.' },
    { from: 'EX-23', to: 'EX-04', type: 'related', status: 'approved', reason: 'Två representationer av cellandning.' },
    { from: 'EX-24', to: 'EX-07', type: 'prerequisite', status: 'approved', reason: 'Näringsväven stödjer resonemanget om följder.' },
    { from: 'EX-15', to: 'EX-03', type: 'related', status: 'proposed', reason: 'Möjlig koppling mellan datatolkning och fotosyntes. Behöver sakgranskas.' },
    { from: 'EX-14', to: 'EX-12', type: 'related', status: 'proposed', reason: 'Möjlig fördjupning om egenskap och miljö. Behöver sakgranskas.' },
    { from: 'EX-21', to: 'EX-17', type: 'prerequisite', status: 'proposed', reason: 'Möjlig progression mellan modeller. Riktning och nivå behöver bedömas.' }
  ];
  const data = { schemaVersion: 1, synthetic: true, subjects, books, packages, tasks, relations };
  if (typeof module !== 'undefined' && module.exports) module.exports = data;
  else root.GraphData = data;
})(typeof window !== 'undefined' ? window : globalThis);
