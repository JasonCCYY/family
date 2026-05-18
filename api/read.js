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
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: "'生日'!A2:I1000",
    });
    const rows = (data.values || []).filter(r => r[0]);
    res.setHeader('Cache-Control', 'no-store');
    res.json(rows.map(r => ({
      id:        r[0] || '',
      name:      r[1] || '',
      type:      r[2] || 'birthday_solar',
      date:      r[3] || '',
      lunar:     r[4] || '',
      remark:    r[5] || '',
      birthTime: r[6] || '',
      shengXiao: r[7] || '',
      starSign:  r[8] || '',
    })));
  } catch (err) {
    console.error('read:', err.message);
    res.status(500).json({ error: err.message });
  }
};
