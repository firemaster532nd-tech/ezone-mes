#!/bin/bash
# =============================================
#  EZONE MES 시작 스크립트 (Mac / Linux)
# =============================================

echo ""
echo "========================================"
echo "  EZONE MES 시스템 시작"
echo "========================================"
echo ""

cd "$(dirname "$0")"

# .env 파일 없으면 자동 생성
if [ ! -f .env ]; then
    echo "[설정] .env 파일 생성 중..."
    cp .env.example .env
    echo "[설정] .env 파일 생성 완료"
fi

echo "[시작] Docker 컨테이너를 빌드하고 시작합니다..."
echo "       (최초 실행 시 5~15분 소요될 수 있습니다)"
echo ""

docker compose up --build

echo ""
echo "[종료] 시스템이 종료되었습니다."
