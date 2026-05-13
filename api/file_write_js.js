import { google } from 'googleapis';

async function getSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

export default async function handler(req, res) {
  const sheets = await getSheets();
  const sid = process.env.SHEET_ID;

  if (req.method === 'POST') {
    const { name, type, date, lunar, label, birthTime, remark } = req.body;
    const id = Date.now().toString();
    await sheets.spreadsheets.values.append({
      spreadsheetId: sid,
      range: 'Sheet1!A:H',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[id, name, type, date, lunar, label, birthTime || '', remark || '']]
      },
    });
    return res.json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body;
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: sid,
      range: 'Sheet1!A2:A1000',
    });
    const rows = existing.data.values || [];
    const rowIndex = rows.findIndex(r => r[0] === id);
    if (rowIndex === -1) return res.status(404).json({ ok: false });

    const meta = await sheets.spreadsheets.get({ spreadsheetId: sid });
    const sheetId = meta.data.sheets[0].properties.sheetId;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sid,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex + 1,
              endIndex: rowIndex + 2,
            },
          },
        }],
      },
    });
    return res.json({ ok: true });
  }

  res.status(405).end();
}
