import { pool } from '../db/pool.js';

/**
 * 카카오 알림톡/SMS 발송 시뮬레이션 및 데이터베이스 기록 헬퍼
 * @param receiverName 수신자 이름
 * @param receiverPhone 수신자 전화번호
 * @param message 메시지 내용
 */
export async function sendAlimtalk(receiverName: string, receiverPhone: string, message: string): Promise<boolean> {
  const cleanPhone = (receiverPhone || '').trim();
  const cleanName = (receiverName || '').trim();

  console.log(`\n==================================================`);
  console.log(`[ALIMTALK SENDING...]`);
  console.log(`수신자: ${cleanName} (${cleanPhone})`);
  console.log(`내용: ${message}`);
  console.log(`==================================================\n`);

  // 실제 알림톡 API 연동을 하려면 여기에 Solapi 또는 알리고 등의 API 호출 코드를 삽입합니다.
  // 예시 (Solapi/CoolSMS):
  // const sdk = require('coolsms-node-sdk');
  // const messageService = new sdk.default('API_KEY', 'API_SECRET');
  // await messageService.sendOne({ to: cleanPhone, from: '발신번호', text: message, ... });

  try {
    // 1. notification_log 테이블 존재 확인 및 자동 생성
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notification_log (
        log_id SERIAL PRIMARY KEY,
        receiver_name VARCHAR(50),
        receiver_phone VARCHAR(20),
        message TEXT,
        status VARCHAR(20) DEFAULT 'SUCCESS',
        sent_at TIMESTAMPTZ DEFAULT NOW(),
        error_message TEXT
      )
    `);

    // 2. 발송 로그 기록
    await pool.query(
      `INSERT INTO notification_log (receiver_name, receiver_phone, message, status)
       VALUES ($1, $2, $3, 'SUCCESS')`,
      [cleanName, cleanPhone, message]
    );

    return true;
  } catch (err: any) {
    console.error('[ALIMTALK LOG ERROR]', err);
    return false;
  }
}
