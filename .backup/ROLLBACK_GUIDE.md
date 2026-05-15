# 롤백 가이드

## 롤백 방법
문제 발생 시 해당 백업 파일을 원본 위치로 복사한 후 Docker 재빌드합니다.

```bash
# 예시: orders.ts를 특정 시점으로 롤백
cp .backup/20260407/orders_before_lotgen.ts.bak backend/src/routes/orders.ts
docker compose up --build -d
```

## 백업 파일 → 원본 경로 매핑

| 백업 파일 패턴 | 원본 경로 |
|---|---|
| `orders*.ts.bak` | `backend/src/routes/orders.ts` |
| `work-orders*.ts.bak` | `backend/src/routes/work-orders.ts` |
| `WorkOrdersPage*.tsx.bak` | `frontend/src/pages/production/WorkOrdersPage.tsx` |
| `PurchaseRequestPage*.tsx.bak` | `frontend/src/pages/orders/PurchaseRequestPage.tsx` |

## 백업 시점 (시간순)
1. `*.bak` - 최초 백업
2. `*_before_auto_wo` - 발주완료 시 작업지시 자동생성 추가 전
3. `*_before_qty_fix` - EXT/CUT 수량 BOM 기반 수정 전
4. `*_before_ext_spec` - EXT 규격(두께/폭) 선택 추가 전
5. `*_before_ext_split` - EXT 규격별 분리 생성 전
6. `*_before_cut_detail` - CUT 재단 규격 상세 표시 전
7. `*_before_cutfilter` - CUT 소켓/플래싱 필터링 전
8. `*_before_flashing` - 플래싱 재단 규격 추가 전
9. `*_before_mix_separate` - MIX 목록 중복 수정 전
10. `*_before_mix_lot` - MIX 배치별 LOT 분리 전
11. `*_before_cut_split` - CUT 소켓/플래싱 분리 생성 전
12. `*_before_lotgen` - LOT 번호 품목코드 기반 변경 전
13. `*_before_nomix` - MIX 자동생성 제외 전
14. `*_before_lotui` - LOT 선택 UI 개선 전
15. `*_before_singlelot` - 개별 입고 LOT 규칙 변경 전
