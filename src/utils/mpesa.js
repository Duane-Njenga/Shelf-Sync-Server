const BASE_URL =
  process.env.MPESA_ENV === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';

// Normalize Kenyan phone numbers to 2547XXXXXXXX / 2541XXXXXXXX
export function formatKenyanPhone(phone) {
  const cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.startsWith('254') && cleaned.length === 12) return cleaned;
  if (cleaned.startsWith('0') && cleaned.length === 10) return `254${cleaned.slice(1)}`;
  if ((cleaned.startsWith('7') || cleaned.startsWith('1')) && cleaned.length === 9) {
    return `254${cleaned}`;
  }
  return cleaned;
}

// Generate YYYYMMDDHHmmss timestamp
function getTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    now.getFullYear() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds())
  );
}

// 1. Get Daraja OAuth Access Token
export async function getMpesaAccessToken() {
  const key = process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_CONSUMER_SECRET;

  if (!key || !secret) {
    throw new Error('MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET must be set in .env');
  }

  const auth = Buffer.from(`${key}:${secret}`).toString('base64');
  const res = await fetch(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    method: 'GET',
    headers: { Authorization: `Basic ${auth}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to authenticate with Daraja: ${errText}`);
  }

  const data = await res.json();
  return data.access_token;
}

// 2. Initiate Lipa Na M-Pesa STK Push
export async function initiateStkPush({ phone, amount, accountReference, transactionDesc }) {
  const token = await getMpesaAccessToken();
  const shortCode = process.env.MPESA_SHORTCODE || '174379';
  const passkey = process.env.MPESA_PASSKEY;
  const callbackUrl = process.env.MPESA_CALLBACK_URL;

  if (!passkey || !callbackUrl) {
    throw new Error('MPESA_PASSKEY and MPESA_CALLBACK_URL must be set in .env');
  }

  const timestamp = getTimestamp();
  const password = Buffer.from(`${shortCode}${passkey}${timestamp}`).toString('base64');
  const formattedPhone = formatKenyanPhone(phone);

  const payload = {
    BusinessShortCode: shortCode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: Math.ceil(Number(amount)),
    PartyA: formattedPhone,
    PartyB: shortCode,
    PhoneNumber: formattedPhone,
    CallBackURL: callbackUrl,
    AccountReference: accountReference || 'ShelfSyncFine',
    TransactionDesc: transactionDesc || 'Library Overdue Fine Payment',
  };

  const res = await fetch(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok || data.ResponseCode !== '0') {
    throw new Error(data.errorMessage || data.ResponseDescription || 'STK Push failed');
  }

  return {
    checkoutRequestId: data.CheckoutRequestID,
    merchantRequestId: data.MerchantRequestID,
    customerMessage: data.CustomerMessage,
    formattedPhone,
  };
}