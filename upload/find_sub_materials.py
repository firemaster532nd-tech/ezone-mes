import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('upload/all_excel_sheets.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

keywords = ['EP-100', 'EP100', 'EA-33045', 'EA33045', '흑연', '난연컴파운드', '컴파운드', 'MB', '실란트', '원자재', '수불']

print("=== 엑셀 내 EP100, EA33045, 흑연, 난연컴파운드 키워드 검색 ===")
for sheet_name, rows in data.items():
    found = []
    for r_idx, row in enumerate(rows):
        row_str = ' | '.join(row)
        if any(k.lower() in row_str.lower() for k in keywords):
            found.append((r_idx + 1, row))
    if found:
        print(f"\n==========================================")
        print(f"시트: {sheet_name} (발견 {len(found)}행)")
        print(f"==========================================")
        for r_idx, r in found[:25]:
            print(f"L{r_idx}: " + ' | '.join([c for c in r if c.strip()]))
