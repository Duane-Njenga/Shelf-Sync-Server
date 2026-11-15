import { db } from '../db.js';

export async function logAudit({ userId = null, action, tableAffected, recordId = null, ipAddress = null, details = null }) {
  try {
    await db('audit_logs').insert({
      user_id: userId,
      action,
      table_affected: tableAffected,
      record_id: recordId,
      ip_address: ipAddress,
      details,
    });
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}