module.exports = function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { password } = req.body;
  res.json({ ok: password === process.env.SITE_PASSWORD });
};
