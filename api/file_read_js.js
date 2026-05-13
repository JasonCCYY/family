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
    range: 'Sheet1!A2:H1000',
  });

  const rows = response.data.values || [];
  const data = rows
    .filter(r => r[0])
    .map(r => ({
      id:        r[0] || '',
      name:      r[1] || '',
      type:      r[2] || 'birthday_solar',
      date:      r[3] || '',
      lunar:     r[4] || '',
      label:     r[5] || '',
      birthTime: r[6] || '',
      remark:    r[7] || '',
    }));

  res.setHeader('Cache-Control', 'no-store');
  res.json(data);
}
