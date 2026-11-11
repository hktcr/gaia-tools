# AI som studiekompis

[Öppna aktuell utgåva](https://hktcr.github.io/gaia-tools/forskningsbilder/ai-studiekompis/). [Logg](LOGG.md). [Metod](../METOD.md).

Bygg från repository-roten med `python3 forskningsbilder/ai-studiekompis/build.py` följt av `python3 forskningsbilder/ai-studiekompis/make_pdf.py`. PDF-bygget kräver ReportLab och fontTools. HTML använder samma inbäddade URW Gothic-fonter som bevarad presentationsversion 3. Licenstext finns i versionskatalogen.

Studiedata definieras i build.py och skrivs identiskt till HTML och studier.json. PDF läser samma JSON. Det centrala resultatet är avsiktligt manuellt layoutat i båda formaten. Vid revision ska sakpåståenden, faser och slutsats kontrolleras i båda. PDF är fyra 16:9-sidor: resultat, källor och syntes. Tillfälligt pdf-assets-underlag ska inte publiceras.

1.0.0: 33 DOM- och innehållskontroller godkända; oberoende källgranskning med två språkförtydliganden genomförd; fyra renderade PDF-sidor kontrollerade. PDF och HTML byggs deterministiskt. Verklig publicerings- och gränssnittskontroll dokumenteras i loggen och huvudkrönikan.
