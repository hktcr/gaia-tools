// Init map
const map = L.map('map', {
    zoomControl: false // We will add it to the bottom right
}).setView([56.08, 12.98], 10); // Center around Åstorp/Skåne as default

L.control.zoom({
    position: 'bottomright'
}).addTo(map);

// Add a premium basemap (CartoDB Positron)
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
}).addTo(map);

// Custom SVG icon for "Fornlämning" (Ruin / Monument style)
const fornlamningIcon = L.divIcon({
    className: 'fornlamning-marker',
    html: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2Z" fill="#d9480f" stroke="#fff" stroke-width="2"/>
        <circle cx="12" cy="9" r="3" fill="#fff"/>
    </svg>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24]
});

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
    
    // K-Samsök Query
    // Use text="fornlämning" to catch records, then we filter by type in JS.
    const queryStr = `text="fornlämning" AND boundingBox=/WGS84"${w} ${s} ${e} ${n}"`;
    const url = `https://kulturarvsdata.se/ksamsok/api?method=search&query=${encodeURIComponent(queryStr)}&hitsPerPage=300`;
    
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
            
            // Find main entity (must be monument)
            const entity = graph.find(node => node["ksam:itemType"]);
            
            // Allow both "monument" (Fornlämningar) and historical environments if found
            if(entity && entity["ksam:itemType"] && entity["ksam:itemType"]["@id"].includes("EntityType#monument")) {
                
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
    const marker = L.marker([lat, lon], { icon: fornlamningIcon }).addTo(markersLayer);
    
    marker.on('click', () => {
        showDetails(entity, graph);
    });
}

function showDetails(entity, graph) {
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
        if(node["@type"] === "ksam:ItemNumber" && node["ksam:type"] && node["ksam:type"]["@value"] === "RAÄ-nummer") {
            if(node["ksam:number"]) {
                raaNumber = node["ksam:number"]["@value"];
            }
        }
        
        // Item Descriptions
        if(node["@type"] === "ksam:ItemDescription" && node["ksam:desc"]) {
            const type = node["ksam:type"] ? node["ksam:type"]["@value"] : "Beskrivning";
            const desc = node["ksam:desc"]["@value"];
            descriptions.push({ type, desc });
        }
    });
    
    const url = entity["ksam:url"];
    
    // Build HTML
    let html = `
        <h2 class="item-title">${raaNumber !== "Saknas" ? raaNumber : itemTitle}</h2>
        <span class="item-type">${itemClass}</span>
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
        html += `<a href="${url}" target="_blank" class="item-link">Visa i Riksantikvarieämbetets Fornsök &rarr;</a>`;
    }
    
    itemDetails.innerHTML = html;
    
    // Open panel
    sidePanel.classList.add('open');
}

// Initial fetch
setTimeout(() => {
    searchBtn.click();
}, 500);
