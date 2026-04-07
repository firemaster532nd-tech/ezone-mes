export type LotType = 'IN' | 'MIX' | 'EXT' | 'CUT' | 'ASM' | 'GI' | 'CW' | 'SS' | 'GW' | 'OUT';
export type LotStatus = 'ACTIVE' | 'CONSUMED' | 'SHIPPED' | 'SCRAPPED';
export type InspectionResult = 'PASS' | 'FAIL' | 'PENDING';

export interface LotTransaction {
  lot_id: number;
  lot_number: string;
  lot_type: LotType;
  item_id: number | null;
  wo_id: number | null;
  qty: number;
  unit: string | null;
  supplier_lot: string | null;
  inspection_lot: string | null;
  inspection_result: InspectionResult | null;
  cert_compliant: boolean | null;
  status: LotStatus;
  remaining_qty: number | null;
  location: string | null;
  created_at: string;
}

export interface LotWithDetails extends LotTransaction {
  item_name?: string;
  item_code?: string;
  wo_number?: string;
  process_code?: string;
}

export interface LotGenealogy {
  genealogy_id: number;
  parent_lot_id: number;
  child_lot_id: number;
  consumed_qty: number | null;
  component_position: string | null;
}

export interface LotTraceNode {
  lot_id: number;
  lot_number: string;
  lot_type: LotType;
  item_name: string | null;
  item_code: string | null;
  qty: number;
  unit: string | null;
  status: LotStatus;
  inspection_result: InspectionResult | null;
  depth: number;
  children: LotTraceNode[];
}
