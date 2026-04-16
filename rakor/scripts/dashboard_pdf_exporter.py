import json
import os
from shapely.geometry import shape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors

data_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../data'))
astorp_geojson = os.path.join(data_dir, 'astorp-kommun.geojson')
grid_geojson = os.path.join(data_dir, 'astorp-grid-250m.geojson')
obs_json = os.path.join(data_dir, 'rakobservations.json')

def load_astorp_polygon():
    with open(astorp_geojson, 'r', encoding='utf-8') as f:
        data = json.load(f)
        if data.get('features'):
            return shape(data['features'][0]['geometry'])
    return None

def create_grid_system_pdf(output_path):
    astorp_poly = load_astorp_polygon()
    
    with open(grid_geojson, 'r', encoding='utf-8') as f:
        grid_data = json.load(f)
    
    features = grid_data['features']
    
    doc = SimpleDocTemplate(output_path, pagesize=landscape(A4))
    elements = []
    styles = getSampleStyleSheet()
    
    title = Paragraph("Teknisk Specifikation: Grid-system 250m", styles['Title'])
    elements.append(title)
    elements.append(Spacer(1, 12))
    
    data = [["Ruta-ID", "Lat", "Lng", "Bounding Box", "Åstorp Status"]]
    
    features.sort(key=lambda x: x.get('properties', {}).get('gridId') or x.get('properties', {}).get('id') or x.get('id', ''))
    
    for feat in features:
        geom = shape(feat['geometry'])
        props = feat.get('properties', {})
        grid_id = props.get('gridId') or props.get('id') or feat.get('id') or 'N/A'
        
        centroid = geom.centroid
        bounds = geom.bounds
        bbox_str = f"Lnge:[{bounds[0]:.4f}, {bounds[2]:.4f}] Lat:[{bounds[1]:.4f}, {bounds[3]:.4f}]"
        
        status = "Utanför"
        if astorp_poly:
            if astorp_poly.contains(geom):
                status = "Hela rutan i Åstorp"
            elif astorp_poly.intersects(geom):
                status = "Korsar gränsen"
            
        data.append([
            grid_id,
            f"{centroid.y:.5f}",
            f"{centroid.x:.5f}",
            bbox_str,
            status
        ])
        
    table = Table(data, repeatRows=1)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.grey),
        ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0,0), (-1,0), 6),
        ('GRID', (0,0), (-1,-1), 1, colors.black),
        ('FONTSIZE', (0,0), (-1,-1), 8),
    ]))
    
    elements.append(table)
    doc.build(elements)
    print(f"✅ Skapade Grid PDF: {output_path}")

def create_field_data_pdf(output_path):
    with open(obs_json, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    doc = SimpleDocTemplate(output_path, pagesize=A4)
    elements = []
    styles = getSampleStyleSheet()
    
    title = Paragraph("Fältdata 2026: Råkinventering Åstorp", styles['Title'])
    elements.append(title)
    elements.append(Spacer(1, 12))
    
    grids = data.get('grids', {})
    groups = data.get('groups', {})
    
    total_grids = len(grids)
    nests = 0
    empty = 0
    
    grid_rows = [["Ruta", "Status", "Kluster ID", "Bon i klustret"]]
    
    for gid, info in sorted(grids.items()):
        status = info.get('status', 'empty')
        group_id = info.get('group', '-')
        
        if status == 'empty':
            empty += 1
            count_str = "0"
        else:
            nests += 1
            grp = groups.get(group_id, {})
            count_str = str(grp.get('count', '?'))
            
        grid_rows.append([gid, status.upper(), group_id, count_str])
        
    desc = f"Totalt genomsökta rutor: {total_grids}. Rutor med bon: {nests}. Tomma (vid genomsök): {empty}."
    elements.append(Paragraph(desc, styles['Normal']))
    elements.append(Spacer(1, 12))
    
    table = Table(grid_rows, repeatRows=1)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#2b7a78")),
        ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('GRID', (0,0), (-1,-1), 1, colors.black),
    ]))
    
    elements.append(table)
    doc.build(elements)
    print(f"✅ Skapade Data PDF: {output_path}")

if __name__ == "__main__":
    out_dir = os.path.dirname(__file__)
    create_grid_system_pdf(os.path.join(out_dir, "GridSystem_Teknisk_Specifikation.pdf"))
    create_field_data_pdf(os.path.join(out_dir, "Faltdata_Rak_2026.pdf"))
