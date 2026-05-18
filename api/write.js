const { google } = require('googleapis');

const SHEET_NAME = '生日';

function solarToRoc(solarStr) {
  if (!solarStr) return '';
  const [y, m, d] = solarStr.split('-');
  return `${String(parseInt(y) - 1911).padStart(3, '0')}-${m}-${d}`;
}

function toSolar(str) {
  if (!str) return '';
  const parts = str.split('-');
  if (parts[0].length === 4) return str;
  return `${parseInt(parts[0], 10) + 1911}-${parts[1]}-${parts[2]}`;
}

function calcZodiac(solarDateStr) {
  if (!solarDateStr) return { shengXiao: '', starSign: '' };
  const [y, m, d] = solarDateStr.split('-').map(Number);
  const animals = ['鼠','牛','虎','兔','龍','蛇','馬','羊','猴','雞','狗','豬'];
  const cutoffs = [20,19,21,20,21,22,23,23,23,24,23,22];
  const signs   = ['水瓶','雙魚','牡羊','金牛','雙子','巨蟹','獅子','處女','天秤','天蠍','射手','摩羯'];
  let sIdx = m - 1;
  if (d < cutoffs[sIdx]) sIdx = (sIdx + 11) % 12;
  return { shengXiao: animals[(y - 4) % 12], starSign: signs[sIdx] + '座' };
}

function calcAnniv(solarDateStr, type) {
  if (!solarDateStr) return '';
  const [y, m, d] = solarDateStr.split('-').map(Number);
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now < new Date(now.getFullYear(), m - 1, d)) age--;
  age = Math.max(0, age);
  if (type === 'birthday_solar') return `${age} 歲`;
  if (type === 'anniversary')    return `結婚 ${age} 週年`;
  return `第 ${age} 週年`;
}

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

module.exports = async function handler(req, res) {
  try {
    const sheets = await getSheets();
    const sid = process.env.SHEET_ID;

    if (req.method === 'POST') {
      const { id, name, type, date, lunar, birthTime, remark } = req.body;
      const solarDate = toSolar(date);
      const rocDate   = solarToRoc(solarDate);
      const calc      = calcZodiac(solarDate);
      const annivText = calcAnniv(solarDate, type);

      const rowValues = [
        id || Date.now().toString(),
        name || '', type || 'birthday_solar', rocDate,
        (type === 'birthday_solar') ? (lunar || '') : '',
        remark || '', birthTime || '',
        (type === 'birthday_solar') ? calc.shengXiao : '',
        (type === 'birthday_solar') ? calc.starSign  : '',
        annivText,
      ];

      if (id) {
        const existing = await sheets.spreadsheets.values.get({
          spreadsheetId: sid, range: `${SHEET_NAME}!A2:A1000`,
        });
        const rows = existing.data.values || [];
        const rowIndex = rows.findIndex(r => r[0] === id);
        if (rowIndex !== -1) {
          const actualRow = rowIndex + 2;
          await sheets.spreadsheets.values.update({
            spreadsheetId: sid,
            range: `${SHEET_NAME}!A${actualRow}:J${actualRow}`,
            valueInputOption: 'RAW',
            requestBody: { values: [rowValues] },
          });
          return res.json({ ok: true, mode: 'update' });
        }
      }

      rowValues[0] = id || Date.now().toString();
      await sheets.spreadsheets.values.append({
        spreadsheetId: sid,
        range: `${SHEET_NAME}!A:J`,
        valueInputOption: 'RAW',
        requestBody: { values: [rowValues] },
      });
      return res.json({ ok: true, mode: 'create' });
    }

    if (req.method === 'DELETE') {
      const { id } = req.body;
      const existing = await sheets.spreadsheets.values.get({
        spreadsheetId: sid, range: `${SHEET_NAME}!A2:A1000`,
      });
      const rows = existing.data.values || [];
      const rowIndex = rows.findIndex(r => r[0] === id);
      if (rowIndex === -1) return res.status(404).json({ ok: false });

      const meta = await sheets.spreadsheets.get({ spreadsheetId: sid });
      const sheetId = meta.data.sheets.find(s => s.properties.title === SHEET_NAME)?.properties.sheetId ?? 0;

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sid,
        requestBody: { requests: [{ deleteDimension: {
          range: { sheetId, dimension: 'ROWS', startIndex: rowIndex + 1, endIndex: rowIndex + 2 },
        }}]},
      });
      return res.json({ ok: true });
    }

    res.status(405).end();
  } catch (err) {
    console.error('write error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
