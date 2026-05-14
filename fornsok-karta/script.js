// Init map
const map = L.map('map', {
    zoomControl: false 
}).setView([56.13, 13.00], 11); // Center around Åstorp as default

L.control.zoom({
    position: 'bottomright'
}).addTo(map);

const positron = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 19
});

const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: '&copy; Esri',
    maxZoom: 19
});

const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenTopoMap',
    maxZoom: 17
});

const baseMaps = {
    "Standardkarta": positron,
    "Topografisk karta": topo,
    "Satellitbild": satellite
};

positron.addTo(map);

L.control.layers(baseMaps, null, { position: 'bottomleft' }).addTo(map);

// Determine marker color based on type
function getMarkerColor(type) {
    if (!type) return '#d9480f'; // Default Orange
    const t = type.toLowerCase();
    
    // Gravar och Gravfält
    if(t.includes('grav') || t.includes('hög')) return '#8b5cf6'; // Purple
    
    // Jordbruk och Odling
    if(t.includes('odling') || t.includes('åker') || t.includes('hägnad') || t.includes('terrass')) return '#10b981'; // Green
    
    // Boplatser och Husgrunder
    if(t.includes('boplats') || t.includes('husgrund') || t.includes('grund') || t.includes('gård') || t.includes('torp')) return '#f59e0b'; // Amber
    
    // Stenar, Rösen, Hällristningar
    if(t.includes('stensättning') || t.includes('röse') || t.includes('ristning') || t.includes('stenkrets')) return '#64748b'; // Slate
    
    // Runstenar, milstenar
    if(t.includes('run') || t.includes('milst')) return '#ef4444'; // Red
    
    // Försvar, Slott, Borg
    if(t.includes('slott') || t.includes('fästning') || t.includes('borg') || t.includes('skans') || t.includes('värn')) return '#3b82f6'; // Blue
    
    // Industri, Gruva, Grop
    if(t.includes('gruva') || t.includes('hytta') || t.includes('grop') || t.includes('brott')) return '#78350f'; // Brown
    
    return '#d9480f'; // Default Orange
}

