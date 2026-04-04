document.addEventListener('DOMContentLoaded', () => {
    // ============================================================
    // 1. Initialize Map
    // ============================================================
    const map = L.map('map', { zoomControl: false }).setView([56.13, 12.94], 12);
    L.control.zoom({ position: 'topright' }).addTo(map);

    const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    });
    const topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)',
        maxZoom: 17
    });
    const satLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri',
        maxZoom: 19
    });
    streetLayer.addTo(map);
    L.control.layers({
        "Karta (Street)": streetLayer,
        "Terräng (Topo)": topoLayer,
        "Satellit": satLayer
    }, null, { position: 'topleft' }).addTo(map);

    // ============================================================
    // 2. Layers
    // ============================================================
    let maskLayer = new L.FeatureGroup().addTo(map);
    let cellsLayer = new L.FeatureGroup().addTo(map);
    let groupLayer = new L.FeatureGroup().addTo(map);
    let highlightLayer = new L.FeatureGroup().addTo(map);
    let fieldPointsLayer = new L.FeatureGroup().addTo(map);
    let labelsLayer = new L.FeatureGroup();

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

    // ============================================================
    // 3. State
    // ============================================================
    let astorpPolygon = null;
    let allCells = [];
    let state = { grids: {}, groups: {} };

    // Field-data-first state
    let fieldPoints = [];           // Array of { id, lat, lng, count, color, selected }
    let activePointId = null;       // Which point is being assigned grids
    let pointAssignments = {};      // { pointId: Set<gridId> }
    let rawFieldText = "";          // Original text from field notes
    let nextPointId = 1;
    let emptyGrids = new Set();     // Grid cells marked as surveyed-empty
    let emptyMode = false;          // Toggle for marking empty grids

    // Action log — captures every operation for the chronicle
    let actionLog = [];
    function logAction(type, detail) {
        actionLog.push({
            time: new Date().toISOString().substr(11, 8),
            type,
            detail
        });
    }

    // Color palette for field points
    const pointColors = [
        '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
        '#1abc9c', '#e67e22', '#34495e', '#16a085', '#c0392b',
        '#2980b9', '#27ae60', '#f1c40f', '#8e44ad', '#d35400'
    ];

    // ============================================================
    // 4. Load GeoJSON + Database
    // ============================================================
    function loadState() {
        return fetch(dbUrl + '?t=' + new Date().getTime(), { cache: "no-store" })
            .then(res => { if (!res.ok) return {}; return res.json(); })
            .then(dbData => {
                state = { grids: {}, groups: {} };
                if (dbData && dbData.groups) state = dbData;
            })
            .catch(err => console.warn("Kunde inte ladda databas: ", err));
    }

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
                allCells.push({ id, polygon: cell });
                const center = turf.centroid(cell).geometry.coordinates;
                const icon = L.divIcon({
                    className: 'grid-id-label',
                    html: id,
                    iconSize: [40, 20],
                    iconAnchor: [20, 10]
                });
                L.marker([center[1], center[0]], { icon, interactive: false }).addTo(labelsLayer);
            });
        }
        loadState().then(() => {
            renderState();
            updateStats();
        });
    }).catch(err => alert("Error loading map data: " + err));

    // Set default date to today
    const dateInput = document.getElementById('session-date');
    dateInput.value = new Date().toISOString().split('T')[0];

    // ============================================================
    // 5. Mask
    // ============================================================
    function drawMask(innerPolygon) {
        const outerCoords = [[[-90, -180], [90, -180], [90, 180], [-90, 180], [-90, -180]]];
        let holes = innerPolygon.geometry.coordinates;
        if (innerPolygon.geometry.type === 'MultiPolygon') holes = innerPolygon.geometry.coordinates[0];
        const invertedPoly = turf.polygon([...outerCoords, ...holes]);
        L.geoJSON(invertedPoly, {
            style: { fillColor: '#ffffff', fillOpacity: 1.0, color: 'transparent', weight: 0 },
            interactive: false
        }).addTo(maskLayer);
        const bbox = turf.bbox(innerPolygon);
        map.fitBounds([[bbox[1], bbox[0]], [bbox[3], bbox[2]]]);
    }

    // ============================================================
    // 6. Render existing database state (green groups)
    // ============================================================
    function renderState() {
        cellsLayer.clearLayers();
        groupLayer.clearLayers();
        markerCluster.clearLayers();

        let cellsByGroup = {};

        // Determine which cells are assigned to field points (in this session)
        const sessionAssignedCells = new Set();
        for (const pid in pointAssignments) {
            pointAssignments[pid].forEach(gid => sessionAssignedCells.add(gid));
        }

        allCells.forEach(cellObj => {
            const id = cellObj.id;
            const s = state.grids[id];

            // Skip cells that are currently assigned in this session
            if (sessionAssignedCells.has(id)) return;

            if (s && s.status === 'nest' && s.group) {
                if (!cellsByGroup[s.group]) cellsByGroup[s.group] = [];
                cellsByGroup[s.group].push(cellObj.polygon);
            } else if (s && s.status === 'empty') {
                let layer = L.geoJSON(cellObj.polygon, {
                    style: { fillColor: '#ffffff', fillOpacity: 0.8, color: 'transparent', weight: 0 },
                    interactive: true
                }).addTo(cellsLayer);
                layer.on('click', () => handleCellClick(id));
            } else {
                let layer = L.geoJSON(cellObj.polygon, {
                    style: { fillColor: '#FFD700', fillOpacity: 0.3, color: '#c2a300', weight: 1 },
                    interactive: true
                }).addTo(cellsLayer);
                layer.on('click', () => handleCellClick(id));
            }
        });

        for (const groupId in cellsByGroup) {
            const polys = cellsByGroup[groupId];
            const groupInfo = state.groups[groupId];
            if (polys.length > 0) {
                let merged = polys[0];
                for (let i = 1; i < polys.length; i++) merged = turf.union(merged, polys[i]);

                L.geoJSON(merged, {
                    style: { fillColor: 'rgb(46, 204, 113)', fillOpacity: 0.15, color: '#27ae60', weight: 1 },
                    interactive: false
                }).addTo(groupLayer);

                let centerCoord = [turf.centroid(merged).geometry.coordinates[1], turf.centroid(merged).geometry.coordinates[0]];
                if (groupInfo && groupInfo.coordinate) {
                    try {
                        let parts = groupInfo.coordinate.split(',');
                        if (parts.length === 2 && !isNaN(parseFloat(parts[0])) && !isNaN(parseFloat(parts[1]))) {
                            centerCoord = [parseFloat(parts[0]), parseFloat(parts[1])];
                        }
                    } catch (e) {}
                }

                const count = groupInfo ? groupInfo.count : "?";
                const parsedCount = parseInt(count, 10) || 0;
                const icon = L.divIcon({
                    className: 'nest-label-icon',
                    html: `<div class="nest-label-container" title="${groupInfo ? groupInfo.date || '' : ''}">${count}</div>`,
                    iconSize: [30, 30],
                    iconAnchor: [15, 15]
                });
                let m = L.marker(centerCoord, { icon, interactive: false, nestCount: parsedCount });
                markerCluster.addLayer(m);

                if (groupInfo && groupInfo.coordinate) {
                    L.circleMarker(centerCoord, { radius: 2, color: 'red', fillColor: 'red', fillOpacity: 1, interactive: false }).addTo(groupLayer);
                }
            }
        }

        renderFieldAssignments();
    }

    // ============================================================
    // 7. Field Data First: Parse & Load
    // ============================================================
    function parseFieldData(text) {
        const lines = text.trim().split('\n');
        const points = [];
        lines.forEach((line, i) => {
            line = line.trim();
            if (!line || line.startsWith('#') || line.startsWith('//')) return;

            // Support: "lat, lng, count" or "lat lng count" or tab-separated
            const parts = line.replace(/,/g, ' ').replace(/\t/g, ' ').split(/\s+/);
            if (parts.length >= 3) {
                const lat = parseFloat(parts[0]);
                const lng = parseFloat(parts[1]);
                const count = parseInt(parts[2], 10);
                if (!isNaN(lat) && !isNaN(lng) && !isNaN(count) &&
                    lat > 55 && lat < 57 && lng > 12 && lng < 14) {
                    points.push({
                        id: 'fp_' + nextPointId++,
                        lat, lng, count,
                        color: pointColors[(points.length) % pointColors.length],
                        selected: false  // FIX #1: multiselect state
                    });
                }
            }
        });
        return points;
    }

    document.getElementById('btn-load-field').addEventListener('click', () => {
        const textarea = document.getElementById('field-textarea');
        const text = textarea.value.trim();
        if (!text) {
            alert("Skriv in fältdata först (lat, lng, antal — en rad per punkt).");
            return;
        }

        rawFieldText = text;
        const parsed = parseFieldData(text);
        if (parsed.length === 0) {
            alert("Kunde inte tolka någon giltig fältdata. Format: lat, lng, antal (en rad per punkt).");
            return;
        }

        // Add to field points (keep existing ones)
        parsed.forEach(p => {
            fieldPoints.push(p);
            pointAssignments[p.id] = new Set();
        });

        // LOG: field data loaded
        const totalLoaded = parsed.reduce((s, p) => s + p.count, 0);
        logAction('LADDNING', `${parsed.length} punkter laddade (${totalLoaded} bon). Koordinater: ${parsed.map(p => `${p.lat},${p.lng}=${p.count}`).join('; ')}`);

        // Switch to assignment phase
        document.getElementById('phase-input').classList.remove('active');
        document.getElementById('phase-input').classList.add('done');
        document.getElementById('phase-assign').classList.add('active');
        document.getElementById('merge-bar').style.display = 'flex';

        renderFieldPoints();
        renderPointList();
        updateStats();

        // Zoom to show all field points
        if (fieldPoints.length > 0) {
            const lats = fieldPoints.map(p => p.lat);
            const lngs = fieldPoints.map(p => p.lng);
            map.fitBounds([
                [Math.min(...lats) - 0.005, Math.min(...lngs) - 0.01],
                [Math.max(...lats) + 0.005, Math.max(...lngs) + 0.01]
            ]);
        }

        // Auto-activate first point
        if (parsed.length > 0) {
            activatePoint(parsed[0].id);
        }
    });

    // ============================================================
    // 8. Render field points on map
    // ============================================================
    function renderFieldPoints() {
        fieldPointsLayer.clearLayers();

        fieldPoints.forEach((pt, i) => {
            const isActive = pt.id === activePointId;
            const num = i + 1;

            const icon = L.divIcon({
                className: 'field-point-icon',
                html: `<div style="
                    width: ${isActive ? 32 : 26}px; 
                    height: ${isActive ? 32 : 26}px; 
                    border-radius: 50%; 
                    background: ${pt.color}; 
                    color: #fff; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    font-size: ${isActive ? 14 : 12}px; 
                    font-weight: 700; 
                    border: ${isActive ? '3px solid #fff' : '2px solid rgba(255,255,255,0.7)'}; 
                    box-shadow: ${isActive ? '0 0 12px ' + pt.color + ', 0 0 24px rgba(0,0,0,0.3)' : '0 2px 6px rgba(0,0,0,0.3)'}; 
                    cursor: pointer;
                    transition: all 0.2s ease;
                    ${isActive ? 'animation: pulse-point 1.5s ease-in-out infinite;' : ''}
                ">${num}</div>`,
                iconSize: [isActive ? 32 : 26, isActive ? 32 : 26],
                iconAnchor: [isActive ? 16 : 13, isActive ? 16 : 13]
            });

            const marker = L.marker([pt.lat, pt.lng], { icon, interactive: true, zIndexOffset: isActive ? 1000 : 0 });
            marker.on('click', () => activatePoint(pt.id));

            // Add count label below
            if (pt.count > 0) {
                const countIcon = L.divIcon({
                    className: 'field-count-label',
                    html: `<div style="
                        background: rgba(0,0,0,0.75); 
                        color: #fff; 
                        padding: 1px 5px; 
                        border-radius: 4px; 
                        font-size: 10px; 
                        font-weight: 600;
                        white-space: nowrap;
                    ">${pt.count} bon</div>`,
                    iconSize: [50, 16],
                    iconAnchor: [25, -6]
                });
                L.marker([pt.lat, pt.lng], { icon: countIcon, interactive: false }).addTo(fieldPointsLayer);
            }

            marker.addTo(fieldPointsLayer);

            // Show original positions for merged points
            if (pt.mergedFrom && pt.mergedFrom.length > 1 && isActive) {
                pt.mergedFrom.forEach((orig, oi) => {
                    // Small ghost marker at original position
                    const ghostIcon = L.divIcon({
                        className: 'ghost-point',
                        html: `<div style="
                            width: 12px; height: 12px; border-radius: 50%;
                            background: ${pt.color}; opacity: 0.5;
                            border: 1px solid rgba(255,255,255,0.8);
                            display: flex; align-items: center; justify-content: center;
                            font-size: 8px; color: #fff; font-weight: 700;
                        ">${orig.count}</div>`,
                        iconSize: [12, 12], iconAnchor: [6, 6]
                    });
                    L.marker([orig.lat, orig.lng], { icon: ghostIcon, interactive: false }).addTo(fieldPointsLayer);

                    // Dashed line from original to centroid
                    L.polyline([[orig.lat, orig.lng], [pt.lat, pt.lng]], {
                        color: pt.color, weight: 1, opacity: 0.4, dashArray: '4,4', interactive: false
                    }).addTo(fieldPointsLayer);
                });
            }
        });

        // Add CSS animation if not already present
        if (!document.getElementById('pulse-style')) {
            const style = document.createElement('style');
            style.id = 'pulse-style';
            style.textContent = `
                @keyframes pulse-point {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.15); }
                }
            `;
            document.head.appendChild(style);
        }
    }

    // ============================================================
    // 9. Render field assignments (colored grid cells)
    // ============================================================
    function renderFieldAssignments() {
        highlightLayer.clearLayers();

        for (const pid in pointAssignments) {
            const pt = fieldPoints.find(p => p.id === pid);
            if (!pt) continue;

            pointAssignments[pid].forEach(gridId => {
                const cellObj = allCells.find(c => c.id === gridId);
                if (!cellObj) return;

                L.geoJSON(cellObj.polygon, {
                    style: {
                        fillColor: pt.color,
                        fillOpacity: pid === activePointId ? 0.45 : 0.25,
                        color: pt.color,
                        weight: pid === activePointId ? 2 : 1
                    },
                    interactive: true
                }).on('click', () => handleCellClick(gridId))
                  .addTo(highlightLayer);
            });
        }

        // Render empty (surveyed) grids with gray diagonal pattern
        emptyGrids.forEach(gridId => {
            const cellObj = allCells.find(c => c.id === gridId);
            if (!cellObj) return;

            L.geoJSON(cellObj.polygon, {
                style: {
                    fillColor: '#95a5a6',
                    fillOpacity: 0.35,
                    color: '#7f8c8d',
                    weight: 2,
                    dashArray: '6,3'
                },
                interactive: true
            }).on('click', () => handleCellClick(gridId))
              .addTo(highlightLayer);
        });
    }

    // ============================================================
    // 10. Point activation & cell clicks
    // ============================================================
    function activatePoint(pointId) {
        activePointId = pointId;
        renderFieldPoints();
        renderPointList();
        renderState();

        const pt = fieldPoints.find(p => p.id === pointId);
        if (pt) {
            map.flyTo([pt.lat, pt.lng], 15, { animate: true, duration: 0.8 });
        }
    }

    function handleCellClick(gridId) {
        // Empty mode: toggle grid as surveyed-empty
        if (emptyMode) {
            // Remove from any point assignment first
            for (const pid in pointAssignments) {
                pointAssignments[pid].delete(gridId);
            }
            if (emptyGrids.has(gridId)) {
                emptyGrids.delete(gridId);
                logAction('TOM_BORTTAGEN', `Ruta ${gridId} avmarkerad som tom`);
            } else {
                emptyGrids.add(gridId);
                logAction('TOM_MARKERAD', `Ruta ${gridId} markerad som inventerad-tom`);
            }
            renderState();
            renderPointList();
            return;
        }

        if (!activePointId) return;

        const assignments = pointAssignments[activePointId];
        if (!assignments) return;

        // Remove from empty set if it was there
        emptyGrids.delete(gridId);

        // Check if this cell is assigned to another point
        for (const pid in pointAssignments) {
            if (pid !== activePointId && pointAssignments[pid].has(gridId)) {
                pointAssignments[pid].delete(gridId);
                break;
            }
        }

        // Toggle assignment for active point
        if (assignments.has(gridId)) {
            assignments.delete(gridId);
            const pt = fieldPoints.find(p => p.id === activePointId);
            logAction('RUTA_BORTTAGEN', `Ruta ${gridId} borttagen från punkt #${fieldPoints.indexOf(pt) + 1}`);
        } else {
            assignments.add(gridId);
            const pt = fieldPoints.find(p => p.id === activePointId);
            logAction('RUTA_TILLDELAD', `Ruta ${gridId} tilldelad punkt #${fieldPoints.indexOf(pt) + 1} (${pt.count} bon)`);
        }

        renderState();
        renderPointList();
    }

    // ============================================================
    // 11. Point list panel (FIX #1: checkboxes, FIX #2: delete)
    // ============================================================
    function renderPointList() {
        const list = document.getElementById('point-list');

        if (fieldPoints.length === 0) {
            list.innerHTML = '<li style="color: #aaa; font-style: italic;">Ingen fältdata laddad</li>';
            updateMergeButton();
            return;
        }

        list.innerHTML = '';
        fieldPoints.forEach((pt, i) => {
            const li = document.createElement('li');
            li.className = pt.id === activePointId ? 'active-point' : '';

            const assignedGrids = pointAssignments[pt.id] ? Array.from(pointAssignments[pt.id]).sort() : [];
            const gridText = assignedGrids.length > 0 
                ? (assignedGrids.length <= 4 ? assignedGrids.join(', ') : assignedGrids.length + ' rutor') 
                : 'inga rutor';
            const statusIcon = assignedGrids.length > 0 ? '✅' : '⬜';

            // FIX #1: Checkbox for multiselect (merge)
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = pt.selected || false;
            checkbox.style.cssText = 'margin-right: 4px; cursor: pointer; flex-shrink: 0;';
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
                pt.selected = checkbox.checked;
                updateMergeButton();
            });

            const badge = document.createElement('span');
            badge.className = 'point-badge';
            badge.style.background = pt.color;
            badge.textContent = i + 1;

            const info = document.createElement('span');
            info.className = 'point-info';
            if (pt.mergedFrom && pt.mergedFrom.length > 1) {
                const parts = pt.mergedFrom.map(m => m.count).join('+');
                info.innerHTML = `⭐ <b>${pt.count} bon</b> <span style="font-size:0.75em;color:#888;">(${parts})</span>`;
            } else {
                info.textContent = `${statusIcon} ${pt.count > 0 ? pt.count + ' bon' : 'Tomt'}`;
            }

            const grids = document.createElement('span');
            grids.className = 'point-grids';
            grids.textContent = gridText;

            // FIX #2: Delete button
            const deleteBtn = document.createElement('span');
            deleteBtn.textContent = '✕';
            deleteBtn.title = 'Radera punkt';
            deleteBtn.style.cssText = 'cursor: pointer; color: #ccc; font-size: 14px; font-weight: 700; padding: 0 2px; flex-shrink: 0; transition: color 0.15s;';
            deleteBtn.addEventListener('mouseenter', () => deleteBtn.style.color = '#e74c3c');
            deleteBtn.addEventListener('mouseleave', () => deleteBtn.style.color = '#ccc');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deletePoint(pt.id);
            });

            li.appendChild(checkbox);
            li.appendChild(badge);
            li.appendChild(info);
            li.appendChild(grids);
            li.appendChild(deleteBtn);

            li.addEventListener('click', () => activatePoint(pt.id));
            list.appendChild(li);
        });

        updateMergeButton();
    }

    // ============================================================
    // 11b. FIX #2: Delete point
    // ============================================================
    function deletePoint(pointId) {
        const pt = fieldPoints.find(p => p.id === pointId);
        if (!pt) return;

        const num = fieldPoints.indexOf(pt) + 1;
        if (!confirm(`Radera punkt #${num} (${pt.count} bon)?`)) return;

        // LOG: deletion
        logAction('RADERING', `Punkt #${num} raderad (${pt.count} bon vid ${pt.lat}, ${pt.lng})`);

        // Remove from field points
        const idx = fieldPoints.indexOf(pt);
        if (idx > -1) fieldPoints.splice(idx, 1);

        // Remove assignments
        delete pointAssignments[pointId];

        // If active point was deleted, activate first remaining or clear
        if (activePointId === pointId) {
            activePointId = fieldPoints.length > 0 ? fieldPoints[0].id : null;
        }

        renderFieldPoints();
        renderPointList();
        renderState();
        updateStats();
    }

    // ============================================================
    // 12. Merge points (FIX #1: selective merge via checkboxes)
    // ============================================================
    function updateMergeButton() {
        const btn = document.getElementById('btn-merge');
        const selectedCount = fieldPoints.filter(p => p.selected).length;
        btn.disabled = selectedCount < 2;
        btn.textContent = selectedCount >= 2 
            ? `Slå ihop ${selectedCount} valda` 
            : 'Slå ihop valda';
    }

    document.getElementById('btn-merge').addEventListener('click', () => {
        const toMerge = fieldPoints.filter(p => p.selected);
        if (toMerge.length < 2) {
            alert("Markera minst 2 punkter med checkboxarna för att slå ihop.");
            return;
        }

        const totalCount = toMerge.reduce((sum, p) => sum + p.count, 0);
        const mergeNames = toMerge.map(p => `#${fieldPoints.indexOf(p) + 1} (${p.count} bon)`).join(' + ');
        
        // Collect all grids from all points being merged
        let totalGrids = new Set();
        toMerge.forEach(p => {
            if (pointAssignments[p.id]) {
                pointAssignments[p.id].forEach(gid => totalGrids.add(gid));
            }
        });

        const newCount = prompt(
            `Slå ihop ${toMerge.length} punkter?\n\n` +
            `${mergeNames}\n` +
            `Summerat: ${totalCount} bon\n` +
            `Sammanlagda rutor: ${totalGrids.size > 0 ? totalGrids.size + ' st' : 'inga'}\n\n` +
            `Redigera antal bon vid behov:`, 
            totalCount
        );
        if (newCount === null) return;

        const parsedCount = parseInt(newCount, 10);
        if (isNaN(parsedCount)) return;

        // Merge into first selected point
        const target = toMerge[0];
        target.count = parsedCount;
        target.selected = false;

        // Track merge history
        if (!target.mergedFrom) target.mergedFrom = [{ count: toMerge[0].count, lat: toMerge[0].lat, lng: toMerge[0].lng }];
        for (let i = 1; i < toMerge.length; i++) {
            if (toMerge[i].mergedFrom) {
                target.mergedFrom.push(...toMerge[i].mergedFrom);
            } else {
                target.mergedFrom.push({ count: toMerge[i].count, lat: toMerge[i].lat, lng: toMerge[i].lng });
            }
        }

        // Calculate centroid of all merged coordinates
        const centerLat = toMerge.reduce((s, p) => s + p.lat, 0) / toMerge.length;
        const centerLng = toMerge.reduce((s, p) => s + p.lng, 0) / toMerge.length;
        target.lat = centerLat;
        target.lng = centerLng;

        // LOG: merge
        logAction('SAMMANSLAGNING', `Punkter ${mergeNames} → ${parsedCount} bon vid ${centerLat.toFixed(5)}, ${centerLng.toFixed(5)}. Ärvda rutor: ${totalGrids.size > 0 ? Array.from(totalGrids).sort().join(', ') : 'inga'}`);

        // Merge grid assignments — collect ALL grids into target
        for (let i = 1; i < toMerge.length; i++) {
            const src = toMerge[i];
            if (pointAssignments[src.id]) {
                pointAssignments[src.id].forEach(gid => pointAssignments[target.id].add(gid));
                delete pointAssignments[src.id];
            }
            const idx = fieldPoints.indexOf(src);
            if (idx > -1) fieldPoints.splice(idx, 1);
        }

        activePointId = target.id;
        renderFieldPoints();
        renderPointList();
        renderState();
        updateStats();

        // Fly to the merged point and zoom to show all assigned grids
        const mergedGrids = pointAssignments[target.id];
        if (mergedGrids && mergedGrids.size > 0) {
            // Build bounds from all assigned grid cells + the point
            const bounds = L.latLngBounds([[target.lat, target.lng]]);
            mergedGrids.forEach(gridId => {
                const cellObj = allCells.find(c => c.id === gridId);
                if (cellObj) {
                    const coords = cellObj.polygon.geometry.coordinates[0];
                    coords.forEach(c => bounds.extend([c[1], c[0]]));
                }
            });
            map.flyToBounds(bounds.pad(0.2), { animate: true, duration: 0.8 });
        } else {
            map.flyTo([target.lat, target.lng], 15, { animate: true, duration: 0.8 });
        }
    });

    document.getElementById('btn-clear-assign').addEventListener('click', () => {
        if (!confirm("Rensa alla tilldelningar och tomma markeringar? (Punkterna finns kvar)")) return;
        for (const pid in pointAssignments) {
            pointAssignments[pid].clear();
        }
        emptyGrids.clear();
        renderState();
        renderPointList();
    });

    // Empty mode toggle
    document.getElementById('btn-empty-mode').addEventListener('click', () => {
        emptyMode = !emptyMode;
        const btn = document.getElementById('btn-empty-mode');
        if (emptyMode) {
            btn.textContent = '✅ Tomt-läge AKT IVT (klicka rutor)';
            btn.style.background = '#d5f5e3';
            btn.style.borderColor = '#27ae60';
            btn.style.color = '#1e8449';
            activePointId = null;
            renderFieldPoints();
            renderPointList();
        } else {
            btn.textContent = '⬜ Markera tomma rutor';
            btn.style.background = '#f0f0f0';
            btn.style.borderColor = '';
            btn.style.color = '';
        }
    });

    // ============================================================
    // 13. Statistics (FIX #4: separated DB vs session)
    // ============================================================
    function updateStats() {
        let dbCount = 0;
        let dbGroups = 0;
        for (const k in state.groups) {
            dbGroups++;
            let c = parseInt(state.groups[k].count, 10);
            if (!isNaN(c)) dbCount += c;
        }

        let sessionCount = 0;
        let sessionGroups = 0;
        fieldPoints.forEach(pt => {
            if (pt.count > 0) {
                sessionCount += pt.count;
                sessionGroups++;
            }
        });

        const elDbBon = document.getElementById('stat-db-bon');
        const elSessionBon = document.getElementById('stat-session-bon');
        const elTotal = document.getElementById('stat-total');
        const elKolonier = document.getElementById('stat-kolonier');

        if (elDbBon) elDbBon.innerText = dbCount;
        if (elSessionBon) elSessionBon.innerText = sessionCount > 0 ? '+' + sessionCount : '0';
        if (elTotal) elTotal.innerText = dbCount + sessionCount;
        if (elKolonier) elKolonier.innerText = dbGroups + sessionGroups;
    }

    // ============================================================
    // 14. Export: Copy for gAIa (FIX #3: warning for unassigned)
    // ============================================================
    document.getElementById('btn-copy-session').addEventListener('click', () => {
        if (fieldPoints.length === 0) {
            alert("Ingen fältdata att exportera. Ladda fältdata först.");
            return;
        }

        // FIX #3: Warn about unassigned points
        const unassigned = fieldPoints.filter(pt => {
            const grids = pointAssignments[pt.id];
            return !grids || grids.size === 0;
        });
        if (unassigned.length > 0) {
            const nums = unassigned.map(p => '#' + (fieldPoints.indexOf(p) + 1)).join(', ');
            if (!confirm(
                `⚠️ ${unassigned.length} punkt(er) saknar tilldelade rutor: ${nums}\n\n` +
                `Dessa kommer att exporteras med "INGA RUTOR".\n` +
                `Vill du exportera ändå?`
            )) return;
        }

        const sessionDate = document.getElementById('session-date').value || 'Inget datum';

        let txt = `RÅKOINVENTERING SESSION: ${sessionDate}\n`;
        txt += `Exporterad: ${new Date().toISOString()}\n`;

        // Original field data
        txt += "\nORIGINALDATA:\n";
        if (rawFieldText) {
            rawFieldText.split('\n').forEach(line => {
                line = line.trim();
                if (line) txt += `  ${line}\n`;
            });
        }

        // Assignments
        txt += "\nTILLDELNINGAR:\n";
        fieldPoints.forEach((pt, i) => {
            const grids = pointAssignments[pt.id] ? Array.from(pointAssignments[pt.id]).sort() : [];
            const gridStr = grids.length > 0 ? grids.join(', ') : 'INGA RUTOR';
            const coordStr = `${pt.lat}, ${pt.lng}`;

            if (pt.count === 0) {
                txt += `  Punkt ${i + 1}: Tomt (0 bon), Pos: ${coordStr}, Rutor: ${gridStr}\n`;
            } else {
                txt += `  Punkt ${i + 1}: ${pt.count} bon, Pos: ${coordStr}, Rutor: ${gridStr}\n`;
            }
        });

        // Action log
        if (actionLog.length > 0) {
            txt += "\nÅTGÄRDSLOGG:\n";
            actionLog.forEach(entry => {
                txt += `  [${entry.time}] ${entry.type}: ${entry.detail}\n`;
            });
        }

        // Empty grids
        if (emptyGrids.size > 0) {
            txt += "\nTOMMA RUTOR (inventerade utan bon):\n";
            txt += `  ${Array.from(emptyGrids).sort().join(', ')}\n`;
        }

        // Summary
        const totalBon = fieldPoints.reduce((s, p) => s + p.count, 0);
        const withGrids = fieldPoints.filter(p => pointAssignments[p.id] && pointAssignments[p.id].size > 0).length;
        txt += `\nSAMMANFATTNING: ${fieldPoints.length} punkter, ${totalBon} bon, ${withGrids}/${fieldPoints.length} med rutor, ${emptyGrids.size} tomma rutor\n`;

        navigator.clipboard.writeText(txt).then(() => {
            alert(`Kopierat!\n\n${fieldPoints.length} punkter, ${totalBon} bon\n${emptyGrids.size} tomma rutor\nÅtgärdslogg: ${actionLog.length} poster\n\nKlistra in till gAIa i chatten.`);
        }).catch(err => {
            prompt("Kunde inte kopiera automatiskt. Markera och kopiera manuellt:", txt);
        });
    });

    // ============================================================
    // 15. Image export
    // ============================================================
    document.getElementById('btn-export-image').addEventListener('click', () => {
        document.body.classList.add('export-mode');
        setTimeout(() => {
            html2canvas(document.getElementById('map'), {
                useCORS: true, allowTaint: false, backgroundColor: "#ffffff"
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

    // ============================================================
    // 16. Grid ID toggle
    // ============================================================
    document.getElementById('toggle-grid-ids').addEventListener('change', (e) => {
        if (e.target.checked) map.addLayer(labelsLayer);
        else map.removeLayer(labelsLayer);
    });

    // ============================================================
    // 17. Initial UI
    // ============================================================
    updateStats();
});
