#!/bin/bash
# =============================================
#  EZONE MES DB 복원 스크립트 (Mac / Linux)
#  실행 전 docker compose up 상태여야 합니다.
# =============================================

echo ""
echo "========================================"
echo "  EZONE MES DB 데이터 복원"
echo "========================================"
echo ""

cd "$(dirname "$0")"

DUMP_FILE="docker/postgres/backup/ezone_mes_dump_20260330.sql"

if [ ! -f "$DUMP_FILE" ]; then
    echo "[오류] 백업 파일을 찾을 수 없습니다: $DUMP_FILE"
    exit 1
fi

echo "[복원] DB 데이터를 복원합니다..."
echo "       (수주/발주/입고/검사/작업지시 예시 데이터 포함)"
echo ""

docker compose exec -T db psql -U ezone -d ezone_mes < "$DUMP_FILE"

echo ""
echo "[완료] DB 복원이 완료되었습니다."
echo "       브라우저에서 http://localhost:5173 으로 확인하세요."
echo ""
echo "  복원 데이터:"
echo "    - 수주 1건 (SO-260303-001)"
echo "    - 발주서 1건 (PR-260330-002, 13품목)"
echo "    - 입고 LOT 13건"
echo "    - 인수검사 13건 (5건 PASS)"
echo "    - 작업지시 13건"
echo ""
