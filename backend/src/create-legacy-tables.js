import pg from 'pg';
import 'dotenv/config';

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });

async function createLegacyTables() {
  await client.connect();
  
  const ddl = `
    CREATE TABLE IF NOT EXISTS sales_order (
      order_id SERIAL PRIMARY KEY,
      order_number VARCHAR(50),
      order_date DATE,
      customer_name VARCHAR(200),
      project_name VARCHAR(200),
      delivery_date DATE,
      status VARCHAR(50),
      total_sets INTEGER,
      remarks TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sales_order_item (
      order_item_id SERIAL PRIMARY KEY,
      order_id INTEGER REFERENCES sales_order(order_id),
      cert_id INTEGER,
      structure_code VARCHAR(50),
      qty INTEGER,
      spec_note TEXT,
      sort_order INTEGER,
      opening_w_mm INTEGER,
      opening_h_mm INTEGER,
      penetration_w_mm INTEGER,
      penetration_h_mm INTEGER
    );

    CREATE TABLE IF NOT EXISTS purchase_request (
      pr_id SERIAL PRIMARY KEY,
      pr_number VARCHAR(50),
      order_id INTEGER,
      pr_date DATE,
      supplier_name VARCHAR(200),
      status VARCHAR(50),
      remarks TEXT,
      created_by VARCHAR(100),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      total_amount NUMERIC
    );

    CREATE TABLE IF NOT EXISTS purchase_request_item (
      pri_id SERIAL PRIMARY KEY,
      pr_id INTEGER REFERENCES purchase_request(pr_id),
      item_id INTEGER,
      item_code VARCHAR(50),
      item_name VARCHAR(200),
      required_qty NUMERIC,
      order_qty NUMERIC,
      unit VARCHAR(20),
      unit_price NUMERIC,
      delivery_date DATE,
      remarks TEXT,
      sort_order INTEGER,
      spec_detail TEXT,
      calc_note TEXT,
      component_name TEXT,
      roll_count INTEGER,
      roll_spec TEXT,
      amount NUMERIC,
      item_subcategory VARCHAR(50),
      item_spec TEXT,
      receiving_status VARCHAR(50),
      received_qty NUMERIC,
      received_at TIMESTAMPTZ,
      lot_id INTEGER,
      insp_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS compounding_recipe (
      recipe_id SERIAL PRIMARY KEY,
      recipe_name VARCHAR(200),
      recipe_code VARCHAR(50),
      batch_size NUMERIC,
      batch_unit VARCHAR(20),
      is_certified BOOLEAN,
      is_active BOOLEAN,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS compounding_recipe_item (
      recipe_item_id SERIAL PRIMARY KEY,
      recipe_id INTEGER REFERENCES compounding_recipe(recipe_id),
      item_id INTEGER,
      qty NUMERIC,
      ratio NUMERIC,
      sort_order INTEGER
    );

    CREATE TABLE IF NOT EXISTS process_bom (
      bom_id SERIAL PRIMARY KEY,
      bom_name VARCHAR(200),
      bom_code VARCHAR(50),
      output_item_id INTEGER,
      output_qty NUMERIC,
      output_unit VARCHAR(20),
      loss_rate NUMERIC,
      cert_id INTEGER,
      process_code VARCHAR(50),
      description TEXT,
      is_active BOOLEAN,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS process_bom_item (
      bom_item_id SERIAL PRIMARY KEY,
      bom_id INTEGER REFERENCES process_bom(bom_id),
      item_id INTEGER,
      component_name VARCHAR(200),
      qty NUMERIC,
      unit VARCHAR(20),
      is_key_material BOOLEAN,
      spec_detail TEXT,
      sort_order INTEGER
    );

    CREATE TABLE IF NOT EXISTS order_bom_result (
      result_id SERIAL PRIMARY KEY,
      order_id INTEGER,
      order_item_id INTEGER,
      item_id INTEGER,
      item_code VARCHAR(50),
      item_name VARCHAR(200),
      item_category VARCHAR(50),
      component_name TEXT,
      required_qty NUMERIC,
      current_stock NUMERIC,
      shortage_qty NUMERIC,
      unit VARCHAR(20),
      spec_detail TEXT,
      calc_note TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;
  
  try {
    await client.query(ddl);
    console.log('✅ Legacy tables recreated successfully');
  } catch (e) {
    console.log('Error:', e.message);
  } finally {
    await client.end();
  }
}
createLegacyTables();
