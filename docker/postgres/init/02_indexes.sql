-- ================================================
-- EZONE MES Indexes
-- ================================================

-- certification_master
CREATE INDEX idx_cert_product_group ON certification_master(product_group);
CREATE INDEX idx_cert_structure_code ON certification_master(structure_code);
CREATE INDEX idx_cert_version ON certification_master(cert_version);

-- item_master
CREATE INDEX idx_item_category ON item_master(item_category);

-- bom_master
CREATE INDEX idx_bom_cert_id ON bom_master(cert_id);
CREATE INDEX idx_bom_item_id ON bom_master(item_id);

-- certification_rule
CREATE INDEX idx_rule_cert_id ON certification_rule(cert_id);
CREATE INDEX idx_rule_type ON certification_rule(rule_type);

-- work_order
CREATE INDEX idx_wo_process_code ON work_order(process_code);
CREATE INDEX idx_wo_date ON work_order(wo_date);
CREATE INDEX idx_wo_status ON work_order(status);
CREATE INDEX idx_wo_cert_id ON work_order(cert_id);

-- lot_transaction
CREATE INDEX idx_lot_type ON lot_transaction(lot_type);
CREATE INDEX idx_lot_item_id ON lot_transaction(item_id);
CREATE INDEX idx_lot_status ON lot_transaction(status);

-- lot_genealogy
CREATE INDEX idx_genealogy_parent ON lot_genealogy(parent_lot_id);
CREATE INDEX idx_genealogy_child ON lot_genealogy(child_lot_id);

-- inventory_transaction
CREATE INDEX idx_inv_item_id ON inventory_transaction(item_id);
CREATE INDEX idx_inv_txn_date ON inventory_transaction(txn_date);
CREATE INDEX idx_inv_txn_type ON inventory_transaction(txn_type);

-- inspection
CREATE INDEX idx_insp_wo_id ON inspection(wo_id);
CREATE INDEX idx_insp_type ON inspection(insp_type);
CREATE INDEX idx_insp_lot_id ON inspection(lot_id);

-- inspection_detail
CREATE INDEX idx_detail_insp_id ON inspection_detail(insp_id);

-- self_inspection
CREATE INDEX idx_self_wo_id ON self_inspection(wo_id);
