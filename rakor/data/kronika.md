# Råkoinventering Åstorp 2026 — Krönika

> Denna krönika är den fullständiga revisionsloggen för råkoinventeringen.
> Varje session dokumenteras med: originalfältdata, bearbetning, ruttilldelningar och kommentarer.

---

## Session 1: 2026-04-03

### Originalfältdata (rå, från fältbok)
```
Position 56.17965, 13.01576 10 bon
56.17986, 13.01659 77 bon
56.17709, 13.01709 40 bon
56.17785, 13.01556 47 bon
56.16480, 12.97951 12 bon
56.16219, 12. 97525 7 bon
56. 14470, 12. 94217 26 bon
56.13696, 12. 93258 31 bon
56.10521, 12.88395 16 bon  ← FEL, korrigerad nedan
56.10023, 12.86581 42 bon
56.10071, 12.86320 141 bon
56.10230, 12.86229 15 bon
56.10450, 12.86973 3 bon
56.10402, 12.87812 13 bon
```

### Korrigeringar
- **Punkt 9**: Position 56.10521, 12.88395 låg utanför Åstorps kommun. Korrigerad till **56.10173, 12.87385**.

### Sammanslagningar
- **Punkt 1-4** (Rönnetorp): 10 + 77 + 40 + 47 = **174 bon** → centroid 56.17861, 13.01625
- **Punkt 10-11** (Kvidinge-Kyrka): 42 + 141 = **183 bon** → centroid 56.10047, 12.86451

### Ruttilldelningar (exporterade 2026-04-05)
| Kluster | Label | Bon | Rutor |
|---------|-------|-----|-------|
| G1 | Rönnetorp | 174 | AS46, AS47, AS48, AT46, AT47, AT48, AU47 |
| G2 | Stehag-N | 12 | AK40, AK41 |
| G3 | Stehag-S | 7 | AJ39, AJ40 |
| G4 | Bälsåkra | 26 | AA31, AA32, AB31, AB32, AB33 |
| G5 | Kvistofta | 31 | Y28 |
| G6 | Kvidinge-Ö | 16 | J12, J13, K12, K13, L13 |
| G7 | Kvidinge-Kyrka | 183 | H11, H12, I11, I12 |
| G8 | Kvidinge-V | 15 | H13 |
| G9 | Kvidinge-Park | 3 | I14, J14 |
| G10 | Kvidinge-NÖ | 13 | K14, L14 |

### Tomma rutor (105 st)
Inventerade utan bon. Se fullständig lista i exportfilen.

### Åtgärdslogg (urval)
- Fältdata laddad: 14 punkter, 480 bon
- Sammanslagning #10+#11 → 183 bon vid Kvidinge-Kyrka
- Sammanslagning #1+#2+#3+#4 → 174 bon vid Rönnetorp
- Punkt 9 korrigerad: 56.10521 → 56.10173 (utanför kommunen)
- 105 rutor markerade som inventerade-tomma
- Alla 10 kluster tilldelade rutor

### Sammanfattning
- **480 bon** i **10 kluster**
- **105 tomma rutor** inventerade
- **31 rutor** med bon (nest-status)
- Totalt **136 av 1647 rutor** inventerade (8,3%)
- Täcker främst södra delen (Kvidinge) och norra (Rönnetorp)

---

## Session 4: 2026-04-28

### Originalfältdata (rå, från admin-export)
```
Inga nya bon. 134 rutor markerade som inventerade-tomma.
Tre inventeringsområden:
  (1) AI33–AU37 (centralt, väster om Rönnetorp)
  (2) AY10–BD13 (östra kommunen)
  (3) BI7–BM11 (sydöstra kommunen)
```

### Korrigeringar
Inga korrigeringar behövdes.

### Nya kluster
Inga nya kluster identifierade.

### Tomma rutor (134 st)
AI33, AI34, AI35, AJ33, AJ34, AJ35, AJ36, AK33, AK34, AK35, AK36, AK37, AL32, AL33, AL34, AL35, AL36, AL37, AL38, AM32, AM33, AM34, AM35, AM36, AM37, AM38, AM39, AM40, AM41, AN32, AN33, AN34, AN35, AN36, AN37, AN38, AN39, AN40, AN41, AO32, AO33, AO34, AO35, AO36, AO37, AO38, AO39, AO40, AO41, AP32, AP33, AP34, AP35, AP36, AP37, AP38, AP39, AP40, AQ31, AQ32, AQ33, AQ34, AQ35, AQ36, AQ37, AQ38, AQ39, AQ40, AR31, AR32, AR33, AR34, AR35, AR36, AR37, AR38, AR39, AR40, AS31, AS32, AS33, AS34, AS35, AS36, AS37, AS38, AS39, AS40, AT36, AT37, AU36, AU37, AY10, AY11, AY12, AY13, AZ10, AZ11, AZ12, AZ13, BA10, BA11, BA12, BA13, BB11, BB12, BC11, BC12, BD11, BD12, BD13, BI7, BI8, BI9, BJ6, BJ7, BJ8, BJ9, BJ10, BJ11, BK6, BK7, BK8, BK9, BK10, BK11, BL6, BL7, BL8, BL9, BL10, BL11, BM10, BM11

### Sammanfattning
- **0 bon** (inga nya kluster)
- **134 tomma rutor** inventerade
- Totalt **1596 av 1647 rutor** inventerade (**96,9%**)
- **75 rutor** med nest-status, **1517 tomma** (4 fieldnotes)
- Återstår: **51 rutor** oinventerade

---

### 🪞 Clean Slate Insight — 2026-04-17
**Objekt:** Råkdata-propagering mellan verktyg
**The "Day One" Advice:** "Bygg in data-propageringen i själva export-steget direkt från början, eller använd en gemensam URL för alla verktyg."
*— Ur konversation 9d7a6*

---
