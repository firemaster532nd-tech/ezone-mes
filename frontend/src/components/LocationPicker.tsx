import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

// ─── 타입 정의 ────────────────────────────────────────────────────────────────
export interface LocationPickerProps {
  value?: string; // location_code (예: 'A1-P1', 'FIELD-2F-LEFT', '' = 미지정)
  onChange: (locationCode: string, locationId?: number) => void;
  placeholder?: string;
  disabled?: boolean;
  allowNone?: boolean; // 미지정 허용 여부 (기본 true)
}

interface WmsLocation {
  location_id: number;
  location_code: string;
  location_name: string;
  location_type: string; // 'RACK' | 'FIELD'
}

// ─── 하드코딩 상수 ────────────────────────────────────────────────────────────
const RACK_BAYS = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R'];
const RACK_TIERS = [1, 2, 3];
const RACK_PALLETS = [
  { value: 'P1', label: 'P1 (오른쪽)' },
  { value: 'P2', label: 'P2 (왼쪽)' },
];

const FIELD_OPTIONS = [
  // ─── 1공장 ───────────────────────────────────────────────────
  { value: 'FIELD-1F-IN',      label: '1공장 안' },
  { value: 'FIELD-1F-MAT',     label: '1공장 원재료창고' },
  { value: 'FIELD-1F-TENT',    label: '1공장앞 천막' },
  { value: 'FIELD-1F-OUTDOOR', label: '야상 1공장 (야적)' },
  // ─── 2공장 ───────────────────────────────────────────────────
  { value: 'FIELD-2F-LEFT',    label: '2공장안 왼쪽' },
  { value: 'FIELD-2F-RIGHT',   label: '2공장안 오른쪽' },
  { value: 'FIELD-2F-TENT',    label: '2공장앞 천막' },
  { value: 'FIELD-2F-OUTDOOR', label: '야상 2공장 (야적)' },
];

type LocType = 'RACK' | 'FIELD' | 'NONE';

