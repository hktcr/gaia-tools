# VEP: Granskning av AI-workshop för chefer i BIN (21 maj 2026)

## 📌 Kontext och Uppdrag
Den 21 maj ska en tre timmar lång workshop hållas för chefsgruppen inom BIN (Bildningsförvaltningen/Barn- och utbildning). Syftet är att avdramatisera AI, visa på konkreta användningsområden i Google Workspace (Gemini) och ge cheferna hands-on erfarenhet av att lösa verkliga case med AI som tankepartner.

**Uppdrag:** Att i egenskap av experter obarmhärtigt granska körschemat och upplägget för att hitta svagheter, risker och möjligheter till förbättring innan vi låser presentationen och bygger klart casen.

## 👥 Panelen

*   ⚖️ **Kommunjuristen (Informationssäkerhet & GDPR):** Din roll är att agera bromskloss och skyddsnät. Du granskar upplägget ur ett strikt dataskyddsperspektiv. Vad får man absolut *inte* stoppa in i AI:n? Täcker vi säkerhetsaspekten tillräckligt tydligt innan vi släpper cheferna lösa på egna case?
*   🧭 **HR-strategen (Förändringsledning):** Din roll är att bevaka den mänskliga faktorn. Chefer är ofta pressade. Känns det här upplägget som ytterligare en IT-börda, eller lyckas vi kommunicera det som en verklig avlastning? Hur landar "repetitionen och principerna" psykologiskt?
*   🎯 **Kritisk Områdeschef (Peer-representant):** Du representerar målgruppen. Du har ont om tid och vill ha konkreta verktyg *nu*. Är det för mycket teori i början? Känns casen (t.ex. medarbetarsamtal, resursfördelning) relevanta för din stressiga vardag, eller är de för akademiska?

## 📄 Underlag: Körschema (Draft 1)
*(Se filen: workshop_bin_chefer.md eller tidigare diskussion i tråden)*
**Tidsåtgång:** 180 minuter
*   **00:00 - 00:30 | Repetition och Principer (Håkan):** Mindset, prompting-principer.
*   **00:30 - 01:00 | AI i Google Workspace (Emil):** Funktionalitet, säkerhet, riktlinjer.
*   **01:00 - 01:20 | Fika & Bensträckare**
*   **01:20 - 01:45 | Gemensamt Case i Helgrupp:** Modellering av ett chefs-problem live på skärm.
*   **01:45 - 02:40 | Chefernas Case i Smågrupper:** Hands-on med egna vardagsproblem. Håkan/Emil cirkulerar.
*   **02:40 - 03:00 | Återsamling och Insikter:** Dela best practice och nästa steg.

---

## 💬 VEP Deliberation (Omgång 1 — 2026-05-04)

**Panelsammansättning:**
- ⚖️ Kommunjuristen (Informationssäkerhet & GDPR)
- 🧭 HR-strategen (Förändringsledning)
- 🎯 Kritisk Områdeschef (Peer-representant)
- 🖥️ IT-strategen (Teknisk realism)
- 🎓 Lärande-designern (Pedagogisk kvalitet)
- 🧪 Testpiloten (Erfarenheter från Björnekulla 28 april)

**Huvudinsikter & Rekommendationer:**

1. **Förarbetet lovordas, men säkerheten är A och O.**
   - Det är en enorm styrka att Emil bygger ett formulär (och Anna skickar ut det) för att samla in chefernas egna vardagscase i förväg.
   - **GDPR-Varning:** Emil är duktig på detta, men instruktionerna i formuläret måste ha en skarp disclaimer att *absolut inga utpekande personuppgifter* får skickas in.
   - **Åtgärd utförd:** En varningsslide ("Avpersonifiering") med ett animerat utropstecken har lagts till i slutet av presentationen (`slides.json`) för att visuellt förstärka budskapet under workshopen.

2. **Tidig aktivering krävs (Block 1).**
   - Tre timmar är en lång sittning. Om Håkan och Emil pratar oavbrutet i över en timme innan cheferna får testa själva, riskerar vi att de zonar ut.
   - **Förslag till Håkan:** Lägg in ett "Mikro-case" redan under Block 1. Låt cheferna få knappa in en enkel prompt eller testa en grundläggande funktion i Gemini *innan* Emil går in på säkerhet och admin-vyer. Detta skapar en kroppslig förståelse för varför säkerheten är viktig.

3. **Anonymisering i smågrupperna (Block 3).**
   - Utifrån erfarenheterna från Björnekulla fungerar arbete i par väldigt bra. För att sänka prestige-tröskeln hos cheferna rekommenderar panelen att paren *inte* arbetar med sina egna inskickade case.
   - **Metod:** Dela ut någon annans (avpersonifierade) case. Det gör det lättare att granska och diskutera problemet objektivt utan att känna att det egna ledarskapet bedöms.
