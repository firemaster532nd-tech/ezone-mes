export interface Certification {
  cert_id: number;
  cert_number: string;
  product_group: 'MP' | 'BD' | 'NP';
  structure_name: string;
  structure_code: string;
  install_position: '수직벽체' | '수평바닥';
  fire_rating: string | null;
  socket_name: string | null;
  cert_area_sqmm: number | null;
  opening_w_mm: number | null;
  opening_h_mm: number | null;
  penetration_w_mm: number | null;
  penetration_h_mm: number | null;
  gap_limit_mm: number | null;
  gap_direction: string;
  install_qty: number;
  sheet_thickness_min: number | null;
  sheet_thickness_prod: number | null;
  cw_density_min: number | null;
  cw_density_prod: number | null;
  cert_version: string | null;
  is_active: boolean;
  created_at: string;
}

export interface CertificationRule {
  rule_id: number;
  cert_id: number;
  rule_type: 'AREA' | 'GAP' | 'PIPE' | 'THICKNESS' | 'DENSITY' | 'MASS' | 'LENGTH' | 'WIDTH';
  cert_value: number;
  direction: 'MAX' | 'MIN';
  production_value: number | null;
  tolerance_plus: number | null;
  unit: string | null;
  description: string | null;
}

export interface CertificationDetail extends Certification {
  bom: BomEntryWithItem[];
  rules: CertificationRule[];
}

export interface BomEntry {
  bom_id: number;
  cert_id: number;
  component_name: string;
  item_id: number | null;
  qty_per_unit: number;
  spec_detail: string | null;
  is_applicable: boolean;
  sort_order: number | null;
}

export interface BomEntryWithItem extends BomEntry {
  item_name: string | null;
  item_code: string | null;
}
