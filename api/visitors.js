const active = new Map();

module.exports = (req, res) => {
  const action = req.query.action;
  const session = req.query.session || '';
  const now = Date.now();

  if (action === 'enter' && session) active.set(session, now);
  else if (action === 'leave' && session) active.delete(session);
  else if (action === 'heartbeat' && session) {
    if (active.has(session)) active.set(session, now);
  }

  for (const [id, t] of active) {
    if (now - t > 120000) active.delete(id);
  }

  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({ count: active.size });
};
