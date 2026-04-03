#!/usr/bin/env python3
"""
Generera 250x250m rutnät (GeoJSON) för Åstorps kommun.
Körs: python3 generate-grid.py
Kräver: data/astorp-kommun.geojson i samma katalog
Producerar: data/astorp-grid-250m.geojson

Filtret är "intersects" — alla rutor som överlappar kommunen
inkluderas, så att ingen del av kommunen saknar täckning.
"""
import json, math, os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BOUNDARY_FILE = os.path.join(SCRIPT_DIR, 'data', 'astorp-kommun.geojson')
OUTPUT_FILE = os.path.join(SCRIPT_DIR, 'data', 'astorp-grid-250m.geojson')
CELL_SIZE_M = 250

# --- Läs kommunpolygon ---
with open(BOUNDARY_FILE) as f:
    border = json.load(f)

geom = border['features'][0]['geometry']
all_coords = []
if geom['type'] == 'Polygon':
    for ring in geom['coordinates']:
        all_coords.extend(ring)
    outer_ring = geom['coordinates'][0]
elif geom['type'] == 'MultiPolygon':
    for poly in geom['coordinates']:
        for ring in poly:
            all_coords.extend(ring)
    outer_ring = geom['coordinates'][0][0]

lngs = [c[0] for c in all_coords]
lats = [c[1] for c in all_coords]
min_lng, max_lng = min(lngs), max(lngs)
min_lat, max_lat = min(lats), max(lats)

# --- Cellstorlek i grader (korrigerat för latitud) ---
m_per_deg_lat = 111320
lat_mid = (min_lat + max_lat) / 2
m_per_deg_lng = 111320 * math.cos(math.radians(lat_mid))
dlat = CELL_SIZE_M / m_per_deg_lat
dlng = CELL_SIZE_M / m_per_deg_lng

print(f"Cell: {dlat:.6f}° lat × {dlng:.6f}° lng = {CELL_SIZE_M}m × {CELL_SIZE_M}m")

# --- Grid-ID ---
def grid_id(col, row):
    col_name = ""
    c = col
    while True:
        col_name = chr(65 + (c % 26)) + col_name
        c = c // 26 - 1
        if c < 0:
            break
    return f"{col_name}{row}"

# --- Geometrihjälpare ---
def point_in_polygon(point, polygon_coords):
    x, y = point
    n = len(polygon_coords)
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = polygon_coords[i]
        xj, yj = polygon_coords[j]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside

def segments_intersect(p1, p2, p3, p4):
    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    d1 = cross(p3, p4, p1)
    d2 = cross(p3, p4, p2)
    d3 = cross(p1, p2, p3)
    d4 = cross(p1, p2, p4)
    if ((d1 > 0 and d2 < 0) or (d1 < 0 and d2 > 0)) and \
       ((d3 > 0 and d4 < 0) or (d3 < 0 and d4 > 0)):
        return True
    return False

def cell_intersects_polygon(cell_corners, polygon_coords):
    # 1. Cellhörn innanför polygon?
    for corner in cell_corners:
        if point_in_polygon(corner, polygon_coords):
            return True
    # 2. Polygonpunkter innanför cell?
    cell_min_x = min(c[0] for c in cell_corners)
    cell_max_x = max(c[0] for c in cell_corners)
    cell_min_y = min(c[1] for c in cell_corners)
    cell_max_y = max(c[1] for c in cell_corners)
    for pt in polygon_coords:
        if cell_min_x <= pt[0] <= cell_max_x and cell_min_y <= pt[1] <= cell_max_y:
            return True
    # 3. Kanter korsar varandra?
    cell_edges = [(cell_corners[i], cell_corners[(i+1)%4]) for i in range(4)]
    for i in range(len(polygon_coords) - 1):
        poly_edge = (polygon_coords[i], polygon_coords[i+1])
        for cell_edge in cell_edges:
            if segments_intersect(cell_edge[0], cell_edge[1], poly_edge[0], poly_edge[1]):
                return True
    return False

# --- Generera rutor (med marginal) ---
features = []
row = 0
lat = min_lat - dlat
while lat < max_lat + dlat:
    col = 0
    lng = min_lng - dlng
    while lng < max_lng + dlng:
        features.append({
            "type": "Feature",
            "properties": {"gridId": grid_id(col, row)},
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [lng, lat], [lng, lat + dlat],
                    [lng + dlng, lat + dlat], [lng + dlng, lat],
                    [lng, lat]
                ]]
            }
        })
        lng += dlng
        col += 1
    lat += dlat
    row += 1

# --- Filtrera: intersects (full täckning) ---
filtered = []
edge_count = 0
for f in features:
    coords = f['geometry']['coordinates'][0]
    corners = [(coords[i][0], coords[i][1]) for i in range(4)]
    if cell_intersects_polygon(corners, outer_ring):
        filtered.append(f)
        cx = (corners[0][0] + corners[2][0]) / 2
        cy = (corners[0][1] + corners[2][1]) / 2
        if not point_in_polygon((cx, cy), outer_ring):
            edge_count += 1

print(f"Totalt: {len(features)}, inom kommunen: {len(filtered)} (varav {edge_count} kantrutor)")

with open(OUTPUT_FILE, 'w') as f:
    json.dump({"type": "FeatureCollection", "features": filtered}, f)

print(f"✅ Sparat: {OUTPUT_FILE}")