// Custom SVG icon generator
function createIcon(color) {
    return L.divIcon({
        className: 'fornlamning-marker',
        html: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2Z" fill="${color}" stroke="#fff" stroke-width="2"/>
            <circle cx="12" cy="9" r="3" fill="#fff"/>
        </svg>`,
        iconSize: [24, 24],
        iconAnchor: [12, 24]
    });
}

// State
let markers = [];
const markersLayer = L.featureGroup().addTo(map);

// DOM Elements
const searchBtn = document.getElementById('search-btn');
const btnText = document.querySelector('.btn-text');
const spinner = document.getElementById('loading-spinner');
const hitCount = document.getElementById('hit-count');
const errorMsg = document.getElementById('error-message');
const sidePanel = document.getElementById('item-panel');
const closePanelBtn = document.getElementById('close-panel');
const itemDetails = document.getElementById('item-details');

// Close panel
closePanelBtn.addEventListener('click', () => {
    sidePanel.classList.remove('open');
});

// Search function
searchBtn.addEventListener('click', async () => {
    // UI Loading state
    searchBtn.disabled = true;
    btnText.textContent = "Söker...";
    spinner.classList.remove('hidden');
    errorMsg.classList.add('hidden');
    
    // Get bounding box
    const bounds = map.getBounds();
    const w = bounds.getWest();
    const s = bounds.getSouth();
    const e = bounds.getEast();
    const n = bounds.getNorth();
    
    // K-Samsök Query: Använd serviceName=kmr_lamningar för att hämta ALLT från Kulturmiljöregistret
    const queryStr = `serviceName=kmr_lamningar AND boundingBox=/WGS84"${w} ${s} ${e} ${n}"`;
    const url = `https://kulturarvsdata.se/ksamsok/api?method=search&query=${encodeURIComponent(queryStr)}&hitsPerPage=500`;
    
    try {
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if(!response.ok) throw new Error("Kunde inte hämta data från Riksantikvarieämbetet.");
        
        const data = await response.json();
        
        // Clear old markers
        markersLayer.clearLayers();
        let validHits = 0;
        
        const records = data.result.records || [];
        
        records.forEach(r => {
            const graph = r.record["@graph"];
            if(!graph) return;
            
            // Leta efter huvudobjektet (har ksam:itemClassName och URL)
            const entity = graph.find(node => node["ksam:itemClassName"] && node["ksam:url"]);
            
            if(entity) {
                // Find Context to get coordinates
                const contextRef = entity["ksam:context"];
                if(!contextRef) return;
                
                const contextObj = graph.find(node => node["@id"] === contextRef["@id"]);
                
                if(contextObj && contextObj["ksam:coordinates"]) {
                    const coordStr = contextObj["ksam:coordinates"]["@value"];
                    const match = coordStr.match(/<gml:coordinates[^>]*>([^<]+)<\/gml:coordinates>/);
                    
                    if(match) {
                        const coords = match[1].trim().split(',');
                        if(coords.length >= 2) {
                            const lon = parseFloat(coords[0]);
                            const lat = parseFloat(coords[1]);
                            
                            validHits++;
                            createMarker(lat, lon, entity, graph);
                        }
                    }
                }
            }
        });
        
        hitCount.textContent = validHits;
        
    } catch (err) {
        console.error(err);
        errorMsg.textContent = err.message;
        errorMsg.classList.remove('hidden');
    } finally {
        // Reset UI
        searchBtn.disabled = false;
        btnText.textContent = "Sök om i området";
        spinner.classList.add('hidden');
    }
});

function createMarker(lat, lon, entity, graph) {
    // Determine type for color coding
    let itemClass = "Okänd typ";
    if(entity["ksam:itemClassName"]) {
        itemClass = typeof entity["ksam:itemClassName"] === 'object' ? entity["ksam:itemClassName"]["@value"] : entity["ksam:itemClassName"];
    }
    
    const color = getMarkerColor(itemClass);
    const icon = createIcon(color);
    
    const marker = L.marker([lat, lon], { icon: icon }).addTo(markersLayer);
    
    marker.on('click', () => {
        showDetails(entity, graph, color);
    });
}

function showDetails(entity, graph, color) {
    // Extract data from JSON-LD
    
    // Type/Class
    let itemClass = "Fornlämning";
    if(entity["ksam:itemClassName"]) {
        itemClass = typeof entity["ksam:itemClassName"] === 'object' ? entity["ksam:itemClassName"]["@value"] : entity["ksam:itemClassName"];
    }
    
    // Title/Name
    let itemTitle = "Okänd fornlämning";
    if(entity["ksam:itemLabel"]) {
        itemTitle = typeof entity["ksam:itemLabel"] === 'object' ? entity["ksam:itemLabel"]["@value"] : entity["ksam:itemLabel"];
    }
    
    // Get RAA number and Descriptions by digging into graph
    let raaNumber = "Saknas";
    let descriptions = [];
    
    graph.forEach(node => {
        // Item Number (RAÄ-nummer)
        if(node["@type"] === "ksam:ItemNumber" && node["ksam:type"]) {
            const typeValue = typeof node["ksam:type"] === 'object' ? node["ksam:type"]["@value"] : node["ksam:type"];
            if (typeValue === "RAÄ-nummer" && node["ksam:number"]) {
                raaNumber = typeof node["ksam:number"] === 'object' ? node["ksam:number"]["@value"] : node["ksam:number"];
            }
        }
        
        // Item Descriptions
        if(node["@type"] === "ksam:ItemDescription" && node["ksam:desc"]) {
            const type = node["ksam:type"] ? (typeof node["ksam:type"] === 'object' ? node["ksam:type"]["@value"] : node["ksam:type"]) : "Beskrivning";
            const desc = typeof node["ksam:desc"] === 'object' ? node["ksam:desc"]["@value"] : node["ksam:desc"];
            descriptions.push({ type, desc });
        }
    });
    
    const url = entity["ksam:url"];
    
    // Build HTML
    let html = `
        <h2 class="item-title">${raaNumber !== "Saknas" ? raaNumber : itemTitle}</h2>
        <span class="item-type" style="color: ${color};">${itemClass}</span>
    `;
    
    if(descriptions.length > 0) {
        descriptions.forEach(d => {
            html += `
            <div class="detail-row">
                <div class="detail-label">${d.type}</div>
                <div class="detail-value">${d.desc}</div>
            </div>`;
        });
    } else {
        html += `
        <div class="detail-row">
            <div class="detail-label">Information</div>
            <div class="detail-value">Ingen utökad beskrivning finns tillgänglig i API:et.</div>
        </div>`;
    }
    
    if(url) {
        html += `<a href="${url}" target="_blank" class="item-link" style="color: ${color};">Visa i Riksantikvarieämbetets Fornsök &rarr;</a>`;
    }
    
    itemDetails.innerHTML = html;
    
    // Open panel (CSS transition will slide it in)
    sidePanel.classList.add('open');
}

// Update search when map stops moving (with debounce)
let moveTimeout;
map.on('moveend', () => {
    clearTimeout(moveTimeout);
    moveTimeout = setTimeout(() => {
        // Auto search feature (optional, user can still click)
        searchBtn.click();
    }, 800);
});



// --- GPS Tracking ---
const gpsBtn = document.getElementById('gps-btn');
let userMarker = null;
let isTracking = false;

gpsBtn.addEventListener('click', () => {
    if (!isTracking) {
        map.locate({setView: true, maxZoom: 16, watch: true, enableHighAccuracy: true});
        isTracking = true;
        gpsBtn.classList.add('active');
    } else {
        map.stopLocate();
        isTracking = false;
        gpsBtn.classList.remove('active');
        if (userMarker) {
            map.removeLayer(userMarker);
            userMarker = null;
        }
    }
});

map.on('locationfound', (e) => {
    if (!userMarker) {
        userMarker = L.circleMarker(e.latlng, {
            color: '#ffffff',
            fillColor: '#3b82f6',
            fillOpacity: 1,
            radius: 8,
            weight: 3,
            zIndexOffset: 1000
        }).addTo(map);
    } else {
        userMarker.setLatLng(e.latlng);
    }
});

map.on('locationerror', (e) => {
    console.warn("Platsåtkomst nekades eller misslyckades:", e.message);
    isTracking = false;
    gpsBtn.classList.remove('active');
    // Fallback: Sök på startpositionen om GPS nekas
    searchBtn.click();
});

// Starta spårning och zooma in automatiskt vid sidladdning
setTimeout(() => {
    gpsBtn.click();
}, 500);
