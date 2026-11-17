import { Router } from 'express';
import { db } from '../db.js';
import { logAudit } from '../utils/audit.js';
import { initiateStkPush } from '../utils/mpesa.js';

const router = Router();

// POST /api/mpesa/stkpush
router.post('/stkpush', async (req, res) => {
  const { fineId, phone } = req.body;

  if (!fineId || !phone) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Fine ID and phone number are required' },
    });
  }

  try {
    const fine = await db('fines').where({ fine_id: fineId }).first();
    if (!fine) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Fine record not found' } });
    }
    if (fine.status === 'Paid') {
      return res.status(400).json({ error: { code: 'ALREADY_PAID', message: 'This fine is already paid' } });
    }

    const stkResult = await initiateStkPush({
      phone,
      amount: fine.amount,
      accountReference: `FINE-${fine.fine_id}`,
      transactionDesc: `ShelfSync Fine #${fine.fine_id}`,
    });

    // Save pending payment record with CheckoutRequestID for callback matching
    const [paymentId] = await db('payments').insert({
      fine_id: fine.fine_id,
      amount_paid: fine.amount,
      payment_method: 'M-Pesa',
      phone_number: stkResult.formattedPhone,
      checkout_request_id: stkResult.checkoutRequestId,
      status: 'Pending',
    });

    await logAudit({
      userId: req.session?.userId || null,
      action: 'MPESA_PROMPT_SENT',
      tableAffected: 'payments',
      recordId: paymentId,
      ipAddress: req.ip,
      details: `Sent STK push of KES ${fine.amount} to ${stkResult.formattedPhone} for Fine #${fine.fine_id}`,
    });

    res.json({
      success: true,
      message: stkResult.customerMessage || 'STK Push sent. Ask the member to enter their M-Pesa PIN.',
      checkoutRequestId: stkResult.checkoutRequestId,
    });
  } catch (err) {
    res.status(500).json({ error: { code: 'MPESA_ERROR', message: err.message } });
  }
});

// POST /api/mpesa/callback (Called directly by Safaricom Daraja servers)
router.post('/callback', async (req, res) => {
  try {
    const stkCallback = req.body?.Body?.stkCallback;
    if (!stkCallback) {
      return res.status(400).json({ ResultCode: 1, ResultDesc: 'Invalid callback payload' });
    }

    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback;
    const payment = await db('payments').where({ checkout_request_id: CheckoutRequestID }).first();

    if (!payment) {
      return res.json({ ResultCode: 0, ResultDesc: 'Accepted (no matching local record)' });
    }

    if (ResultCode === 0) {
      // Extract MpesaReceiptNumber from CallbackMetadata.Item array
      const items = CallbackMetadata?.Item || [];
      const receiptItem = items.find((i) => i.Name === 'MpesaReceiptNumber');
      const mpesaReceiptNo = receiptItem ? String(receiptItem.Value) : null;

      await db('payments').where({ payment_id: payment.payment_id }).update({
        status: 'Completed',
        mpesa_receipt_no: mpesaReceiptNo,
        paid_at: db.fn.now(),
      });

      await db('fines').where({ fine_id: payment.fine_id }).update({
        status: 'Paid',
      });

      await logAudit({
        userId: null,
        action: 'FINE_PAID',
        tableAffected: 'fines',
        recordId: payment.fine_id,
        details: `Fine #${payment.fine_id} settled via M-Pesa (Receipt: ${mpesaReceiptNo || 'N/A'})`,
      });
    } else {
      await db('payments').where({ payment_id: payment.payment_id }).update({
        status: 'Failed',
      });
      console.warn(`M-Pesa STK failed for ${CheckoutRequestID}: ${ResultDesc}`);
    }

    res.json({ ResultCode: 0, ResultDesc: 'Callback processed successfully' });
  } catch (err) {
    console.error('M-Pesa callback error:', err);
    res.status(500).json({ ResultCode: 1, ResultDesc: 'Internal server error' });
  }
});

export default router;