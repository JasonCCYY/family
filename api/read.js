import { google } from 'googleapis';

export default async function handler(req, res) {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID,
    range: 'Sheet1!A2:J1000',
  });

  const rows = response.data.values || [];

  // Sheet 欄位對應：
  // A=id, B=name, C=type, D=民國日期(YYY-MM-DD), E=lunar,
  // F=remark, G=birthTime, H=生肖, I=星座, J=週年
  const data = rows
    .filter(r => r[0])
    .map(r => ({
      id:        r[0] || '',
      name:      r[1] || '',
      type:      r[2] || 'birthday_solar',
      date:      r[3] || '',   // 民國 YYY-MM-DD，前端 rocStorageToSolar() 轉換
      lunar:     r[4] || '',
      remark:    r[5] || '',
      birthTime: r[6] || '',
      shengXiao: r[7] || '',
      starSign:  r[8] || '',
      anniv:     r[9] || '',
    }));

  res.setHeader('Cache-Control', 'no-store');
  res.json(data);
}
