export interface Item {
  item_id: number;
  item_code: string;
  item_name: string;
  item_category: 'RM' | 'SM' | 'SA' | 'FP';
  item_subcategory: string | null;
  spec: string | null;
  unit: string;
  cert_min_density: number | null;
  cert_min_thickness: number | null;
  cert_min_mass: number | null;
  production_value: number | null;
  tolerance_plus: number | null;
  value_direction: 'MIN' | 'MAX' | null;
  safety_stock: number;
  is_active: boolean;
}
