import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('upload/all_excel_sheets.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

if '배합원자료 수불표' in data:
    for idx, r in enumerate(data['배합원자료 수불표'][:20]):
        non_empty = [f"col{i}:{c}" for i, c in enumerate(r) if c.strip()]
        print(f"L{idx+1}: " + ' | '.join(non_empty))
