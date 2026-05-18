const { google } = require('googleapis');

module.exports = async function handler(req, res) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // 先取得試算表資訊，自動抓第一個工作表名稱
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: process.env.SHEET_ID,
    });
    const sheetName = meta.data.sheets[0].properties.title;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: `${sheetName}!A2:J1000`,
    });

    const rows = response.data.values || [];

    // A=id, B=name, C=type, D=民國日期, E=lunar,
    // F=remark, G=birthTime, H=生肖, I=星座, J=週年
    const data = rows
      .filter(r => r[0])
      .map(r => ({
        id:        r[0] || '',
        name:      r[1] || '',
        type:      r[2] || 'birthday_solar',
        date:      r[3] || '',
        lunar:     r[4] || '',
        remark:    r[5] || '',
        birthTime: r[6] || '',
        shengXiao: r[7] || '',
        starSign:  r[8] || '',
        anniv:     r[9] || '',
      }));

    res.setHeader('Cache-Control', 'no-store');
    res.json(data);
  } catch (err) {
    console.error('read error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
