# Publiceringsrutin för hktcr GitHub Pages

Detta är den gemensamma och auktoritativa rutinen för publicering av hktcr-projekt på GitHub Pages. Projektspecifika instruktioner får lägga till kontroller men inte försvaga denna rutin.

## Grundregel

Den anslutna GitHub-appen är den primära publiceringsvägen när den har skrivrätt till repot. Saknad GitHub CLI, `gh`, är då inte ett hinder och får inte användas som skäl för att lämna en färdig release lokalt.

Publicering sker normalt direkt till `main` när användaren uttryckligen har bett att en etablerad hktcr-sida ska byggas eller publiceras. Ett repo som kräver pull request följer i stället sin egen skyddsregel.

## Statusord

- Byggd: ändringen finns i arbetskopian.
- Lokalt verifierad: föreskrivna tester och lokala kontroller är godkända.
- Committad: en lokal eller fjärrlagrad commit finns.
- Skriven till main: repots fjärrgren `main` pekar på releasecommitten.
- Publicerad: GitHub Pages levererar releasecommitten på den publika adressen.
- Verifierad: den publika sidan har lästs tillbaka och kärnfunktionerna har provats.

En lägre status får aldrig beskrivas som en högre. En lokal commit, en uppladdad gren eller en grön GitHub-kontroll är inte i sig en publicerad sida.

## Förkontroll

1. Fastställ exakt repo, standardgren, Pages-adress och kanonisk källkatalog via GitHub-appen och repots egna styrfiler.
2. Kontrollera att GitHub-appen har skrivrätt. Försök inte ersätta ett tillgängligt appflöde med en obehörig kommandorad.
3. Läs aktuell SHA för fjärrgren `main` omedelbart före publicering och spara den som återställningspunkt.
4. Kontrollera arbetskopians status och diff. Bevara orelaterade ändringar och ta bara med releasefilerna.
5. Kör projektets tester, byggare, validatorer och syntaxkontroller. Deterministiskt genererade filer ska byggas två gånger och bli byteidentiska.
6. Kontrollera minst Chrome samt responsiva lägen för 390, 768, 1024 och 1440 CSS-pixlar när gränssnittet har ändrats. Prova tangentbord, grov pekare, mörkt läge och reducerad rörelse när funktionerna berörs.

## Primär publiceringsväg

Använd GitHub-appens Git-datametod så att hela releasen blir en enda atomisk commit.

1. Läs `main` och dess committräd från GitHub.
2. Jämför fjärrgrenens SHA med den bas som testades. Om grenen har ändrats, avbryt skrivningen, hämta ändringen, integrera den och kör testerna igen.
3. Skapa blobbar för exakt de filer som ingår i releasen.
4. Jämför SHA som GitHub returnerar för varje blob med filens lokala Git-blob-SHA från `git hash-object`. Avbryt om en enda fil skiljer sig. Detta är obligatoriskt även när API-anropet svarar att det lyckades, särskilt för stora filer som kan kapas av en överföringsgräns.
5. Skapa ett nytt träd med aktuellt `main`-träd som bas.
6. Kontrollera att det nya trädets SHA är samma som det lokalt testade Git-trädets SHA när releasen motsvarar en lokal commit.
7. Skapa en commit med aktuell `main`-commit som enda förälder.
8. Flytta `main` till den nya committen med `force: false`.
9. Läs tillbaka `main`, releasecommitten och kritiska filer från GitHub.

Använd aldrig tvångsuppdatering av `main`. Gör inte en separat commit per fil när Git-datametoden är tillgänglig.

## Reservväg

Lokal `git push` får användas om autentiseringen redan fungerar och ger samma säkra, snabba uppdatering. GitHub CLI är ett frivilligt hjälpmedel, inte ett krav. Om varken GitHub-appen eller befintlig Git-autentisering kan skriva ska arbetet beskrivas som lokalt verifierat, inte publicerat.

## Kontroll efter skrivning

1. Bekräfta att fjärrgren `main` pekar på releasecommitten.
2. Kontrollera GitHub Actions eller Pages-status om projektet har en sådan kontroll.
3. Öppna den verkliga Pages-adressen med en unik cacheparameter tills releaseidentifieraren eller förväntat innehåll syns.
4. Prova sidans kärnfunktioner på den publika versionen. För gränssnitt ska minst vanlig datormus, tangentbord och mobil eller pekemulering kontrolleras.
5. Synkronisera den lokala grenen med publicerad commit eller dokumentera exakt varför den avviker.
6. Skriv ett publiceringskvitto med repo, föregående SHA, release-SHA, filer, tester, publik adress och uppnådd status.

## Återställning

Spara alltid föregående `main`-SHA. Om den publika releasen har ett fel ska den återställas genom en ny revertcommit och en normal snabb uppdatering. Skriv aldrig om historiken och använd aldrig `force` för återställning.

## Stoppregler

Avbryt publiceringen om något av följande gäller:

- Fjärrgren `main` har ändrats efter testad bas.
- Diffen innehåller orelaterade eller okända ändringar.
- Obligatoriska tester eller validatorer misslyckas.
- Kanoniskt repo eller Pages-adress kan inte verifieras.
- Skrivningen skulle kräva `force`.

Saknad `gh` är inte en stoppregel när den anslutna GitHub-appen har skrivrätt.

## Kort beslutsträd

1. Har användaren bett om publicering av en etablerad hktcr-sida? Fortsätt till verifierad publicering.
2. Har GitHub-appen skrivrätt? Använd den primära vägen.
3. Saknas appskrivrätt men fungerar befintlig Git-autentisering? Använd reservvägen.
4. Saknas båda? Rapportera lokalt verifierad status och det konkreta åtkomsthindret.
5. Syns releaseversionen på Pages och fungerar kärnflödet? Först då är status verifierad.
