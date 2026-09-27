'use server';

// Pre-registration submit server action.
// Validates payload, mints a registration ID, appends rows to Google Sheets
// (one row per team member). Best-effort: no-ops without Sheets creds so
// local dev + next build work.

import { sheets, type sheets_v4 } from '@googleapis/sheets';
import { GoogleAuth } from 'google-auth-library';
import { registrationSchema, type RegistrationInput } from './schema';
import { buildRegistrationRows } from './registration-row';
import { withSheetsRetry } from './sheets-retry';

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const REGISTRATIONS_TAB = 'Pre-Registrations';

function getSheetsConfig() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
  const sheetId = process.env.DUO_REGISTRATIONS_SHEET_ID;
  if (!email || !rawKey || !sheetId) return null;
  return { email, privateKey: rawKey.replace(/\\n/g, '\n'), sheetId };
}

function sheetsApi(email: string, privateKey: string) {
  const auth = new GoogleAuth({
    credentials: { client_email: email, private_key: privateKey },
    scopes: [SHEETS_SCOPE],
  });
  return sheets({
    version: 'v4',
    auth: auth as unknown as sheets_v4.Options['auth'],
  });
}

export async function submitRegistration(
  payload: RegistrationInput,
): Promise<{ ok: boolean; registrationId?: string }> {
  try {
    const parsed = registrationSchema.safeParse(payload);
    if (!parsed.success) {
      console.error('[duo] registration failed zod validation', parsed.error);
      return { ok: false };
    }

    const registrationId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const rows = buildRegistrationRows(registrationId, parsed.data, timestamp);

    const cfg = getSheetsConfig();
    if (!cfg) {
      console.warn('[duo] Sheets env not set — skipping append (no-op).');
      return { ok: true, registrationId };
    }

    const api = sheetsApi(cfg.email, cfg.privateKey);

    // Check if header row exists — if sheet is empty, add headers first
    const existing = await api.spreadsheets.values.get({
      spreadsheetId: cfg.sheetId,
      range: `'${REGISTRATIONS_TAB}'!A1:N1`,
    });
    if (!existing.data.values || existing.data.values.length === 0) {
      await api.spreadsheets.values.append({
        spreadsheetId: cfg.sheetId,
        range: `'${REGISTRATIONS_TAB}'!A1`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [[
            'Timestamp', 'Registration ID', 'ชื่อทีม/แบรนด์',
            'รายละเอียดสินค้า', 'สมาชิกคนที่', 'จำนวนสมาชิก',
            'ชื่อ-นามสกุล', 'ชื่อเล่น', 'อายุ', 'ระดับชั้น',
            'มหาวิทยาลัย/โรงเรียน', 'เบอร์โทรศัพท์', 'ไลน์ไอดี', 'อีเมล',
          ]],
        },
      });
    }

    await withSheetsRetry(() =>
      api.spreadsheets.values.append({
        spreadsheetId: cfg.sheetId,
        range: `'${REGISTRATIONS_TAB}'!A1`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: rows },
      }),
    );

    return { ok: true, registrationId };
  } catch (err) {
    console.error('[duo] registration submit failed:', err);
    return { ok: false };
  }
}
