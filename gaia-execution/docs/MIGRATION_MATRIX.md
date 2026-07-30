# GAIA API migration matrix

| Workflow | Free-first route | Optional route | Activation boundary |
|---|---|---|---|
| `/tala` | macOS `say`, then browser SpeechSynthesis | ElevenLabs | Paid approval and encrypted key |
| `/researchfeeds` | Semantic Scholar, Crossref, OpenAlex, DataCite, Europe PMC | Semantic Scholar key for higher limits | Add enabled feed configuration |
| `/nyheter` | RSS and Atom | NewsData or other key-based source | Provider key and separate license review |
| `/väder` | Open-Meteo | Other provider if needed | None for standard mode |
| `/aurora` | NOAA SWPC | None required | None |
| `/ArtportalenAPI` | Existing SOS API adapter | None | Rotated encrypted API key |
| `/godmorgon` | Calendar connector and local notes | Google Tasks bridge | Apps Script deployment and OAuth |
| `/sync` | Drive, Calendar and Gmail connectors | Google Tasks bridge | Apps Script deployment and OAuth |
| `/postsortering` | Gmail connector | Browser | Connector permission or active browser session |
| system health | Open API health action | Local provider-specific checks | GitHub Actions enabled or local runner installed |

A route being present in this table does not mean it is activated. Use the status vocabulary in `DEPLOYMENT.md`.
