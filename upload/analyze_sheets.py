import json

with open('upload/all_excel_sheets.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print("=== 시트 키 목록 ===")
for i, key in enumerate(data.keys()):
    print(f"{i}: {key}")

# 원자재 수불 현황이 있는 시트들 분석
keywords = ['원자재', '수불', '재고', '세라믹', '그라스', '소켓', '배합', '가스켓', '완제품', '입고']
for sheet_name, rows in data.items():
    print(f"\n==========================================")
    print(f"시트: {sheet_name} (총 {len(rows)}행)")
    print(f"==========================================")
    # 상위 15행 출력
    for r in rows[:15]:
        row_str = ' | '.join([c for c in r if c.strip()])
        if row_str:
            print(row_str[:120])
