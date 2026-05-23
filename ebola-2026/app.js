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
    let activeTileLayer = null;
    let cityMarkers = [];
    let trendChartInstance = null;
    
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
    
    // API Info Modal
    const apiModal = document.getElementById('api-modal');
    const apiModalBtn = document.getElementById('btn-api-info');
    const apiModalClose = document.getElementById('api-modal-close');

    // Map Controls
    const mapStyleSelect = document.getElementById('map-style-select');
    const toggleCities = document.getElementById('toggle-cities');

    // Regionala städer i smittoområdet
    const regionalCities = [
        { name: "Kampala", lat: 0.3136, lng: 32.5811, population: "1.7 miljoner", info: "Ugandas huvudstad och ekonomiska centrum. Här behandlas importerade fall på Mulago-sjukhuset under strikt isolering." },
        { name: "Goma", lat: -1.6742, lng: 29.2285, population: "2.0 miljoner", info: "Huvudstad i provinsen North Kivu, DRC. Extremt tätbefolkad gränsstad mot Rwanda vid Kivusjön." },
        { name: "Bunia", lat: 1.5635, lng: 30.2458, population: "400 000", info: "Huvudstad i provinsen Ituri, DRC. Belägen i direkt anslutning till utbrottets epicentrum och RN4-axeln." },
        { name: "Beni", lat: 0.4913, lng: 29.4719, population: "230 000", info: "Stor handelsstad i North Kivu, DRC. Historiskt drabbad av ebola och präglad av högt säkerhetsläge." },
        { name: "Butembo", lat: 0.1412, lng: 29.2882, population: "670 000", info: "Betydande kommersiellt nav i North Kivu med tät handel och persontrafik över gränsen till Uganda." },
        { name: "Kisangani", lat: 0.5152, lng: 25.1900, population: "1.3 miljoner", info: "Huvudstad i provinsen Tshopo, DRC. Stor hamnstad längs Kongofloden och strategisk knutpunkt." },
        { name: "Entebbe", lat: 0.0512, lng: 32.4637, population: "70 000", info: "Ugandisk stad vid Victoriasjön som hyser landets internationella flygplats och virusforskningsinstitut (UVRI)." }
    ];

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
            
            // Chart.js bugg-fix: invalidatisera storlek om vi visar diagrammet
            if (targetTab === 'tab-charts' && trendChartInstance) {
                setTimeout(() => {
                    trendChartInstance.resize();
                }, 100);
            }
        });
    });

    // 2. INITIALISERA KARTA (Leaflet.js)
    const mapTiles = {
        light: {
            url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
            attrib: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        },
        dark: {
            url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
            attrib: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        },
        osm: {
            url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            attrib: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        },
        satellite: {
            url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            attrib: 'Tiles &copy; Esri &mdash; Source: Esri, USDA, USGS, Aerogrid, IGN, IGP, and the GIS User Community'
        }
    };

    function initMap() {
        // Centrera över Central/Östafrika (DRC/Uganda)
        map = L.map('map-container', {
            zoomControl: true,
            attributionControl: true
        }).setView([0.50, 29.50], 6); // Centrerad nära Semliki Valley / Bunia / Kampala

        // Standard: Ljust läge (CartoDB Positron) för att matcha det ljusa temat
        activeTileLayer = L.tileLayer(mapTiles.light.url, {
            maxZoom: 19,
            attribution: mapTiles.light.attrib
        }).addTo(map);

        // Lyssna på kartbytes-väljaren
        if (mapStyleSelect) {
            mapStyleSelect.addEventListener('change', (e) => {
                const style = e.target.value;
                if (mapTiles[style]) {
                    if (activeTileLayer) {
                        map.removeLayer(activeTileLayer);
                    }
                    activeTileLayer = L.tileLayer(mapTiles[style].url, {
                        maxZoom: 19,
                        attribution: mapTiles[style].attrib
                    }).addTo(map);
                }
            });
        }

        // Lyssna på stads-togglen
        if (toggleCities) {
            toggleCities.addEventListener('change', () => {
                updateCityMarkers();
            });
        }

        // Ladda landsgränser dynamiskt med kloroplet-styling
        loadCountryBorders(map);
    }

    // Funktion för att ladda och färglägga landsgränser (kloroplet)
    function loadCountryBorders(mapInstance) {
        fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson')
            .then(response => {
                if (!response.ok) throw new Error('Network response not ok');
                return response.json();
            })
            .then(geojsonData => {
                L.geoJSON(geojsonData, {
                    interactive: false, // Gör lagret klick-genomsläppligt för att inte blockera markörer
                    style: function(feature) {
                        const countryName = feature.properties.NAME || feature.properties.name || feature.properties.NAME_LONG || '';
                        const iso = feature.properties.ISO_A3 || feature.properties.iso_a3 || feature.properties.ADM0_A3 || '';
                        
                        // 1. Epicenter: DR Kongo (Röd)
                        if (iso === 'COD' || countryName.includes('Congo') || countryName.includes('DRC')) {
                            return { fillColor: '#e11d48', weight: 1.5, opacity: 0.8, color: '#be123c', fillOpacity: 0.12 };
                        } 
                        // 2. Importerat: Uganda (Orange)
                        else if (iso === 'UGA' || countryName === 'Uganda') {
                            return { fillColor: '#ea580c', weight: 1.5, opacity: 0.8, color: '#c2410c', fillOpacity: 0.10 };
                        } 
                        // 3. Riskzon (Beredskap): Omgivande länder (Gul)
                        else if (['RWA', 'BDI', 'SSD', 'KEN', 'TZA'].includes(iso) || 
                                   ['Rwanda', 'Burundi', 'South Sudan', 'Kenya', 'Tanzania'].includes(countryName)) {
                            return { fillColor: '#eab308', weight: 1.2, opacity: 0.6, color: '#a16207', fillOpacity: 0.06 };
                        }
                        
                        // Övriga länder förblir osynliga/transparenta
                        return { fillColor: 'transparent', weight: 0, opacity: 0, fillOpacity: 0 };
                    }
                }).addTo(mapInstance);
            })
            .catch(err => console.warn('Kunde inte ladda landsgränser (tyst fallbacksfel):', err));
    }

    // Funktion för att uppdatera stadsmarkörer
    function updateCityMarkers() {
        // Rensa gamla stadsmarkörer
        cityMarkers.forEach(m => map.removeLayer(m));
        cityMarkers = [];

        if (toggleCities && toggleCities.checked) {
            regionalCities.forEach(city => {
                // Skapa en elegant, liten blå cirkelmarkör med vit ram
                const marker = L.circleMarker([city.lat, city.lng], {
                    radius: 5,
                    color: '#ffffff',
                    fillColor: '#0891b2', // cyan-600
                    fillOpacity: 0.9,
                    weight: 1.5
                }).addTo(map);

                // Popup text
                const popupContent = `
                    <div class="map-popup-header">📍 ${city.name}</div>
                    <div class="map-popup-row" style="margin-bottom: 6px;">
                        <span>Befolkning:</span>
                        <span style="font-weight: 700; color: var(--accent-cyan);">${city.population}</span>
                    </div>
                    <div style="font-size: 11px; color: var(--text-secondary); line-height: 1.45;">
                        ${city.info}
                    </div>
                `;

                marker.bindPopup(popupContent, {
                    maxWidth: 220,
                    closeButton: false
                });

                cityMarkers.push(marker);
            });
        }
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
            updateCityMarkers(); // Rita städerna efter att data har laddats in
            populateNews(ebolaData.news);
            populateScience(ebolaData.science);
            populateVEP(ebolaData.vep_deliberation);
            populateProvenance(ebolaData.data_provenance);
            
            // Initiera trenddiagrammet
            if (ebolaData.history) {
                initTrendChart(ebolaData.history);
            }
            
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
        if (name === 'red') return '#e11d48';
        if (name === 'orange') return '#ea580c';
        if (name === 'purple') return '#7c3aed';
        if (name === 'cyan') return '#0891b2';
        if (name === 'green') return '#0d9488';
        return '#475569';
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

    // Hantera API Info Modal
    if (apiModalBtn && apiModal) {
        apiModalBtn.addEventListener('click', () => {
            apiModal.classList.add('active');
        });
    }

    if (apiModalClose && apiModal) {
        apiModalClose.addEventListener('click', () => {
            apiModal.classList.remove('active');
        });
    }

    if (apiModal) {
        apiModal.addEventListener('click', (e) => {
            if (e.target === apiModal) {
                apiModal.classList.remove('active');
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

    // Populera dataproveniensbanderoll
    function populateProvenance(provenance) {
        const container = document.getElementById('provenance-items');
        if (!container || !provenance) return;
        container.innerHTML = '';

        const items = [
            { key: 'epidemiology', label: 'Siffror' },
            { key: 'news', label: 'Nyheter' },
            { key: 'science', label: 'Vetenskap' },
            { key: 'vep', label: 'VEP' },
            { key: 'trend_chart', label: 'Diagram' },
        ];

        items.forEach(item => {
            const p = provenance[item.key];
            if (!p) return;

            let chipClass = 'chip-simulation';
            if (p.type === 'LIVE API') chipClass = 'chip-live';
            else if (p.type === 'FALLBACK') chipClass = 'chip-fallback';
            else if (p.type === 'AI-GENERERAD') chipClass = 'chip-ai';

            const chip = document.createElement('div');
            chip.className = `provenance-chip ${chipClass}`;
            chip.title = p.description;
            chip.innerHTML = `
                <span class="chip-icon">${p.icon}</span>
                <span class="chip-label">${item.label}:</span>
                <span class="chip-status">${p.type}</span>
            `;
            container.appendChild(chip);
        });

        // Update news source badge
        const newsBadge = document.getElementById('news-source-badge');
        if (newsBadge && provenance.news) {
            const p = provenance.news;
            newsBadge.textContent = p.type;
            newsBadge.className = 'source-badge ' + (p.type === 'LIVE API' ? 'badge-live' : 'badge-fallback');
        }
    }

    // Skapa och formatera det interaktiva trenddiagrammet
    function initTrendChart(history) {
        const canvas = document.getElementById('trendChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Förstör tidigare instans om den redan finns (t.ex. vid återinladdning)
        if (trendChartInstance) {
            trendChartInstance.destroy();
        }

        // Skapa tonade fyllningar (gradients) under linjerna för en modern 'area chart'-känsla
        const fillCases = ctx.createLinearGradient(0, 0, 0, 400);
        fillCases.addColorStop(0, 'rgba(225, 29, 72, 0.12)'); // Rose-600 soft fill
        fillCases.addColorStop(1, 'rgba(225, 29, 72, 0.00)');

        const fillDeaths = ctx.createLinearGradient(0, 0, 0, 400);
        fillDeaths.addColorStop(0, 'rgba(100, 116, 139, 0.12)'); // Slate-500 soft fill
        fillDeaths.addColorStop(1, 'rgba(100, 116, 139, 0.00)');

        // Formatera datumet till svenskt format (t.ex. "22 maj")
        function formatDateSwedish(dateStr) {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            const months = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
            return `${d.getDate()} ${months[d.getMonth()]}`;
        }

        trendChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: history.map(d => formatDateSwedish(d.date)),
                datasets: [
                    {
                        label: 'Misstänkta fall (Kumulativt)',
                        data: history.map(d => d.cases),
                        borderColor: '#e11d48', // var(--accent-red)
                        backgroundColor: fillCases,
                        borderWidth: 3,
                        fill: true,
                        tension: 0.35,
                        pointBackgroundColor: '#e11d48',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 1.5,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        pointHoverBorderWidth: 2
                    },
                    {
                        label: 'Misstänkta dödsfall (Kumulativt)',
                        data: history.map(d => d.deaths),
                        borderColor: '#64748b', // Slate-500 (color-deaths)
                        backgroundColor: fillDeaths,
                        borderWidth: 3,
                        fill: true,
                        tension: 0.35,
                        pointBackgroundColor: '#64748b',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 1.5,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        pointHoverBorderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false // Vi använder vår egen premium HTML-legend
                    },
                    tooltip: {
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        titleColor: '#0f172a',
                        bodyColor: '#334155',
                        titleFont: {
                            family: "'Outfit', sans-serif",
                            size: 13,
                            weight: '600'
                        },
                        bodyFont: {
                            family: "'Inter', sans-serif",
                            size: 12
                        },
                        borderColor: 'rgba(0, 0, 0, 0.06)',
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 10,
                        displayColors: true,
                        boxWidth: 8,
                        boxHeight: 8,
                        boxPadding: 6,
                        usePointStyle: true,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label = label.split(' ')[0] + ': '; // Förenkla till "Misstänkta:" eller "Dödsfall:"
                                }
                                if (context.parsed.y !== null) {
                                    label += context.parsed.y + ' st';
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: 'rgba(15, 23, 42, 0.6)',
                            font: {
                                family: "'Inter', sans-serif",
                                size: 11
                            }
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(15, 23, 42, 0.04)',
                            drawBorder: false
                        },
                        ticks: {
                            color: 'rgba(15, 23, 42, 0.6)',
                            font: {
                                family: "'Inter', sans-serif",
                                size: 11
                            },
                            stepSize: 20
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
    }

    // Initialisera karta och ladda data
    initMap();
    loadData();
});
