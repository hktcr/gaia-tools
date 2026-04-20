document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Map
    const map = L.map('map', {
        zoomControl: false 
    }).setView([56.13, 12.94], 12);

    L.control.zoom({ position: 'topright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Layers
    let maskLayer = new L.FeatureGroup().addTo(map);
    let cellsLayer = new L.FeatureGroup().addTo(map);
    let groupLayer = new L.FeatureGroup().addTo(map);

    let markerCluster = L.markerClusterGroup({
        maxClusterRadius: 50,
        iconCreateFunction: function (cluster) {
            let childCount = 0;
            cluster.getAllChildMarkers().forEach(m => {
                childCount += (m.options.nestCount || 0);
            });
            return L.divIcon({
                html: `<div class="nest-label-container cluster-label">${childCount}</div>`,
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
    let state = { grids: {}, groups: {} };

    // Zoom control state
    let currentZoomGridId = null;
    let currentZoomPolygon = null;

    function setZoomGrid(gridId, polygon) {
        currentZoomGridId = gridId || 'Grupp';
        currentZoomPolygon = polygon;
        document.getElementById('active-zoom-grid').textContent = currentZoomGridId;
        document.getElementById('grid-zoom-controls').style.display = 'flex';
    }

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

    // 2. Load GeoJSON
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
                allCells.push({
                    id: cell.properties.gridId,
                    polygon: cell
                });
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
            style: {
                fillColor: '#ffffff',
                fillOpacity: 1.0,
                color: 'transparent',
                weight: 0
            },
            interactive: false
        }).addTo(maskLayer);

        // map.fitBounds([[bbox[1], bbox[0]], [bbox[3], bbox[2]]]); 
        // fitBounds sker nu dynamiskt i slutet av renderState
    }

    // ----------------------------------------------------
    // Rendering logic (Viewer)
    // ----------------------------------------------------
    function renderState() {
        cellsLayer.clearLayers();
        groupLayer.clearLayers();
        markerCluster.clearLayers();

        let cellsByGroup = {};

        allCells.forEach(cellObj => {
            const id = cellObj.id;
            const s = state.grids[id];

            if (s && s.status === 'nest' && s.group) {
                // Collect for group rendering later
                if (!cellsByGroup[s.group]) cellsByGroup[s.group] = [];
                cellsByGroup[s.group].push(cellObj.polygon);
            } else if (s && s.status === 'recheck') {
                // Needs re-checking — orange
                L.geoJSON(cellObj.polygon, {
                    style: { fillColor: '#f59e0b', fillOpacity: 0.3, color: '#d97706', weight: 1.5, dashArray: '4,3' },
                    interactive: true
                }).on('click', () => setZoomGrid(id, cellObj.polygon)).addTo(cellsLayer);
            } else if (s && s.status === 'empty') {
                // Inventoried but 0 nests — truly invisible (disappears)
                // No rendering at all — the grid square simply doesn't appear
            } else {
                // Default uninventoried — subtle yellow
                L.geoJSON(cellObj.polygon, {
                    style: {
                        fillColor: '#FFD700',
                        fillOpacity: 0.3,
                        color: '#c2a300',
                        weight: 1,
                        className: 'grid-cell default-cell'
                    },
                    interactive: true
                }).on('click', () => setZoomGrid(id, cellObj.polygon)).addTo(cellsLayer);
            }
        });

        // Extrapolate and render groups
        for (const groupId in cellsByGroup) {
            const polys = cellsByGroup[groupId];
            const groupInfo = state.groups[groupId];
            
            if (polys.length > 0) {
                let merged = polys[0];
                for (let i = 1; i < polys.length; i++) {
                    merged = turf.union(merged, polys[i]);
                }

                // VEP Design Principle: Subtle Area Tint
                L.geoJSON(merged, {
                    style: {
                        fillColor: 'rgb(46, 204, 113)', // Grön
                        fillOpacity: 0.15, // Mycket subtil
                        color: '#27ae60', // Tunnare gräns
                        weight: 1
                    },
                    interactive: true
                }).on('click', () => setZoomGrid(null, merged)).addTo(groupLayer);

                // Text Marker
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
                    L.circleMarker(centerCoord, {radius: 2, color: '#475569', fillColor: '#475569', fillOpacity: 1, interactive: false}).addTo(groupLayer);
                }
            }
        }

        // Summary stats
        updateSummary();

        // Responsiv, optimal inzoomningsgrad baserat på aktuell skärm och data
        if (markerCluster.getLayers().length > 0) {
            map.fitBounds(markerCluster.getBounds(), { padding: [40, 40], maxZoom: 14 });
        } else if (cellsLayer.getLayers().length > 0) {
            map.fitBounds(cellsLayer.getBounds(), { padding: [40, 40], maxZoom: 13 });
        } else if (astorpPolygon) {
            const bbox = turf.bbox(astorpPolygon);
            map.fitBounds([[bbox[1], bbox[0]], [bbox[3], bbox[2]]], { padding: [20, 20] });
        }
    }

    function updateSummary() {
        let totalNests = 0;
        let nestGroupCount = 0;
        let nestGrids = 0;
        let emptyGrids = 0;
        let recheckGrids = 0;

        for (const gid in state.groups) {
            nestGroupCount++;
            const c = parseInt(state.groups[gid].count, 10);
            if (!isNaN(c)) totalNests += c;
        }
        for (const gid in state.grids) {
            const s = state.grids[gid].status;
            if (s === 'nest') nestGrids++;
            else if (s === 'empty') emptyGrids++;
            else if (s === 'recheck') recheckGrids++;
        }
        const inventoried = nestGrids + emptyGrids;
        const totalGrids = allCells.length;
        const pct = totalGrids > 0 ? ((inventoried / totalGrids) * 100).toFixed(1) : '0';

        const el = document.getElementById('summary-stats');
        if (el) {
            el.innerHTML = `
                <span class="ss-item"><strong>${totalNests}</strong> bon</span>
                <span class="ss-sep">·</span>
                <span class="ss-item"><strong>${nestGrids}</strong> rutor med bon</span>
                <span class="ss-sep">·</span>
                <span class="ss-item"><strong>${inventoried}</strong>/${totalGrids} rutor inventerade (${pct}%)</span>
                ${recheckGrids > 0 ? `<span class="ss-sep">·</span><span class="ss-item ss-recheck"><strong>${recheckGrids}</strong> kollas igen</span>` : ''}
            `;
        }
    }

    // ============================================================
    // Grid Zoom Controls
    // ============================================================
    document.getElementById('btn-zoom-fit').addEventListener('click', () => {
        if (!currentZoomPolygon) return;
        const layer = L.geoJSON(currentZoomPolygon);
        map.fitBounds(layer.getBounds(), { padding: [20, 20], maxZoom: 18 });
    });

    document.getElementById('btn-zoom-ring1').addEventListener('click', () => {
        if (!currentZoomPolygon) return;
        const centroid = turf.centroid(currentZoomPolygon);
        const buffered = turf.buffer(centroid, 0.40, { units: 'kilometers' });
        const layer = L.geoJSON(buffered);
        map.fitBounds(layer.getBounds(), { padding: [10, 10], maxZoom: 16 });
    });

    document.getElementById('btn-zoom-ring2').addEventListener('click', () => {
        if (!currentZoomPolygon) return;
        const centroid = turf.centroid(currentZoomPolygon);
        const buffered = turf.buffer(centroid, 0.65, { units: 'kilometers' });
        const layer = L.geoJSON(buffered);
        map.fitBounds(layer.getBounds(), { padding: [10, 10], maxZoom: 16 });
    });

});
