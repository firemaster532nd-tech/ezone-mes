import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('upload/all_excel_sheets.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

for sname in ['배합원자료 수불표', '자재수불합계', '입고출하목록']:
    if sname in data:
        print(f"\n==========================================")
        print(f"시트: {sname} ({len(data[sname])}행)")
        print(f"==========================================")
        for idx, row in enumerate(data[sname]):
            row_str = ' | '.join([c for c in row if c.strip()])
            if row_str:
                print(f"L{idx+1}: {row_str[:160]}")
