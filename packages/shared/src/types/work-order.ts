export type ProcessCode = 'MIX' | 'EXT' | 'CUT' | 'ASM' | 'SHP';
export type WoStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'HOLD';

export interface WorkOrder {
  wo_id: number;
  wo_number: string | null;
  wo_date: string;
  process_code: ProcessCode;
  product_type: string | null;
  cut_subtype: string | null;
  install_type: string | null;
  cert_id: number | null;
  order_id: number | null;
  item_id: number | null;
  planned_qty: number | null;
  actual_qty: number | null;
  status: WoStatus;
  equipment_id: string | null;
  manager_id: number | null;
  am_worker: string | null;
  pm_worker: string | null;
  night_worker: string | null;
  inspector: string | null;
  start_time: string | null;
  end_time: string | null;
  downtime_minutes: number | null;
  downtime_reason: string | null;
  production_length_m: number | null;
  input_weight_kg: number | null;
  scrap_kg: number | null;
  serial_number: number | null;
  purpose: string | null;
  spec_detail: string | null;
  remarks: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface WorkOrderWithDetails extends WorkOrder {
  cert_number?: string;
  structure_code?: string;
  item_name?: string;
  item_code?: string;
  lot_number?: string;
}

export interface CreateWorkOrderInput {
  wo_date: string;
  process_code: ProcessCode;
  cert_id?: number;
  item_id?: number;
  planned_qty?: number;
  product_type?: string;
  cut_subtype?: string;
  install_type?: string;
  equipment_id?: string;
  purpose?: string;
  spec_detail?: string;
  remarks?: string;
}
