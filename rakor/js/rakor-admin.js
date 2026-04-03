document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Map
    const map = L.map('map', {
        zoomControl: false 
    }).setView([56.13, 12.94], 12);

    L.control.zoom({ position: 'topright' }).addTo(map);

    // Define Tile Layers
    const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    });

    const topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)',
        maxZoom: 17
    });

    const satLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
        maxZoom: 19
    });

    // Add default
    streetLayer.addTo(map);

    // Create Layer Control
    const baseLayers = {
        "Karta (Street)": streetLayer,
        "Terräng (Topo)": topoLayer,
        "Satellit": satLayer
    };

    L.control.layers(baseLayers, null, { position: 'topleft' }).addTo(map);

    // Layers
    let maskLayer = new L.FeatureGroup().addTo(map);
    let cellsLayer = new L.FeatureGroup().addTo(map);
    let groupLayer = new L.FeatureGroup().addTo(map);
    let highlightLayer = new L.FeatureGroup().addTo(map);
    let labelsLayer = new L.FeatureGroup(); // Added but not to map initially

    let markerCluster = L.markerClusterGroup({
        maxClusterRadius: 50,
        iconCreateFunction: function (cluster) {
            let childCount = 0;
            cluster.getAllChildMarkers().forEach(m => {
                childCount += (m.options.nestCount || 0);
            });
            return L.divIcon({
                html: `<div class="nest-label-container cluster-label" style="background:#d35400;border-color:#e67e22;">${childCount}</div>`,
                className: 'nest-label-icon cluster-icon',
                iconSize: [36, 36],
                iconAnchor: [18, 18]
            });
        }
    });
    map.addLayer(markerCluster);

    // State
    let astorpPolygon = null;
    let allCells = []; // Array of { id, polygon }
    let selectedCellIds = new Set();
    let state = { grids: {}, groups: {} };
    let sessionAdditions = []; // Ny tracking för kopiera-funktion

    // Load state from the centralized Database JSON
    function loadState() {
        return fetch(dbUrl + '?t=' + new Date().getTime(), { cache: "no-store" })
            .then(res => {
                if(!res.ok) return {};
                return res.json();
            })
            .then(dbData => {
                state = { grids: {}, groups: {} };
                if (dbData && dbData.groups) {
                    state = dbData;
                }
            })
            .catch(err => console.warn("Kunde inte ladda databas: ", err));
    }

    // Export function
    function getExportState() {
        return state;
    }

    // 2. Load GeoJSONs
    Promise.all([
        fetch(geojsonUrl).then(res => res.json()),
        fetch(gridUrl).then(res => res.json())
    ]).then(([borderData, gridData]) => {
        if (borderData.features && borderData.features.length > 0) {
            astorpPolygon = borderData.features[0]; 
            drawMask(astorpPolygon);
        }
        
        if (gridData.features && gridData.features.length > 0) {
            gridData.features.forEach(cell => {
                const id = cell.properties.gridId;
                allCells.push({ id: id, polygon: cell });

                // Add invisible label marker for Grid IDs
                const center = turf.centroid(cell).geometry.coordinates;
                const icon = L.divIcon({
                    className: 'grid-id-label',
                    html: id,
                    iconSize: [40, 20],
                    iconAnchor: [20, 10]
                });
                L.marker([center[1], center[0]], { icon: icon, interactive: false }).addTo(labelsLayer);
            });
        }
        
        loadState().then(() => {
            renderState();
        });
    }).catch(err => alert("Error loading map data: " + err));

    // ----------------------------------------------------
    // Mask logic
    // ----------------------------------------------------
    function drawMask(innerPolygon) {
        const outerCoords = [
            [[-90, -180], [90, -180], [90, 180], [-90, 180], [-90, -180]]
        ];

        let holes = innerPolygon.geometry.coordinates;
        if (innerPolygon.geometry.type === 'MultiPolygon') {
             holes = innerPolygon.geometry.coordinates[0];
        }

        const invertedPoly = turf.polygon([...outerCoords, ...holes]);

        L.geoJSON(invertedPoly, {
            style: { fillColor: '#ffffff', fillOpacity: 1.0, color: 'transparent', weight: 0 },
            interactive: false
        }).addTo(maskLayer);

        const bbox = turf.bbox(innerPolygon);
        map.fitBounds([[bbox[1], bbox[0]], [bbox[3], bbox[2]]]);
    }

    // ----------------------------------------------------
    // Rendering logic
    // ----------------------------------------------------
    function getCellDefaultStyle(id) {
        return {
            fillColor: '#FFD700', // Yellow
            fillOpacity: 0.3,
            color: '#c2a300',
            weight: 1,
            className: 'grid-cell default-cell'
        };
    }

    function renderState() {
        cellsLayer.clearLayers();
        groupLayer.clearLayers();
        markerCluster.clearLayers();

        let cellsByGroup = {};

        allCells.forEach(cellObj => {
            const id = cellObj.id;
            const s = state.grids[id];

            if (s && s.status === 'nest' && s.group) {
                if (!cellsByGroup[s.group]) cellsByGroup[s.group] = [];
                cellsByGroup[s.group].push(cellObj.polygon);
            } else if (s && s.status === 'empty') {
                let layer = L.geoJSON(cellObj.polygon, {
                    style: { fillColor: '#ffffff', fillOpacity: 0.8, color: 'transparent', weight: 0 },
                    interactive: true
                }).addTo(cellsLayer);
                layer.on('click', () => toggleSelection(id));
            } else {
                let layer = L.geoJSON(cellObj.polygon, {
                    style: getCellDefaultStyle(id),
                    interactive: true
                }).addTo(cellsLayer);
                layer.on('click', () => toggleSelection(id));
            }
        });

        for (const groupId in cellsByGroup) {
            const polys = cellsByGroup[groupId];
            const groupInfo = state.groups[groupId];
            
            if (polys.length > 0) {
                let merged = polys[0];
                for (let i = 1; i < polys.length; i++) {
                    merged = turf.union(merged, polys[i]);
                }

                let groupGeo = L.geoJSON(merged, {
                    style: {
                        fillColor: 'rgb(46, 204, 113)',
                        fillOpacity: 0.15,
                        color: '#27ae60',
                        weight: 1
                    },
                    interactive: true
                }).addTo(groupLayer);

                groupGeo.on('click', () => {
                    polys.forEach(p => toggleSelection(p.properties.gridId, true));
                });

                let centerCoord = [turf.centroid(merged).geometry.coordinates[1], turf.centroid(merged).geometry.coordinates[0]];
                if (groupInfo && groupInfo.coordinate) {
                    try {
                        let parts = groupInfo.coordinate.split(',');
                        if (parts.length === 2 && !isNaN(parseFloat(parts[0])) && !isNaN(parseFloat(parts[1]))) {
                            centerCoord = [parseFloat(parts[0]), parseFloat(parts[1])];
                        }
                    } catch(e) {}
                }

                const count = groupInfo ? groupInfo.count : "?";
                const parsedCount = parseInt(count, 10) || 0;
                
                const icon = L.divIcon({
                    className: 'nest-label-icon',
                    html: `<div class="nest-label-container" title="${groupInfo.date || ''}">${count}</div>`,
                    iconSize: [30, 30],
                    iconAnchor: [15, 15]
                });

                let m = L.marker(centerCoord, { 
                    icon: icon, 
                    interactive: false,
                    nestCount: parsedCount 
                });
                markerCluster.addLayer(m);
                
                if (groupInfo && groupInfo.coordinate) {
                    L.circleMarker(centerCoord, {radius: 2, color: 'red', fillColor: 'red', fillOpacity: 1, interactive: false}).addTo(groupLayer);
                }
            }
        }
        
        renderHighlights();
    }

    // ----------------------------------------------------
    // User Interaction Logic
    // ----------------------------------------------------
    function toggleSelection(id, forceSelect = false) {
        if (selectedCellIds.has(id) && !forceSelect) {
            selectedCellIds.delete(id);
        } else {
            selectedCellIds.add(id);
        }
        updateUI();
        renderHighlights();
    }

    function renderHighlights() {
        highlightLayer.clearLayers();
        allCells.forEach(cellObj => {
            if (selectedCellIds.has(cellObj.id)) {
                L.geoJSON(cellObj.polygon, {
                    style: {
                        fillColor: '#3498db',
                        fillOpacity: 0.6,
                        color: '#2980b9',
                        weight: 2
                    },
                    interactive: false
                }).addTo(highlightLayer);
            }
        });
    }

    function updateUI() {
        const countSpan = document.getElementById('selected-count');
        const listDiv = document.getElementById('selected-list');
        const saveBtn = document.getElementById('btn-save-nests');
        const clearSelBtn = document.getElementById('btn-clear-selection');

        countSpan.innerText = selectedCellIds.size;
        
        let ids = Array.from(selectedCellIds).sort();
        listDiv.innerText = ids.join(", ") || "Inga markerade";

        const hasSelection = selectedCellIds.size > 0;
        saveBtn.disabled = !hasSelection;
        clearSelBtn.disabled = !hasSelection;

        // Statistics
        let totalCount = 0;
        let groupCount = 0;
        for (const k in state.groups) {
            groupCount++;
            let c = parseInt(state.groups[k].count, 10);
            if (!isNaN(c)) totalCount += c;
        }
        
        const elBon = document.getElementById('stat-bon');
        const elKolonier = document.getElementById('stat-kolonier');
        if(elBon) elBon.innerText = totalCount;
        if(elKolonier) elKolonier.innerText = groupCount;
    }

    document.getElementById('btn-clear-selection').addEventListener('click', () => {
        selectedCellIds.clear();
        updateUI();
        renderHighlights();
    });

    document.getElementById('btn-save-nests').addEventListener('click', () => {
        if (selectedCellIds.size === 0) return;

        const count = parseInt(document.getElementById('nest-count').value, 10);
        const coord = document.getElementById('nest-coord').value.trim();
        const obsDate = document.getElementById('nest-date').value.trim();
        
        selectedCellIds.forEach(id => {
            const existing = state.grids[id];
            if (existing && existing.group) {
                let cellsInGroup = 0;
                for (const k in state.grids) {
                    if (state.grids[k].group === existing.group) cellsInGroup++;
                }
                if (cellsInGroup <= 1) { 
                    delete state.groups[existing.group];
                }
            }
        });

        if (count === 0) {
            selectedCellIds.forEach(id => {
                state.grids[id] = { status: 'empty' };
            });
            sessionAdditions.push({
                date: obsDate,
                count: 0,
                coord: "",
                grids: Array.from(selectedCellIds).sort()
            });
        } else {
            const groupId = 'obs_' + (obsDate || 'nodate') + '_' + Math.floor(Math.random() * 10000);
            
            state.groups[groupId] = { count: count };
            if (coord) state.groups[groupId].coordinate = coord;
            if (obsDate) state.groups[groupId].date = obsDate;
            
            selectedCellIds.forEach(id => {
                state.grids[id] = { status: 'nest', group: groupId };
            });

            sessionAdditions.push({
                date: obsDate,
                count: count,
                coord: coord,
                grids: Array.from(selectedCellIds).sort()
            });
        }

        selectedCellIds.clear();
        document.getElementById('nest-count').value = "0";
        document.getElementById('nest-coord').value = "";
        updateUI();
        renderState();
    });

    document.getElementById('btn-export-image').addEventListener('click', () => {
        document.body.classList.add('export-mode');
        setTimeout(() => {
            html2canvas(document.getElementById('map'), {
                useCORS: true,
                allowTaint: false,
                backgroundColor: "#ffffff"
            }).then(canvas => {
                document.body.classList.remove('export-mode');
                
                const link = document.createElement('a');
                link.download = `rakor-astorp-${new Date().toISOString().split('T')[0]}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
            }).catch(err => {
                document.body.classList.remove('export-mode');
                alert("Misslyckades att skapa bild: " + err);
            });
        }, 100);
    });

    document.getElementById('btn-copy-session').addEventListener('click', () => {
        if (sessionAdditions.length === 0) {
            alert("Du har inte sparat några ändringar i denna session än.");
            return;
        }

        let txt = "RÅKOINVENTERING SESSION:\n";
        sessionAdditions.forEach(item => {
            const dateStr = item.date || "Inget datum";
            const gridStr = item.grids.join(", ");
            if (item.count === 0) {
                txt += `- Datum: ${dateStr}, Antal bon: 0 (Tomt), Rutor: ${gridStr}\n`;
            } else {
                const coordStr = item.coord ? `, Pkt: ${item.coord}` : "";
                txt += `- Datum: ${dateStr}, Antal bon: ${item.count}${coordStr}, Rutor: ${gridStr}\n`;
            }
        });

        navigator.clipboard.writeText(txt).then(() => {
            alert("Grymt! Datan är kopierad. Klistra nu in detta direkt till gAIa i chatten!");
        }).catch(err => {
            alert("Kunde inte kopiera: " + err);
        });
    });

    document.getElementById('toggle-grid-ids').addEventListener('change', (e) => {
        if (e.target.checked) {
            map.addLayer(labelsLayer);
        } else {
            map.removeLayer(labelsLayer);
        }
    });

    document.getElementById('nest-coord').addEventListener('input', (e) => {
        const val = e.target.value.trim();
        // Remove commas and split by spaces
        const parts = val.replace(/,/g, ' ').split(/\s+/);
        if (parts.length >= 2) {
            const lat = parseFloat(parts[0]);
            const lng = parseFloat(parts[1]);
            // Skåne bounding box validation
            if (!isNaN(lat) && !isNaN(lng) && lat > 55 && lat < 57 && lng > 12 && lng < 14) {
                map.flyTo([lat, lng], 16, { animate: true, duration: 1.0 });
            }
        }
    });

    updateUI();
});
