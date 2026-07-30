# GAIA Execution: liveverifiering 2026-07-31

## Omfattning

Den första verkliga GitHub Actions-körningen av `GAIA open API health` genomfördes i pull request 2 och granskades före merge.

## Proveniens

- verifieringscommit: `bae4dc3747dd1bfe096706facf6b8782e1d6da59`
- workflow run: `30590816340`
- jobb: `health`, jobb-ID `91032528144`
- resultat för workflow och jobb: `success`
- artifact: `gaia-open-api-health`, artifact-ID `8778269249`
- artifact digest: `sha256:933293d85216baf02bc9229e46502a60fc7da6dba66729d1b79faf4e10cfc068`
- verifieringstrigger merge commit: `931830767ff84c50ee303b2422435af6a78bf9a0`

## Providerresultat

Kvittot rapporterade `status: degraded`, `mode: live`, `ok: 8`, `total: 9`.

Normala svar med HTTP 200:

- Open-Meteo
- NOAA SWPC
- Crossref
- OpenAlex
- DataCite
- Europe PMC
- OpenLibrary
- Internet Archive

Semantic Scholar svarade HTTP 429 för den nyckelfria sökvägen. Det betyder att workflowets exekvering, checkout, Pythonmiljö och artifactkedja är produktionsverifierade, medan providergruppen som helhet är degraderad tills rate limit har klingat av eller en godkänd API-nyckel används.

## Statusbedömning

| Del | Status |
|---|---|
| GitHub Actions exekveringskedja | Produktionsverifierad |
| JSON-kvitto och artifactuppladdning | Produktionsverifierade |
| Åtta nyckelfria providers | Liveverifierade |
| Semantic Scholar, nyckelfri sökning | Degraderad på grund av HTTP 429 |
| Semantic Scholar med valfri nyckel | Byggd men inte aktiverad |
| Google Tasks-brygga | Byggd men inte aktiverad |
| Lokal Mac-runner | Byggd men inte installerad på målmaskinen |

## Epistemisk gräns

Ett grönt workflow bevisar att exekveringskedjan fungerade. Providerkvittot måste fortfarande läsas. Denna körning ska därför inte beskrivas som nio av nio friska providers.
