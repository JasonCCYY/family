const { google } = require('googleapis');
const SN = "'生日'";  // Sheet name

function solarToRoc(s) {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  return `${String(+y - 1911).padStart(3, '0')}-${m}-${d}`;
}
function toSolar(s) {
  if (!s) return '';
  const p = s.split('-');
  return p[0].length === 4 ? s : `${+p[0] + 1911}-${p[1]}-${p[2]}`;
}
function zodiac(s) {
  if (!s) return { sx: '', st: '' };
  const [y, m, d] = s.split('-').map(Number);
  const a = ['鼠','牛','虎','兔','龍','蛇','馬','羊','猴','雞','狗','豬'];
  const c = [20,19,21,20,21,22,23,23,23,24,23,22];
  const g = ['水瓶','雙魚','牡羊','金牛','雙子','巨蟹','獅子','處女','天秤','天蠍','射手','摩羯'];
  let si = m - 1; if (d < c[si]) si = (si + 11) % 12;
  return { sx: a[(y - 4) % 12], st: g[si] + '座' };
}
function anniv(s, type) {
  if (!s) return '';
  const [y, m, d] = s.split('-').map(Number);
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now < new Date(now.getFullYear(), m - 1, d)) age--;
  age = Math.max(0, age);
  return type === 'birthday_solar' ? `${age} 歲` : type === 'anniversary' ? `結婚 ${age} 週年` : `第 ${age} 週年`;
}
async function sheets() {
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
    const sh = await sheets();
    const sid = process.env.SHEET_ID;

    if (req.method === 'POST') {
      const { id, name, type, date, lunar, birthTime, remark } = req.body;
      const sol = toSolar(date);
      const z = zodiac(sol);
      const row = [
        id || String(Date.now()), name || '', type || 'birthday_solar',
        solarToRoc(sol),
        type === 'birthday_solar' ? (lunar || '') : '',
        remark || '', birthTime || '',
        type === 'birthday_solar' ? z.sx : '',
        type === 'birthday_solar' ? z.st : '',
        anniv(sol, type),
      ];
      if (id) {
        const ex = await sh.spreadsheets.values.get({ spreadsheetId: sid, range: `${SN}!A2:A1000` });
        const ri = (ex.data.values || []).findIndex(r => r[0] === id);
        if (ri !== -1) {
          await sh.spreadsheets.values.update({
            spreadsheetId: sid, range: `${SN}!A${ri+2}:J${ri+2}`,
            valueInputOption: 'RAW', requestBody: { values: [row] },
          });
          return res.json({ ok: true, mode: 'update' });
        }
      }
      row[0] = id || String(Date.now());
      await sh.spreadsheets.values.append({
        spreadsheetId: sid, range: `${SN}!A:J`,
        valueInputOption: 'RAW', requestBody: { values: [row] },
      });
      return res.json({ ok: true, mode: 'create' });
    }

    if (req.method === 'DELETE') {
      const { id } = req.body;
      const ex = await sh.spreadsheets.values.get({ spreadsheetId: sid, range: `${SN}!A2:A1000` });
      const ri = (ex.data.values || []).findIndex(r => r[0] === id);
      if (ri === -1) return res.status(404).json({ ok: false });
      const meta = await sh.spreadsheets.get({ spreadsheetId: sid });
      const shId = meta.data.sheets.find(s => s.properties.title === '生日')?.properties.sheetId ?? 0;
      await sh.spreadsheets.batchUpdate({
        spreadsheetId: sid,
        requestBody: { requests: [{ deleteDimension: { range: { sheetId: shId, dimension: 'ROWS', startIndex: ri+1, endIndex: ri+2 } } }] },
      });
      return res.json({ ok: true });
    }

    res.status(405).end();
  } catch (err) {
    console.error('write:', err.message);
    res.status(500).json({ error: err.message });
  }
};
