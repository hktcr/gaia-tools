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
    { id: 'book-1', label: 'Livets byggstenar · fiktiv bok', color: '#91bdf4' },
    { id: 'book-2', label: 'Samband i naturen · fiktiv bok', color: '#ecaecb' },
    { id: 'book-3', label: 'Biologi i vår vardag · fiktiv bok', color: '#a8d9b5' },
    { id: 'book-4', label: 'Vatten, mark och framtid · fiktiv bok', color: '#78cddd' },
    { id: 'book-5', label: 'Undersök det levande · fiktiv bok', color: '#e9c78f' }
  ];
  // Themes are cross-cutting questions, distinct from the subject anchors above.
  const themes = [
    { id: 'food', label: 'Matens väg', color: '#edba77' },
    { id: 'water', label: 'Liv i och kring vatten', color: '#72cddd' },
    { id: 'climate', label: 'En föränderlig planet', color: '#a3d391' },
    { id: 'invisible', label: 'Det osynliga livet', color: '#beaceb' },
    { id: 'city', label: 'Naturen nära oss', color: '#95cfae' },
    { id: 'identity', label: 'Lika men olika', color: '#e6a7c5' },
    { id: 'evidence', label: 'Hur kan vi veta?', color: '#efaa91' },
    { id: 'future', label: 'Människans biologiska val', color: '#b1bdf0' }
  ];
  const packages = [
    { id: 'carbon', label: 'Kolhydrater & kolets kretslopp', short: 'Kol & kolhydrater', color: '#ffd77a' },
    { id: 'modification', label: 'Genmodifiering', color: '#c3adfa' },
    { id: 'cell-organism', label: 'Från cell till organism', color: '#82d9e9' },
    { id: 'water-lab', label: 'Vattnets samband', color: '#72cddd' },
    { id: 'urban', label: 'Biologi på skolgården', color: '#95cfae' },
    { id: 'food-chain', label: 'Från jord till måltid', color: '#edba77' },
    { id: 'variation', label: 'Variation och förändring', color: '#e6a7c5' },
    { id: 'evidence-kit', label: 'Pröva, tolka och granska', color: '#efaa91' }
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
    make(24, 'Ett förändrat ekosystem', 'ecology', ['ekosystem', 'näringsväv', 'osäkerhet'], 'Resonera', [[2, '2. Ekologiska samband'], [3, '2. Teman över ämnesgränser']], [], 'I ett förenklat ekosystem minskar en population. Beskriv två möjliga följder och vilken ytterligare information du behöver för att välja mellan dem.'),
    make(25, "Fröets första energi", "energy", ["groning", "cellandning", "energireserv"], "Förklara", [[1, "2. Energi i levande system"], [4, "1. Odling och resurser"]], ["carbon", "food-chain"], "Ett frö gror i mörker en kort tid. Förklara varifrån dess materia och användbara energi kan komma innan gröna blad har utvecklats."),
    make(26, "Rötter i vatten", "cell", ["osmos", "membran", "vatten"], "Tolka modell", [[1, "1. Cellens delar"], [4, "2. Vatten som livsmiljö"]], ["cell-organism", "water-lab"], "En modell visar vattenrörelse genom ett membran. Förklara hur skillnader i koncentration kan påverka nettotransporten och vad modellen utelämnar om en rot."),
    make(27, "En sjö under dygnet", "energy", ["fotosyntes", "cellandning", "syre"], "Resonera", [[2, "2. Ekologiska samband"], [4, "2. Vatten som livsmiljö"]], ["carbon", "water-lab"], "Vattenväxter får ljus på dagen men inte på natten. Resonera om hur fotosyntes och cellandning kan påverka syrehalten vid olika tider."),
    make(28, "Vad säger vattenprovet?", "methods", ["provtagning", "variation", "osäkerhet"], "Planera undersökning", [[4, "2. Vatten som livsmiljö"], [5, "1. Frågor och mätningar"]], ["water-lab", "evidence-kit"], "Ett enda vattenprov tas nära en strand. Föreslå hur provtagningen kan breddas innan man beskriver hela sjön och motivera dina val."),
    make(29, "Blommande vägkanter", "ecology", ["pollinering", "livsmiljö", "biologisk mångfald"], "Resonera", [[2, "2. Ekologiska samband"], [4, "3. Natur nära människor"]], ["urban", "food-chain"], "Två vägkanter klipps vid olika tider. Beskriv möjliga följder för blommande växter och pollinerare samt vad som behöver undersökas."),
    make(30, "Blad i sol och skugga", "cell", ["kloroplast", "fotosyntes", "anpassning"], "Jämföra", [[1, "1. Cellens delar"], [4, "3. Natur nära människor"]], ["cell-organism", "urban", "carbon"], "Jämför hur bladens ljusmiljö kan påverka fotosyntesen. Skilj en möjlig förändring hos ett blad från en ärftlig förändring över generationer."),
    make(31, "Kompostens massa", "energy", ["nedbrytning", "materia", "gasutbyte"], "Förklara", [[2, "1. Materia i kretslopp"], [4, "1. Odling och resurser"]], ["carbon", "food-chain", "urban"], "En kompost minskar i massa. Förklara varför materien inte har försvunnit och ge exempel på vart delar av den kan ha tagit vägen."),
    make(32, "Jäst i en modell", "cell", ["mikroorganismer", "jäsning", "cellandning"], "Jämföra", [[1, "2. Energi i levande system"], [3, "3. Mat och mikroorganismer"]], ["food-chain", "cell-organism"], "Jämför på begreppsnivå jästcellers energiutvinning med och utan tillgång till syre. Skilj organismen från den process den utför."),
    make(33, "Maten och mikroberna", "ecology", ["mikroorganismer", "temperatur", "nedbrytning"], "Resonera", [[3, "3. Mat och mikroorganismer"], [4, "1. Odling och resurser"]], ["food-chain"], "Resonera om varför temperatur kan påverka hur snabbt mat förändras. Förklara varför kyla inte betyder att alla mikroorganismer försvinner."),
    make(34, "Jämför två skördar", "methods", ["kontrollgrupp", "variabler", "odling"], "Tolka data", [[4, "1. Odling och resurser"], [5, "2. Data och slutsatser"]], ["food-chain", "evidence-kit", "modification"], "I ett fiktivt odlingsförsök ger sort A 12, 14 och 13 gram; sort B 11, 17 och 12 gram. Vad kan jämförelsen antyda, och vad kräver fler försök?"),
    make(35, "Olika frön, samma bädd", "genetics", ["variation", "ärftlighet", "miljö"], "Resonera", [[1, "3. Ärftlighet"], [4, "1. Odling och resurser"]], ["variation", "food-chain"], "Frön från olika plantor växer i samma bädd men blir olika höga. Ge möjliga ärftliga och miljörelaterade förklaringar utan att avgöra orsaken i förväg."),
    make(36, "Stadens varma hörn", "ecology", ["mikroklimat", "livsmiljö", "temperatur"], "Resonera", [[4, "3. Natur nära människor"]], ["urban"], "En innergård är varmare än en närliggande park. Beskriv hur det kan påverka två organismgrupper och vilka andra skillnader som bör undersökas."),
    make(37, "Räkna utan att dubbelräkna", "methods", ["inventering", "provtagning", "osäkerhet"], "Planera undersökning", [[5, "1. Frågor och mätningar"], [4, "3. Natur nära människor"]], ["urban", "evidence-kit"], "Planera en observation av fåglar på skolgården utan att störa dem. Hur kan plats, tid och dubbelräkning påverka jämförelsen mellan dagar?"),
    make(38, "Isolerade gröna öar", "ecology", ["spridning", "livsmiljö", "population"], "Tolka modell", [[2, "2. Ekologiska samband"], [4, "3. Natur nära människor"]], ["urban", "variation"], "Tre parker binds ihop av olika gröna stråk. Rita en modell av möjlig spridning och förklara varför samma stråk kan fungera olika för olika arter."),
    make(39, "Slump i en liten population", "genetics", ["genetisk drift", "variation", "population"], "Tolka modell", [[1, "3. Ärftlighet"], [5, "3. Modeller som verktyg"]], ["variation"], "Använd färgade brickor som modell för ärftliga varianter. Förklara hur slumpmässigt urval av få brickor kan ändra fördelningen utan att någon variant har en fördel."),
    make(40, "Kamouflage över generationer", "genetics", ["naturligt urval", "ärftlighet", "variation"], "Förklara", [[1, "3. Ärftlighet"], [2, "2. Ekologiska samband"]], ["variation"], "I en fiktiv population varierar färg ärftligt och påverkar risken att upptäckas. Förklara hur fördelningen kan ändras över generationer utan att individer väljer sin färg."),
    make(41, "En modell av släktskap", "genetics", ["släktskap", "evolution", "modeller"], "Tolka modell", [[1, "3. Ärftlighet"], [5, "3. Modeller som verktyg"]], ["variation", "evidence-kit"], "Rita ett förgrenat träd för fyra fiktiva arter. Förklara vad en gemensam förgreningspunkt betyder och varför en nutida art inte måste vara en annans förfader."),
    make(42, "När blomningen flyttar", "ecology", ["fenologi", "temperatur", "pollinering"], "Resonera", [[4, "3. Natur nära människor"], [2, "2. Ekologiska samband"]], ["urban", "variation"], "En växt blommar tidigare ett varmt år. Resonera om möjliga följder för pollinering och skilj en enskild observation från en långsiktig trend."),
    make(43, "Kol bundet i marken", "ecology", ["kolcykel", "mark", "nedbrytning"], "Förklara", [[2, "1. Materia i kretslopp"], [4, "1. Odling och resurser"]], ["carbon", "food-chain"], "Beskriv hur växtmaterial kan tillföra kol till marken och hur nedbrytning kan föra kol vidare. Varför räcker inte en enda mätning för att fastställa förändringen över tid?"),
    make(44, "Varmare vatten, flera orsaker", "methods", ["samvariation", "orsakssamband", "syre"], "Granska argument", [[4, "2. Vatten som livsmiljö"], [5, "2. Data och slutsatser"]], ["water-lab", "evidence-kit"], "Ett påhittat diagram visar lägre syrehalt vid högre temperatur. Ange möjliga förklaringar och vilken ytterligare information som behövs för att skilja dem åt."),
    make(45, "En algblomning tar plats", "ecology", ["övergödning", "nedbrytning", "syre"], "Förklara", [[4, "2. Vatten som livsmiljö"], [2, "2. Ekologiska samband"]], ["water-lab", "carbon"], "Gör en möjlig orsakskedja från ökad näringstillförsel till syrebrist efter att alger dör. Markera vilka steg som beror på lokala förhållanden."),
    make(46, "Salt och celler", "cell", ["osmos", "membran", "koncentration"], "Tillämpa", [[1, "1. Cellens delar"], [4, "2. Vatten som livsmiljö"]], ["water-lab", "cell-organism"], "Använd en membranmodell för att förutsäga nettotransport av vatten när omgivningens salthalt ökar. Ange modellens antaganden."),
    make(47, "Många celler samarbetar", "cell", ["organisationsnivå", "transport", "vävnad"], "Förklara", [[1, "1. Cellens delar"], [3, "2. Teman över ämnesgränser"]], ["cell-organism"], "Förklara varför en flercellig organism behöver transport mellan olika delar. Koppla en enskild cells behov till ett organs funktion."),
    make(48, "Olika proteiner i samma växt", "genetics", ["genuttryck", "protein", "miljö"], "Resonera", [[1, "3. Ärftlighet"], [4, "1. Odling och resurser"]], ["modification", "cell-organism", "food-chain"], "Två blad på samma växt producerar olika mycket av ett protein. Resonera om möjliga skillnader i genuttryck utan att anta att bladens DNA har ändrats."),
    make(49, "Ett beslut om en gröda", "methods", ["riskbedömning", "värderingar", "genmodifiering"], "Granska argument", [[3, "1. Biologi och samhälle"], [5, "2. Data och slutsatser"]], ["modification", "food-chain", "evidence-kit"], "En fiktiv gröda ger större skörd men dess påverkan på andra arter är dåligt undersökt. Skilj kunskapsfrågor från värderingar i ett beslut om fortsatt utvärdering."),
    make(50, "Biologisk mångfald på två sätt", "methods", ["biologisk mångfald", "diagram", "mått"], "Tolka data", [[5, "2. Data och slutsatser"], [4, "3. Natur nära människor"]], ["urban", "evidence-kit"], "Plats A har fyra arter med 5 individer vardera. Plats B har fyra arter med 17, 1, 1 och 1 individ. Jämför artrikedom och fördelning mellan arter."),
    make(51, "Vems energi räknas?", "energy", ["energiflöde", "näringsväv", "produktion"], "Jämföra", [[2, "2. Ekologiska samband"], [3, "3. Mat och mikroorganismer"]], ["food-chain", "carbon"], "Jämför två förenklade vägar från växtproduktion till mat. Förklara varför antal steg i näringsväven påverkar energiflödet men inte ensamt avgör ett matval."),
    make(52, "Vatten i en växt", "energy", ["vatten", "transport", "avdunstning"], "Tolka modell", [[1, "2. Energi i levande system"], [4, "2. Vatten som livsmiljö"]], ["water-lab", "cell-organism", "food-chain"], "Följ vatten från mark till rot, blad och luft i en modell. Skilj transport och avdunstning från hur vatten deltar i fotosyntesen."),
    make(53, "Två sätt att restaurera en damm", "methods", ["ekosystem", "målkonflikt", "evidens"], "Granska argument", [[3, "1. Biologi och samhälle"], [4, "2. Vatten som livsmiljö"]], ["water-lab", "urban", "evidence-kit"], "Två fiktiva förslag vill förbättra en damms livsmiljöer med olika metoder. Ange vilka observationer och mål som behövs för att jämföra förslagen."),
    make(54, "Nedbrytning i kyla", "ecology", ["nedbrytning", "temperatur", "kolcykel"], "Resonera", [[2, "1. Materia i kretslopp"], [4, "1. Odling och resurser"]], ["carbon", "food-chain"], "Resonera om hur ändrad temperatur kan påverka nedbrytning. Förklara varför tillgång till vatten, syre och organiskt material också behöver beaktas."),
    make(55, "En modell kan ändras", "methods", ["modeller", "evidens", "revidering"], "Tolka modell", [[5, "3. Modeller som verktyg"], [3, "2. Teman över ämnesgränser"]], ["evidence-kit", "water-lab"], "En dammodell saknar nedbrytare men nya observationer visar syreförbrukning i mörker. Föreslå en ändring av modellen och en observation som kan pröva den."),
    make(56, "Samma egenskap, olika nytta", "genetics", ["naturligt urval", "miljö", "egenskaper"], "Resonera", [[1, "3. Ärftlighet"], [3, "1. Biologi och samhälle"]], ["variation", "modification"], "En ärftlig växtegenskap ger en fördel i torr miljö men en kostnad i fuktig miljö. Förklara varför egenskapens effekt behöver beskrivas i sitt sammanhang.")
  ];

  // Additive editorial classification; original example content remains unchanged.
  const taskThemes = {"EX-01": ["invisible", "identity"], "EX-02": ["invisible", "water"], "EX-03": ["food", "climate"], "EX-04": ["food", "invisible"], "EX-05": ["climate", "city"], "EX-06": ["invisible", "climate"], "EX-07": ["food", "climate"], "EX-08": ["food", "evidence"], "EX-09": ["identity", "invisible"], "EX-10": ["identity", "future"], "EX-11": ["identity", "invisible"], "EX-12": ["food", "future"], "EX-13": ["future", "evidence"], "EX-14": ["future", "climate"], "EX-15": ["evidence", "food"], "EX-16": ["evidence", "city"], "EX-17": ["climate", "food"], "EX-18": ["evidence", "future"], "EX-19": ["identity", "climate"], "EX-20": ["invisible", "identity"], "EX-21": ["evidence", "climate"], "EX-22": ["identity", "invisible"], "EX-23": ["invisible", "water"], "EX-24": ["climate", "city"], "EX-25": ["food", "invisible"], "EX-26": ["water", "food"], "EX-27": ["water", "climate", "invisible"], "EX-28": ["water", "evidence"], "EX-29": ["city", "food"], "EX-30": ["city", "climate", "invisible"], "EX-31": ["food", "city", "climate"], "EX-32": ["food", "invisible"], "EX-33": ["food", "invisible"], "EX-34": ["food", "evidence", "future"], "EX-35": ["food", "identity"], "EX-36": ["city", "climate"], "EX-37": ["city", "evidence"], "EX-38": ["city", "identity", "future"], "EX-39": ["identity", "evidence"], "EX-40": ["identity", "climate"], "EX-41": ["identity", "evidence"], "EX-42": ["city", "climate", "food"], "EX-43": ["climate", "food"], "EX-44": ["water", "evidence", "climate"], "EX-45": ["water", "climate"], "EX-46": ["water", "invisible"], "EX-47": ["invisible", "identity"], "EX-48": ["food", "identity", "invisible"], "EX-49": ["food", "future", "evidence"], "EX-50": ["city", "evidence"], "EX-51": ["food", "climate", "future"], "EX-52": ["water", "food", "climate"], "EX-53": ["water", "city", "future", "evidence"], "EX-54": ["climate", "invisible", "food"], "EX-55": ["water", "invisible", "evidence"], "EX-56": ["identity", "climate", "future"]};
  const extraPackages = {"EX-03": ["food-chain"], "EX-06": ["urban"], "EX-07": ["food-chain"], "EX-12": ["food-chain"], "EX-13": ["evidence-kit"], "EX-15": ["evidence-kit"], "EX-16": ["evidence-kit", "urban"], "EX-18": ["evidence-kit"], "EX-19": ["variation"], "EX-21": ["evidence-kit"], "EX-24": ["urban"]};
  const extraPlacements = {"EX-03": {"book": "book-4", "chapter": "1. Odling och resurser"}, "EX-13": {"book": "book-5", "chapter": "2. Data och slutsatser"}, "EX-15": {"book": "book-5", "chapter": "2. Data och slutsatser"}, "EX-16": {"book": "book-5", "chapter": "1. Frågor och mätningar"}, "EX-19": {"book": "book-4", "chapter": "3. Natur nära människor"}, "EX-21": {"book": "book-5", "chapter": "3. Modeller som verktyg"}, "EX-24": {"book": "book-4", "chapter": "3. Natur nära människor"}};
  tasks.forEach(task => {
    task.themes = taskThemes[task.id];
    task.packages.push(...(extraPackages[task.id] || []));
    if (extraPlacements[task.id]) task.placements.push(extraPlacements[task.id]);
  });
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
    { from: 'EX-21', to: 'EX-17', type: 'prerequisite', status: 'proposed', reason: 'Möjlig progression mellan modeller. Riktning och nivå behöver bedömas.' },
    {"from": "EX-25", "to": "EX-04", "type": "prerequisite", "status": "approved", "reason": "Cellandning behövs för att förklara fröets energiförsörjning."},
    {"from": "EX-26", "to": "EX-02", "type": "prerequisite", "status": "approved", "reason": "Membrantransport ger grunden för vattenmodellen."},
    {"from": "EX-27", "to": "EX-03", "type": "prerequisite", "status": "approved", "reason": "Fotosyntes behövs för att resonera om syre i ljus."},
    {"from": "EX-27", "to": "EX-04", "type": "prerequisite", "status": "approved", "reason": "Cellandning behövs för resonemanget om nattens syreförbrukning."},
    {"from": "EX-28", "to": "EX-16", "type": "related", "status": "approved", "reason": "Rättvisa jämförelser fördjupas till representativ provtagning."},
    {"from": "EX-29", "to": "EX-42", "type": "related", "status": "approved", "reason": "Blomningens tid kopplar samman stadsmiljö och pollinering."},
    {"from": "EX-30", "to": "EX-03", "type": "related", "status": "approved", "reason": "Fotosyntesen undersöks i olika ljusmiljöer."},
    {"from": "EX-31", "to": "EX-06", "type": "prerequisite", "status": "approved", "reason": "Nedbrytarnas roll behövs för förklaringen av komposten."},
    {"from": "EX-32", "to": "EX-04", "type": "related", "status": "approved", "reason": "Olika former av energiutvinning jämförs."},
    {"from": "EX-33", "to": "EX-54", "type": "related", "status": "approved", "reason": "Temperaturens betydelse jämförs i mat och mark."},
    {"from": "EX-34", "to": "EX-16", "type": "prerequisite", "status": "approved", "reason": "Variabler och jämförbarhet behövs för försöksbedömningen."},
    {"from": "EX-35", "to": "EX-19", "type": "related", "status": "approved", "reason": "Variation undersöks med ett konkret odlingsexempel."},
    {"from": "EX-36", "to": "EX-42", "type": "related", "status": "approved", "reason": "Temperatur kopplar stadens miljö till årstidshändelser."},
    {"from": "EX-37", "to": "EX-28", "type": "related", "status": "approved", "reason": "Provtagningens begränsningar jämförs mellan fåglar och vatten."},
    {"from": "EX-38", "to": "EX-24", "type": "related", "status": "approved", "reason": "Livsmiljöers samband fördjupar ekosystemmodellen."},
    {"from": "EX-39", "to": "EX-19", "type": "prerequisite", "status": "approved", "reason": "Variation över generationer behövs för driftmodellen."},
    {"from": "EX-40", "to": "EX-19", "type": "prerequisite", "status": "approved", "reason": "Ärftlig variation behövs för att förklara naturligt urval."},
    {"from": "EX-41", "to": "EX-39", "type": "related", "status": "proposed", "reason": "Möjlig jämförelse av evolutionsmodeller; nivå och relevans behöver granskas."},
    {"from": "EX-43", "to": "EX-05", "type": "related", "status": "approved", "reason": "Marken ger ett fördjupat perspektiv på kolets kretslopp."},
    {"from": "EX-44", "to": "EX-15", "type": "related", "status": "approved", "reason": "Båda skiljer diagramtolkning från säkra orsaksförklaringar."},
    {"from": "EX-45", "to": "EX-06", "type": "prerequisite", "status": "approved", "reason": "Nedbrytning behövs för kedjan från döda alger till syreförbrukning."},
    {"from": "EX-45", "to": "EX-27", "type": "related", "status": "approved", "reason": "Processer som påverkar syrehalten binds samman."},
    {"from": "EX-46", "to": "EX-26", "type": "related", "status": "approved", "reason": "Samma vattenmodell tillämpas på ändrad salthalt."},
    {"from": "EX-47", "to": "EX-20", "type": "prerequisite", "status": "approved", "reason": "Organisationsnivåer behövs för att koppla cellbehov till organ."},
    {"from": "EX-48", "to": "EX-11", "type": "prerequisite", "status": "approved", "reason": "Genuttryck behövs för att förklara skilda proteinmängder."},
    {"from": "EX-49", "to": "EX-13", "type": "prerequisite", "status": "approved", "reason": "Skillnaden mellan observationer, antaganden och värderingar stödjer beslutet."},
    {"from": "EX-50", "to": "EX-37", "type": "related", "status": "approved", "reason": "Inventering kopplas till hur mångfald kan beskrivas."},
    {"from": "EX-51", "to": "EX-07", "type": "prerequisite", "status": "approved", "reason": "Energiflöde genom näringsvävar behövs för jämförelsen."},
    {"from": "EX-52", "to": "EX-26", "type": "related", "status": "approved", "reason": "Vattentransport kopplas mellan cell och hel växt."},
    {"from": "EX-53", "to": "EX-24", "type": "related", "status": "approved", "reason": "Ekosystemets möjliga följder ger perspektiv på restaurering."},
    {"from": "EX-54", "to": "EX-43", "type": "related", "status": "approved", "reason": "Nedbrytning kopplar klimatförhållanden till markkol."},
    {"from": "EX-55", "to": "EX-27", "type": "related", "status": "approved", "reason": "Syreprocesser används för att ompröva en modell."},
    {"from": "EX-55", "to": "EX-21", "type": "related", "status": "approved", "reason": "Modellers innehåll och begränsningar granskas."},
    {"from": "EX-56", "to": "EX-40", "type": "prerequisite", "status": "approved", "reason": "Naturligt urval ger grunden för miljöberoende fördelar."},
    {"from": "EX-56", "to": "EX-14", "type": "related", "status": "proposed", "reason": "Möjlig överföring mellan förändrade egenskaper och urval; behöver sakgranskas."},
    {"from": "EX-53", "to": "EX-49", "type": "related", "status": "proposed", "reason": "Möjlig gemensam beslutsstruktur, men ekologiska skillnader behöver bedömas."}
  ];
  const data = { schemaVersion: 1, synthetic: true, subjects, themes, books, packages, tasks, relations };
  if (typeof module !== 'undefined' && module.exports) module.exports = data;
  else root.GraphData = data;
})(typeof window !== 'undefined' ? window : globalThis);
