import { google } from 'googleapis';

// 西元 YYYY-MM-DD → 民國 YYY-MM-DD（存入 Sheet）
function solarToRoc(solarStr) {
  if (!solarStr) return '';
  const [y, m, d] = solarStr.split('-');
  return `${String(parseInt(y) - 1911).padStart(3, '0')}-${m}-${d}`;
}

// 民國或西元 → 西元（兼容）
function toSolar(str) {
  if (!str) return '';
  const parts = str.split('-');
  if (parts[0].length === 4) return str;
  return `${parseInt(parts[0], 10) + 1911}-${parts[1]}-${parts[2]}`;
}

// 生肖 / 星座（後端備用計算）
function calcZodiac(solarDateStr) {
  if (!solarDateStr) return { shengXiao: '', starSign: '' };
  const [y, m, d] = solarDateStr.split('-').map(Number);
  const animals = ['鼠','牛','虎','兔','龍','蛇','馬','羊','猴','雞','狗','豬'];
  const cutoffs = [20,19,21,20,21,22,23,23,23,24,23,22];
  const signs   = ['水瓶','雙魚','牡羊','金牛','雙子','巨蟹','獅子','處女','天秤','天蠍','射手','摩羯'];
  let sIdx = m - 1;
  if (d < cutoffs[sIdx]) sIdx = (sIdx + 11) % 12;
  return {
    shengXiao: animals[(y - 4) % 12],
    starSign: signs[sIdx] + '座'
  };
}

// 計算歲數 / 週年文字
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

export default async function handler(req, res) {
  const sheets = await getSheets();
  const sid = process.env.SHEET_ID;

  // ── 新增 / 修改 ──
  if (req.method === 'POST') {
    const { id, name, type, date, lunar, birthTime, remark, zodiac } = req.body;

    // date 前端傳來是西元格式，存 Sheet 時轉民國
    const solarDate = toSolar(date);
    const rocDate   = solarToRoc(solarDate);

    // 生肖星座：前端已算好，後端再做一次確保正確
    const calc = calcZodiac(solarDate);
    const shengXiao = calc.shengXiao;
    const starSign  = calc.starSign;
    const annivText = calcAnniv(solarDate, type);

    // Sheet 欄位：A=id, B=name, C=type, D=民國日期, E=lunar, F=remark, G=birthTime, H=生肖, I=星座, J=週年
    const rowValues = [
      id || Date.now().toString(),
      name || '',
      type || 'birthday_solar',
      rocDate,
      (type === 'birthday_solar') ? (lunar || '') : '',
      remark || '',
      birthTime || '',
      (type === 'birthday_solar') ? shengXiao : '',
      (type === 'birthday_solar') ? starSign  : '',
      annivText,
    ];

    if (id) {
      const existing = await sheets.spreadsheets.values.get({
        spreadsheetId: sid,
        range: 'Sheet1!A2:A1000',
      });
      const rows = existing.data.values || [];
      const rowIndex = rows.findIndex(r => r[0] === id);

      if (rowIndex !== -1) {
        const actualRow = rowIndex + 2;
        await sheets.spreadsheets.values.update({
          spreadsheetId: sid,
          range: `Sheet1!A${actualRow}:J${actualRow}`,
          valueInputOption: 'RAW',
          requestBody: { values: [rowValues] },
        });
        return res.json({ ok: true, mode: 'update' });
      }
    }

    // 新增
    rowValues[0] = id || Date.now().toString();
    await sheets.spreadsheets.values.append({
      spreadsheetId: sid,
      range: 'Sheet1!A:J',
      valueInputOption: 'RAW',
      requestBody: { values: [rowValues] },
    });
    return res.json({ ok: true, mode: 'create' });
  }

  // ── 刪除 ──
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
            range: { sheetId, dimension: 'ROWS', startIndex: rowIndex + 1, endIndex: rowIndex + 2 },
          },
        }],
      },
    });
    return res.json({ ok: true });
  }

  res.status(405).end();
}
