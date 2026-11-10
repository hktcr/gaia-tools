import {readFileSync,writeFileSync} from 'node:fs';
function renderMeeting(data,remiss){
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const row=s=>`<article class="study" id="${esc(s.id)}">
<h3><a class="study-link" href="${esc(s.url)}">${esc(s.title)}<span class="out" aria-hidden="true">↗</span></a></h3>
<p class="teaser">${esc(s.teaser)}</p>
<details class="study-notes"><summary><span class="meta">${esc(s.author)}<span class="publication">${esc(s.type)}</span></span><span class="notes-label">Om studien <span aria-hidden="true">+</span></span></summary>
<div class="notes-body"><p class="context">${esc(s.context)}</p><p>${esc(s.finding)}</p><p><strong>Begränsningar.</strong> ${esc(s.limit)}</p><p class="original">${esc(s.original)}</p></div></details>
</article>`;
const group=g=>data.filter(s=>s.group===g).map(row).join("\n");
const quotes=["tech","sv","sva","bild","musik","sh"].map(k=>`<li><a href="${esc(remiss[k].url)}">${esc(remiss[k].label)} <span aria-hidden="true">↗</span></a><q>${esc(remiss[k].quote)}</q></li>`).join("\n");
return `<!doctype html>
<html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="description" content="Originalstudier om AI, lärande och bedömning. Underlag inför kollegiets samtal den 11 november 2026."><meta name="gaia-release" content="ai-mote-2026-11-11-v2"><title>AI i undervisningen · gAIa</title><link rel="stylesheet" href="../assets/style.css?v=2"></head>
<body id="top" class="meeting-page"><a class="skip" href="#innehall">Hoppa till innehållet</a>
<div class="page">
<header class="meeting-header">
<div class="masthead"><a class="brand" href="../" aria-label="gAIa – mötesunderlag">g<span>AI</span>a</a><time datetime="2026-11-11">11 november 2026</time></div>
<h1>AI i undervisningen</h1><p class="subtitle">Studier inför kollegiets samtal.</p>
<nav aria-label="På den här sidan"><a href="#larande">Lärande</a><a href="#kompression">Bedömning</a><a href="#fler-kallor">Fler källor</a><a href="#remiss">Kursplaner</a></nav>
</header>
<main id="innehall" tabindex="-1">
<section id="larande" aria-labelledby="h-larande"><h2 id="h-larande">Elevens lärande</h2>${group("larande")}</section>
<section id="kompression" aria-labelledby="h-kompression"><h2 id="h-kompression">Poängkompression</h2>
<p class="section-note">Flera studier visar att AI-poäng kan samlas i ett snävare intervall än mänskliga referensbedömningar. Mönstret varierar och har setts även i delpoäng.</p>
${group("kompression")}
</section>
<section id="fler-kallor" class="supplement" aria-labelledby="h-fler"><h2 id="h-fler" class="visually-hidden">Fler källor</h2>
<details class="more" id="extra-studies"><summary><span>Fler studier</span><span class="summary-meta">11 källor <span aria-hidden="true">+</span></span></summary>
<div class="more-body"><h3 class="subheading">Bedömning</h3>${group("fordjupning")}<h3 class="subheading">Återkoppling</h3>${group("aterkoppling")}<h3 class="subheading">Lärarens planering</h3>${group("larartid")}</div></details>
</section>
<section id="remiss" class="supplement" aria-labelledby="h-remiss"><h2 id="h-remiss" class="visually-hidden">Kursplaner på remiss</h2>
<details class="more" id="remiss-excerpts"><summary><span>AI i kursplaneremissen</span><span class="summary-meta">6 utdrag <span aria-hidden="true">+</span></span></summary>
<div class="more-body"><p>Ordagranna utdrag ur <a href="${esc(remiss.remiss.url)}">Skolverkets remiss den 9 november 2026</a>. Det är förslag, inte beslutade kursplaner. Årskurserna följer förslagets tioåriga grundskola.</p><ul class="quotes">${quotes}</ul><p class="small">Länkarna går till respektive PDF-sida. Öppna dokumentet för hela sammanhanget. Urvalet av AI-omnämnanden är inte uttömmande.</p></div>
</details></section>
</main>
<footer class="page-footer"><p>Urval under arbete · Uppdaterat 10 november 2026</p><p>18 studier och rapporter. Ett riktat urval, inte en systematisk forskningsöversikt.</p><a href="../">Alla mötesunderlag</a></footer>
</div></body></html>`;
}
const data=JSON.parse(readFileSync(new URL('./ai-2026-11-11/studies.json',import.meta.url),'utf8'));
writeFileSync(new URL('./ai-2026-11-11/index.html',import.meta.url),renderMeeting(data.studies,data.remiss));
