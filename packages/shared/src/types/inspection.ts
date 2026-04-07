export type InspType = 'INCOMING' | 'PROCESS' | 'FINAL';
export type InspResult = 'PASS' | 'FAIL' | 'PENDING';
export type DetailResult = 'PASS' | 'FAIL' | 'NA';

export interface Inspection {
  insp_id: number;
  insp_type: InspType;
  form_code: string | null;
  wo_id: number | null;
  lot_id: number | null;
  cert_id: number | null;
  sampling_n: number;
  accept_c: number;
  result: InspResult | null;
  inspector: string | null;
  inspected_at: string | null;
  shipped_at: string | null;
  remarks: string | null;
}

export interface InspectionWithDetails extends Inspection {
  lot_number?: string;
  item_name?: string;
  item_code?: string;
  cert_number?: string;
  details: InspectionDetail[];
}

export interface InspectionDetail {
  detail_id: number;
  insp_id: number;
  item_no: number | null;
  quality_item: string | null;
  check_item: string | null;
  check_method: string | null;
  cert_standard: number | null;
  prod_standard: number | null;
  measured_n1: number | null;
  measured_n2: number | null;
  measured_n3: number | null;
  is_applicable: boolean;
  item_result: DetailResult | null;
}

export interface CreateInspectionInput {
  insp_type: InspType;
  lot_id: number;
  cert_id?: number;
  inspector?: string;
  details: CreateInspectionDetailInput[];
}

export interface CreateInspectionDetailInput {
  item_no: number;
  quality_item: string;
  check_item: string;
  check_method: string;
  cert_standard?: number;
  prod_standard?: number;
  measured_n1?: number;
  measured_n2?: number;
  measured_n3?: number;
  is_applicable?: boolean;
}
