#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""재고수불표 엑셀 분석 스크립트"""
import pandas as pd
import json, sys

FILENAME = 'upload/RPT_20260212_이지원재고수불표_SELF_완료.xlsx'
OUT = 'upload/inventory_analysis.json'

xl = pd.ExcelFile(FILENAME)
sheets = xl.sheet_names
print(f"시트 수: {len(sheets)}")
for i, s in enumerate(sheets):
    print(f"[{i}] {s}")

result = {}

# 핵심 시트들 읽기 (처음 3~4행이 헤더일 수 있음)
KEY_SHEET_INDICES = [0, 1, 2, 3, 4, 5, 6, 8, 10, 11]  # 주요 시트

for idx in KEY_SHEET_INDICES:
    if idx >= len(sheets):
        continue
    sname = sheets[idx]
    try:
        df = pd.read_excel(FILENAME, sheet_name=sname, header=None, nrows=50)
        # 빈 행/열 제거
        df = df.dropna(how='all').dropna(axis=1, how='all')
        rows = []
        for _, row in df.iterrows():
            r = [str(v) if pd.notna(v) else '' for v in row]
            if any(v.strip() for v in r):
                rows.append(r)
        result[sname] = rows
        print(f"\n=== 시트[{idx}]: {sname} ({len(rows)}행 미리보기) ===")
        for r in rows[:20]:
            print(r)
    except Exception as e:
        print(f"오류: {sname} -> {e}")

with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print(f"\n결과 저장: {OUT}")
