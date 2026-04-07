export type TxnType = 'IN' | 'OUT' | 'ADJ';

export interface InventoryTransaction {
  inv_id: number;
  item_id: number;
  lot_id: number | null;
  txn_type: TxnType;
  txn_date: string;
  qty: number;
  balance: number | null;
  purpose: string | null;
  ref_wo_id: number | null;
  ref_lot_number: string | null;
  worker: string | null;
  confirmed_by: string | null;
  created_at: string;
}

export interface InventoryTransactionWithDetails extends InventoryTransaction {
  item_name: string;
  item_code: string;
  item_category: string;
  unit: string;
}

export interface InventorySummary {
  item_id: number;
  item_code: string;
  item_name: string;
  item_category: string;
  unit: string;
  total_in: number;
  total_out: number;
  balance: number;
  safety_stock: number;
  active_lots: number;
  is_below_safety: boolean;
}

export interface InventoryDashboard {
  category: string;
  total_items: number;
  total_balance: number;
  below_safety_count: number;
  active_lot_count: number;
}
