import pg from 'pg';
import XLSX from 'xlsx';
import path from 'path';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;

const uploadDir = 'c:\\Users\\edwar\\OneDrive\\ezone-mes\\upload';
const filePath = path.join(uploadDir, '직원정보.xlsx');

const ROUNDS = 10;

function hashPassword(plain) {
  return bcrypt.hash(plain, ROUNDS);
}

function normalizePhone(phone) {
  if (!phone) return null;
  const cleaned = String(phone).replace(/[^0-9]/g, '');
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return String(phone).trim();
}

function getDeptIdAndName(deptName) {
  if (!deptName) return { id: 2, name: '생산팀' }; // default to PRODUCTION
  const name = String(deptName).trim();
  if (name.includes('경영') || name.includes('시스템관리') || name.includes('관리부') || name.includes('관리')) {
    return { id: 1, name: '관리부' };
  }
  if (name.includes('생산관리') || name.includes('생산')) {
    return { id: 2, name: '생산팀' };
  }
  if (name.includes('기술품질') || name.includes('생산품질') || name.includes('품질')) {
    return { id: 3, name: '품질팀' };
  }
  if (name.includes('자재')) {
    return { id: 4, name: '자재팀' };
  }
  if (name.includes('영업')) {
    return { id: 5, name: '영업팀' };
  }
  if (name.includes('구매')) {
    return { id: 16, name: '구매팀' };
  }
  return { id: 2, name: '생산팀' }; // default to PRODUCTION
}

async function upload() {
  console.log('Connecting to database...');
  const client = new Client({ connectionString });
  await client.connect();
  console.log('Connected to database successfully.');

  console.log('Loading Excel file:', filePath);
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');

  const rows = [];
  for (let r = 0; r <= range.e.r; r++) {
    const row = [];
    for (let c = 0; c <= range.e.c; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[cellRef];
      row.push(cell ? cell.v : '');
    }
    rows.push(row);
  }

  // Skip header lines: Row 0 is Company Title, Row 1 is Column Names
  const dataRows = rows.slice(2);
  console.log(`Found ${dataRows.length} employee rows in the Excel file.`);

  let updatedCount = 0;
  let insertedCount = 0;
  let errorCount = 0;

  for (const row of dataRows) {
    const empCode = String(row[0] || '').trim();
    const empName = String(row[1] || '').trim();
    const phoneRaw = String(row[3] || '').trim();
    const email = String(row[4] || '').trim();
    const useStatus = String(row[5] || '').trim();

    if (!empName) {
      console.log('Skipping empty row...');
      continue;
    }

    const phone = normalizePhone(phoneRaw);
    const isActive = useStatus === 'Yes' || empName === '관리자' || useStatus === '';

    try {
      // Check if worker already exists by name
      const existingRes = await client.query(
        'SELECT worker_id, department, position, role, password_hash FROM worker WHERE worker_name = $1',
        [empName]
      );

      if (existingRes.rows.length > 0) {
        // Update existing worker
        const existing = existingRes.rows[0];
        const deptInfo = getDeptIdAndName(existing.department);

        let passwordHash = existing.password_hash;
        let mustChangePw = false;

        // If password is not set and we have a phone number, set initial password
        if (!passwordHash && phone) {
          passwordHash = await hashPassword(phone);
          mustChangePw = true;
        }

        console.log(`[UPDATE] Existing employee found: ${empName} (ID: ${existing.worker_id}) -> Updating code: ${empCode}, phone: ${phone}`);
        await client.query(
          `UPDATE worker 
           SET employee_no = $1, 
               phone = $2, 
               email = $3, 
               dept_id = $4, 
               department = $5,
               password_hash = $6,
               must_change_pw = COALESCE(must_change_pw, $7),
               is_active = $8,
               updated_at = NOW()
           WHERE worker_id = $9`,
          [
            empCode || null,
            phone || null,
            email || null,
            deptInfo.id,
            deptInfo.name,
            passwordHash,
            mustChangePw,
            isActive,
            existing.worker_id
          ]
        );
        updatedCount++;
      } else {
        // Insert new worker
        const deptInfo = getDeptIdAndName('생산팀'); // Default new workers to Production
        const defaultRole = 'worker';
        const defaultPosition = '사원';

        let passwordHash = null;
        let mustChangePw = false;
        if (phone) {
          passwordHash = await hashPassword(phone);
          mustChangePw = true;
        }

        console.log(`[INSERT] New employee: ${empName} -> Creating with code: ${empCode}, phone: ${phone}`);
        await client.query(
          `INSERT INTO worker (
            employee_no, 
            worker_name, 
            phone, 
            email, 
            dept_id, 
            department, 
            position, 
            role, 
            password_hash, 
            must_change_pw, 
            is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            empCode || null,
            empName,
            phone || null,
            email || null,
            deptInfo.id,
            deptInfo.name,
            defaultPosition,
            defaultRole,
            passwordHash,
            mustChangePw,
            isActive
          ]
        );
        insertedCount++;
      }
    } catch (err) {
      console.error(`Error processing employee ${empName}:`, err.message);
      errorCount++;
    }
  }

  console.log('\n--- UPLOAD SUMMARY ---');
  console.log(`Total rows processed: ${dataRows.length}`);
  console.log(`Successfully updated: ${updatedCount}`);
  console.log(`Successfully inserted: ${insertedCount}`);
  console.log(`Errors encountered: ${errorCount}`);

  await client.end();
}

upload().catch(err => {
  console.error('Fatal upload error:', err);
  process.exit(1);
});