function inferType(value?: string): LocType {
  if (!value || value === 'NONE' || value === '미지정' || value === '') return 'NONE';
  if (value.startsWith('FIELD')) return 'FIELD';
  return 'RACK';
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────
export function LocationPicker({ value, onChange, placeholder, disabled, allowNone = true }: LocationPickerProps) {
  const [locType, setLocType] = useState<LocType>(inferType(value));

  // RACK 선택 상태
  const [rackBay, setRackBay]       = useState('A');
  const [rackTier, setRackTier]     = useState(1);
  const [rackPallet, setRackPallet] = useState('P1');

  // FIELD 선택 상태
  const [fieldCode, setFieldCode] = useState('FIELD-2F-LEFT');

  // DB에서 받아온 위치 목록
  const [locations, setLocations] = useState<WmsLocation[]>([]);

  // value prop에서 초기값 파싱
  useEffect(() => {
    if (value === undefined) return;
    const t = inferType(value);
    setLocType(t);
    if (t === 'FIELD') {
      setFieldCode(value);
    } else if (t === 'RACK') {
      const match = value.match(/^([A-R])(\d)-?(P\d)?$/);
      if (match) {
        setRackBay(match[1]);
        setRackTier(Number(match[2]));
        if (match[3]) setRackPallet(match[3]);
      }
    }
  }, [value]);

  // API에서 위치 목록 fetch
  const fetchLocations = useCallback(async () => {
    try {
      const res = await api.get<{ data: WmsLocation[] }>('/wms/locations');
      if (res.data?.length) setLocations(res.data);
    } catch {
      // 실패 시 하드코딩 값으로 fallback
    }
  }, []);

  useEffect(() => { fetchLocations(); }, [fetchLocations]);

  // location_code 계산
  const computedRackCode = `${rackBay}${rackTier}-${rackPallet}`;

  // 부모에 변경 알림
  const notifyRack = (bay: string, tier: number, pallet: string) => {
    const code = `${bay}${tier}-${pallet}`;
    const found = locations.find(l => l.location_code === code);
    onChange(code, found?.location_id);
  };

  const notifyField = (code: string) => {
    const found = locations.find(l => l.location_code === code);
    onChange(code, found?.location_id);
  };

  const handleTypeToggle = (t: LocType) => {
    setLocType(t);
    if (t === 'RACK') {
      notifyRack(rackBay, rackTier, rackPallet);
    } else if (t === 'FIELD') {
      notifyField(fieldCode);
    } else {
      // NONE — 미지정
      onChange('', undefined);
    }
  };

  const currentLabel =
    locType === 'NONE' ? '미지정 (렉 적재 안함)' :
    locType === 'RACK'  ? computedRackCode : fieldCode;

  const noneActive  = locType === 'NONE';
  const rackActive  = locType === 'RACK';
  const fieldActive = locType === 'FIELD';

  return (
    <div className="space-y-2">
      {/* 위치 유형 토글 */}
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleTypeToggle('RACK')}
          className={[
            'flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all',
            rackActive
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50',
          ].join(' ')}
        >
          🏗 렉 (RACK)
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleTypeToggle('FIELD')}
          className={[
            'flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all',
            fieldActive
              ? 'bg-blue-700 text-white border-blue-700'
              : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50',
          ].join(' ')}
        >
          🏭 비렉 (FIELD)
        </button>
        {allowNone && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleTypeToggle('NONE')}
            className={[
              'flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all',
              noneActive
                ? 'bg-gray-500 text-white border-gray-500'
                : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-50',
            ].join(' ')}
          >
            🚫 미지정
          </button>
        )}
      </div>

      {/* RACK 선택 UI */}
      {locType === 'RACK' && (
        <div className="flex gap-2">
          {/* 칸 */}
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-slate-600 mb-0.5">칸 (Bay)</label>
            <select
              disabled={disabled}
              value={rackBay}
              onChange={e => {
                setRackBay(e.target.value);
                notifyRack(e.target.value, rackTier, rackPallet);
              }}
              className="w-full border rounded-lg px-2 py-1.5 text-xs font-mono font-bold bg-white"
            >
              {RACK_BAYS.map(b => (
                <option key={b} value={b}>{b}칸</option>
              ))}
            </select>
          </div>

          {/* 층 */}
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-slate-600 mb-0.5">층 (Tier)</label>
            <select
              disabled={disabled}
              value={rackTier}
              onChange={e => {
                const t = Number(e.target.value);
                setRackTier(t);
                notifyRack(rackBay, t, rackPallet);
              }}
              className="w-full border rounded-lg px-2 py-1.5 text-xs font-mono font-bold bg-white"
            >
              {RACK_TIERS.map(t => (
                <option key={t} value={t}>{t}층</option>
              ))}
            </select>
          </div>

          {/* 파레트 */}
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-slate-600 mb-0.5">파레트</label>
            <select
              disabled={disabled}
              value={rackPallet}
              onChange={e => {
                setRackPallet(e.target.value);
                notifyRack(rackBay, rackTier, e.target.value);
              }}
              className="w-full border rounded-lg px-2 py-1.5 text-xs font-mono font-bold bg-white"
            >
              {RACK_PALLETS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* FIELD 선택 UI */}
      {locType === 'FIELD' && (
        <div>
          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">비렉 위치 선택</label>
          <select
            disabled={disabled}
            value={fieldCode}
            onChange={e => {
              setFieldCode(e.target.value);
              notifyField(e.target.value);
            }}
            className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-white"
          >
            {FIELD_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.value} — {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 미지정 안내 */}
      {locType === 'NONE' && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
          📦 렉에 적재하지 않음 — 위치 지정 없이 입고 처리됩니다
        </div>
      )}

      {/* 선택된 위치 코드 표시 */}
      {locType !== 'NONE' && (
        <div className="text-[10px] text-slate-500 font-mono bg-slate-50 border rounded px-2 py-1">
          📍 위치: <span className="font-black text-slate-800">{currentLabel}</span>
          {placeholder && !value && (
            <span className="ml-2 text-slate-400">{placeholder}</span>
          )}
        </div>
      )}
    </div>
  );
}

export default LocationPicker;
