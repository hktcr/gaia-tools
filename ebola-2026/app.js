/**
 * Ebola 2026 — Epidemisk Dashboard Logic
 * Skapad för GAIA Epidemic Intelligence
 * Hanterar:
 *  - Dynamisk laddning av ebola_data.json
 *  - Initialisering av Leaflet-karta med CartoDB Dark Matter-paneler
 *  - Kartmarkörer för hälsozoner (Ituri, Kampala, Goma) och modal-kopplingar
 *  - Tab-navigering och kart-storlekspassning (invalidateSize)
 *  - Populering av ReliefWeb nyheter & EuropePMC vetenskapsartiklar
 *  - VEP deliberations-chatt och riskindexvisning
 */

document.addEventListener('DOMContentLoaded', () => {
    // Globala applikationstillstånd
    let ebolaData = null;
    let map = null;
    let markers = [];
    
    // UI Element Referenser
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    const valSuspected = document.getElementById('val-suspected');
    const valConfirmed = document.getElementById('val-confirmed');
    const valDeaths = document.getElementById('val-deaths');
    const valCfr = document.getElementById('val-cfr');
    
    const lastUpdated = document.getElementById('last-updated');
    const systemTime = document.getElementById('system-time');
    
    const newsFeed = document.getElementById('news-feed');
    const newsCount = document.getElementById('news-count');
    
    const scienceFeed = document.getElementById('science-feed');
    const scienceCount = document.getElementById('science-count');
    
    const riskScore = document.getElementById('risk-score');
    const riskRating = document.getElementById('risk-rating');
    const vepChat = document.getElementById('vep-chat');
    
    const detailModal = document.getElementById('detail-modal');
    const modalClose = document.getElementById('modal-close');
    const modalBadge = document.getElementById('modal-badge');
    const modalTitle = document.getElementById('modal-title');
    const modalZones = document.getElementById('modal-zones');
    const modalCases = document.getElementById('modal-cases');
    const modalDeaths = document.getElementById('modal-deaths');
    const modalDescription = document.getElementById('modal-description');
    const modalSecurity = document.getElementById('modal-security');

    // Systemklocka (Realtid)
    function updateClock() {
        const now = new Date();
        if (systemTime) {
            systemTime.textContent = `Tid: ${now.toLocaleDateString('sv-SE')} ${now.toLocaleTimeString('sv-SE')}`;
        }
    }
    setInterval(updateClock, 1000);
    updateClock();

    // 1. TABS SYSTEM
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            
            // Inaktivera alla flikar
            tabButtons.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));
            
            // Aktivera klickad flik
            btn.classList.add('active');
            const targetPane = document.getElementById(targetTab);
            if (targetPane) targetPane.classList.add('active');
            
            // Leaflet bugg-fix: invalidatisera storlek om vi visar kartan
            if (targetTab === 'tab-map' && map) {
                setTimeout(() => {
                    map.invalidateSize();
                }, 100);
            }
        });
    });

    // 2. INITIALISERA KARTA (Leaflet.js)
    function initMap() {
        // Centrera över Central/Östafrika (DRC/Uganda)
        map = L.map('map-container', {
            zoomControl: true,
            attributionControl: false
        }).setView([0.50, 29.50], 6); // Centrerad nära Semliki Valley / Bunia / Kampala

        // CartoDB Dark Matter (Premium mörk stil, helt gratis utan nyckel)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19
        }).addTo(map);

        // Skapa en elegant, liten attribution-ruta manuellt i hörnet
        L.control.attribution({
            position: 'bottomright',
            prefix: 'Leaflet | Map tiles by CartoDB'
        }).addTo(map);
    }

    // 3. LADDA DATA
    async function loadData() {
        try {
            const response = await fetch('ebola_data.json');
            if (!response.ok) {
                throw new Error(`Kunde inte läsa ebola_data.json: status ${response.status}`);
            }
            ebolaData = await response.json();
            
            // 4. POPULERA UI
            populateSidebar(ebolaData.stats);
            populateMapMarkers(ebolaData.map_zones);
            populateNews(ebolaData.news);
            populateScience(ebolaData.science);
            populateVEP(ebolaData.vep_deliberation);
            
            if (lastUpdated) {
                lastUpdated.textContent = `Senast synkad: ${ebolaData.stats.last_sync || '--'}`;
            }
            
        } catch (error) {
            console.error("Fel vid dataladdning:", error);
            if (newsFeed) newsFeed.innerHTML = `<div class="loading-spinner">Fel vid laddning av ebola-data: ${error.message}</div>`;
            if (scienceFeed) scienceFeed.innerHTML = `<div class="loading-spinner">Kunde inte hämta vetenskapliga artiklar.</div>`;
            if (vepChat) vepChat.innerHTML = `<div class="loading-spinner">Kunde inte ladda expertutlåtanden.</div>`;
        }
    }

    // Populera Sidebar KPI:er
    function populateSidebar(stats) {
        if (!stats) return;
        if (valSuspected) valSuspected.textContent = stats.suspected_cases.toLocaleString('sv-SE');
        if (valConfirmed) valConfirmed.textContent = stats.confirmed_cases.toLocaleString('sv-SE');
        if (valDeaths) valDeaths.textContent = stats.suspected_deaths.toLocaleString('sv-SE');
        
        // Beräkna CFR (Case Fatality Rate) om inte satt, eller använd färdigt
        if (valCfr) {
            if (stats.cfr) {
                valCfr.textContent = `${stats.cfr}%`;
            } else if (stats.confirmed_cases > 0) {
                const calculatedCfr = ((stats.suspected_deaths / stats.suspected_cases) * 100).toFixed(1);
                valCfr.textContent = `${calculatedCfr}%`;
            } else {
                valCfr.textContent = `--%`;
            }
        }
        
        // Strain, epicenter osv
        const valStrain = document.getElementById('val-strain');
        const valEpicenter = document.getElementById('val-epicenter');
        if (valStrain && stats.strain) valStrain.textContent = stats.strain;
        if (valEpicenter && stats.epicenter) valEpicenter.textContent = stats.epicenter;
    }

    // Rita cirkelmarkörer på kartan
    function populateMapMarkers(zones) {
        if (!map || !zones) return;
        
        // Rensa gamla markörer om några finns
        markers.forEach(m => map.removeLayer(m));
        markers = [];
        
        zones.forEach(zone => {
            const isImported = zone.imported === true;
            const color = isImported ? varColor('orange') : varColor('red');
            const fillColor = color;
            const fillOpacity = isImported ? 0.35 : 0.45;
            
            // Anpassa radie efter antal fall (minst 15px, max 50px)
            const radius = Math.min(50000, Math.max(15000, zone.cases * 100));

            const circle = L.circle([zone.lat, zone.lng], {
                color: color,
                fillColor: fillColor,
                fillOpacity: fillOpacity,
                weight: 2,
                radius: radius
            }).addTo(map);

            // Popup layout
            const popupHtml = `
                <div class="map-popup-header">${zone.name}</div>
                <div class="map-popup-row">
                    <span>Typ:</span>
                    <span style="font-weight:700; color:${color}">${isImported ? 'Importerat fall' : 'Smittområde'}</span>
                </div>
                <div class="map-popup-row">
                    <span>Misstänkta fall:</span>
                    <span style="font-weight:700;">${zone.cases}</span>
                </div>
                <div class="map-popup-row">
                    <span>Dödsfall:</span>
                    <span style="font-weight:700; color:var(--accent-red)">${zone.deaths}</span>
                </div>
                <button class="map-popup-btn" data-id="${zone.id}">Visa detaljerad analys</button>
            `;

            circle.bindPopup(popupHtml, {
                maxWidth: 240,
                closeButton: false
            });

            // Lyssna på knappen inuti popupen
            circle.on('popupopen', () => {
                const btn = document.querySelector(`.map-popup-btn[data-id="${zone.id}"]`);
                if (btn) {
                    btn.addEventListener('click', () => {
                        openDetailModal(zone);
                    });
                }
            });

            markers.push(circle);
        });
    }

    // Helper för att hämta CSS-färgvariabler
    function varColor(name) {
        if (name === 'red') return '#ff5252';
        if (name === 'orange') return '#ff9f43';
        if (name === 'purple') return '#9b5de5';
        if (name === 'cyan') return '#00d2d3';
        if (name === 'green') return '#10ac84';
        return '#ffffff';
    }

    // Öppna Detail Modal för zon
    function openDetailModal(zone) {
        if (!detailModal) return;
        
        const isImported = zone.imported === true;
        
        if (modalBadge) {
            modalBadge.className = isImported ? 'tier-badge badge-imported' : 'tier-badge';
            modalBadge.textContent = isImported ? 'Importzons-analys' : 'Episenter-analys';
        }
        
        if (modalTitle) modalTitle.textContent = `${zone.name} — Epidemiologisk Profil`;
        if (modalZones) modalZones.textContent = zone.health_zones || '--';
        if (modalCases) modalCases.textContent = zone.cases;
        if (modalDeaths) modalDeaths.textContent = zone.deaths;
        
        if (modalDescription) modalDescription.textContent = zone.description || 'Ingen lägesbeskrivning tillgänglig för närvarande.';
        if (modalSecurity) modalSecurity.textContent = zone.security_logistics || 'Inga restriktioner eller fältrapporter registrerade.';
        
        detailModal.classList.add('active');
    }

    // Stäng modal
    if (modalClose) {
        modalClose.addEventListener('click', () => {
            detailModal.classList.remove('active');
        });
    }

    if (detailModal) {
        detailModal.addEventListener('click', (e) => {
            if (e.target === detailModal) {
                detailModal.classList.remove('active');
            }
        });
    }

    // Populera nyhetsflödet (ReliefWeb)
    function populateNews(newsArray) {
        if (!newsFeed) return;
        newsFeed.innerHTML = '';
        
        if (!newsArray || newsArray.length === 0) {
            newsFeed.innerHTML = '<div class="loading-spinner">Inga humanitära sitreps tillgängliga.</div>';
            if (newsCount) newsCount.textContent = '0 källor';
            return;
        }

        if (newsCount) newsCount.textContent = `${newsArray.length} sitreps`;

        newsArray.forEach(item => {
            const dateStr = item.date ? new Date(item.date).toLocaleDateString('sv-SE') : '--';
            const newsHtml = `
                <article class="news-item">
                    <div class="news-item-header">
                        <span class="news-source">${item.source || 'ReliefWeb'}</span>
                        <time class="news-date" datetime="${item.date}">${dateStr}</time>
                    </div>
                    <h4><a href="${item.link}" target="_blank" rel="noopener noreferrer">${item.title}</a></h4>
                    <div class="news-meta-block">
                        <span class="news-credibility">Källa: ${item.origin || 'FN / WHO'}</span>
                        <span class="credibility-stamp">${item.credibility || 'HÖG TROVÄRDIGHET'}</span>
                    </div>
                </article>
            `;
            newsFeed.insertAdjacentHTML('beforeend', newsHtml);
        });
    }

    // Populera vetenskapliga artiklar (EuropePMC)
    function populateScience(scienceArray) {
        if (!scienceFeed) return;
        scienceFeed.innerHTML = '';
        
        if (!scienceArray || scienceArray.length === 0) {
            scienceFeed.innerHTML = '<div class="loading-spinner">Inga vetenskapliga artiklar hittades.</div>';
            if (scienceCount) scienceCount.textContent = '0 studier';
            return;
        }

        if (scienceCount) scienceCount.textContent = `${scienceArray.length} studier`;

        scienceArray.forEach(item => {
            const authorStr = item.authorString ? item.authorString : (item.authors || 'Okänd författare');
            const journalStr = item.journalTitle ? item.journalTitle : (item.journal || 'EuropePMC database');
            const scienceHtml = `
                <article class="science-item">
                    <div class="science-item-header">
                        <span class="science-journal">${journalStr}</span>
                        <span class="science-year">${item.pubYear || item.year || '--'}</span>
                    </div>
                    <h4><a href="${item.link || 'https://doi.org/' + item.doi}" target="_blank" rel="noopener noreferrer">${item.title}</a></h4>
                    <div class="science-authors">${authorStr}</div>
                    <div class="science-doi">${item.doi ? 'DOI: ' + item.doi : 'ID: ' + item.id}</div>
                </article>
            `;
            scienceFeed.insertAdjacentHTML('beforeend', scienceHtml);
        });
    }

    // Populera VEP-panelen och deliberationsloggen
    function populateVEP(vep) {
        if (!vep) return;
        
        if (riskScore && vep.risk_index) riskScore.textContent = vep.risk_index;
        if (riskRating && vep.risk_rating) riskRating.textContent = vep.risk_rating;
        
        if (!vepChat) return;
        vepChat.innerHTML = '';
        
        if (!vep.transcript || vep.transcript.length === 0) {
            vepChat.innerHTML = '<div class="loading-spinner">Inga granskningsprotokoll loggade.</div>';
            return;
        }

        vep.transcript.forEach(msg => {
            if (msg.role === 'system_meta') {
                const metaHtml = `
                    <div class="vep-message system-meta">
                        <span>${msg.text}</span>
                    </div>
                `;
                vepChat.insertAdjacentHTML('beforeend', metaHtml);
            } else {
                const domain = msg.domain || msg.sender.toLowerCase().split(' ')[0];
                const msgHtml = `
                    <div class="vep-message" data-domain="${domain}">
                        <div class="vep-message-header">
                            <span class="vep-sender">${msg.sender}</span>
                            <span class="vep-tag">${msg.title || 'Expert'}</span>
                            <span class="vep-msg-time">${msg.time || ''}</span>
                        </div>
                        <div class="vep-bubble">
                            <p>${msg.text}</p>
                        </div>
                    </div>
                `;
                vepChat.insertAdjacentHTML('beforeend', msgHtml);
            }
        });

        // Skrolla längst ner i deliberationsloggen för att se sista slutsatserna
        setTimeout(() => {
            vepChat.scrollTop = vepChat.scrollHeight;
        }, 300);
    }

    // Initialisera karta och ladda data
    initMap();
    loadData();
});
