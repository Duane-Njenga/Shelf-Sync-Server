import { db } from '../db.js';

export async function audit(executor, { userId, action, table, recordId, ipAddress }) {
  const connection = executor || db;
  await connection('audit_logs').insert({
    user_id: userId || null,
    action,
    table_affected: table || null,
    record_id: recordId || null,
    ip_address: ipAddress || null
  });
}
