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
    let state = { grids: {}, groups: {} };

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

        const bbox = turf.bbox(innerPolygon);
        map.fitBounds([[bbox[1], bbox[0]], [bbox[3], bbox[2]]]);
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
            } else if (s && s.status === 'empty') {
                // Inventoried but 0 nests (Invisible in viewer, drawn as white)
                L.geoJSON(cellObj.polygon, {
                    style: { fillColor: '#ffffff', fillOpacity: 0.8, color: 'transparent', weight: 0 },
                    interactive: false
                }).addTo(cellsLayer);
            } else {
                // Default uninventoried
                L.geoJSON(cellObj.polygon, {
                    style: {
                        fillColor: '#FFD700', // Yellow
                        fillOpacity: 0.3,
                        color: '#c2a300',
                        weight: 1,
                        className: 'grid-cell default-cell'
                    },
                    interactive: false
                }).addTo(cellsLayer);
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
                    interactive: false
                }).addTo(groupLayer);

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
                    L.circleMarker(centerCoord, {radius: 2, color: 'red', fillColor: 'red', fillOpacity: 1, interactive: false}).addTo(groupLayer);
                }
            }
        }
    }
});
