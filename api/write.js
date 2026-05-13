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
    const { id, name, type, date, lunar, label, birthTime, remark } = req.body;

    // 1. 若有傳入 id，代表是「修改舊資料」
    if (id) {
      // 先找出這個 id 在試算表的第幾行
      const existing = await sheets.spreadsheets.values.get({
        spreadsheetId: sid,
        range: 'Sheet1!A2:A1000',
      });
      const rows = existing.data.values || [];
      const rowIndex = rows.findIndex(r => r[0] === id);

      if (rowIndex !== -1) {
        // 找到舊資料了！直接在該行進行「原地覆蓋」 (因為從 A2 開始算，所以實際行號是 rowIndex + 2)
        const actualRowNumber = rowIndex + 2;
        await sheets.spreadsheets.values.update({
          spreadsheetId: sid,
          range: `Sheet1!A${actualRowNumber}:H${actualRowNumber}`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [[id, name, type, date, lunar, label || '', birthTime || '', remark || '']]
          },
        });
        return res.json({ ok: true, mode: 'update' });
      }
    }

    // 2. 如果沒有 id 或找不到舊資料，代表是「新增一筆」
    const newId = id || Date.now().toString();
    await sheets.spreadsheets.values.append({
      spreadsheetId: sid,
      range: 'Sheet1!A:H',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[newId, name, type, date, lunar, label || '', birthTime || '', remark || '']]
      },
    });
    return res.json({ ok: true, mode: 'create' });
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
