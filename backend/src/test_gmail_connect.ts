import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const user = process.env.GMAIL_USER || 'firemaster532nd@gmail.com';
const pass = process.env.GMAIL_APP_PASS || 'ugyzfvyiealkgiav';

async function testGmailConnection() {
  console.log(`Testing Gmail IMAP & SMTP Connection for ${user}...`);

  // 1. SMTP Test
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  try {
    await transporter.verify();
    console.log('✅ Gmail SMTP Server Connection Verified Successfully!');
  } catch (err) {
    console.error('❌ Gmail SMTP Connection Failed:', err);
  }

  // 2. IMAP Test
  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  try {
    await client.connect();
    console.log('✅ Gmail IMAP Server Connected Successfully!');
    const lock = await client.getMailboxLock('INBOX');
    try {
      const status = await client.status('INBOX', { messages: true, unread: true });
      console.log(`📩 INBOX Status: Total ${status.messages} messages, ${status.unread} unread.`);

      // Fetch last 3 messages
      const messages: any[] = [];
      for await (const message of client.fetch(`${Math.max(1, status.messages - 4)}:*`, { envelope: true, bodyStructure: true })) {
        messages.push({
          uid: message.uid,
          subject: message.envelope.subject,
          from: message.envelope.from?.[0]?.name || message.envelope.from?.[0]?.address,
          date: message.envelope.date,
        });
      }
      console.log('Recent 3 Inbox Messages:');
      console.table(messages);
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (err) {
    console.error('❌ Gmail IMAP Connection Failed:', err);
  }
}

testGmailConnection();
