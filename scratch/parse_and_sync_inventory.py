import csv
import re

content_path = r"C:\Users\edwar\.gemini\antigravity\brain\9f30e1a3-104f-47c7-aee8-d21df2d1a020\.system_generated\steps\8753\content.md"

items = []

def parse_spec(spec_str):
    spec_str = spec_str.strip()
    # e.g. "100k 25T 150W 7400L" or "24k 25T 1400 20000L"
    density = None
    thickness = None
    width_mm = None
    length_mm = None

    d_match = re.search(r'(\d+)k', spec_str, re.IGNORECASE)
    if d_match:
        density = float(d_match.group(1))

    t_match = re.search(r'(\d+)T', spec_str, re.IGNORECASE)
    if t_match:
        thickness = float(t_match.group(1))

    w_match = re.search(r'(\d+)W', spec_str, re.IGNORECASE)
    if w_match:
        width_mm = float(w_match.group(1))
    else:
        # e.g. 24k 25T 1400 20000L
        m = re.search(r'(\d+)T\s+(\d+)\s+(\d+)L', spec_str, re.IGNORECASE)
        if m:
            width_mm = float(m.group(2))

    l_match = re.search(r'(\d+)L', spec_str, re.IGNORECASE)
    if l_match:
        length_mm = float(l_match.group(1))

    return density, thickness, width_mm, length_mm

with open(content_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

for line in lines:
    line = line.strip()
    if not line or line.startswith('Title') or line.startswith('Description') or line.startswith('Source') or line.startswith('---'):
        continue
    parts = [p.strip() for p in line.split(',')]
    if len(parts) >= 3:
        spec = parts[0]
        lot = parts[1]
        qty_str = parts[2]
        if lot and lot != 'LOT No.' and qty_str and not qty_str.startswith('총') and not spec.startswith('현장재고') and not spec.startswith('규격'):
            try:
                qty = float(qty_str)
                d, t, w, l = parse_spec(spec)
                category = '그라스울' if 'GW' in lot.upper() else '세라믹울'
                items.append({
                    'spec': spec,
                    'lot_number': lot,
                    'qty': qty,
                    'category': category,
                    'density': d,
                    'thickness': t,
                    'width_mm': w,
                    'length_mm': l,
                    'section': '현장재고'
                })
            except ValueError:
                pass

print(f"Parsed {len(items)} items from Google Sheet:")
for item in items:
    print(item)
