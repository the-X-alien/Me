const crypto = require('crypto');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { id, title, date, banner, content, password } = req.body;
  if (!id || !title || !date || !content || !password) {
    return res.status(400).json({ error: 'Missing required fields: id, title, date, content, password' });
  }

  const adminPassHash = (process.env.ADMIN_PASS_HASH || '').trim();
  if (!adminPassHash) return res.status(500).json({ error: 'Server not configured: ADMIN_PASS_HASH missing' });

  const inputHash = crypto.createHash('sha256').update(password.trim()).digest('hex');
  if (inputHash !== adminPassHash) {
    return res.status(401).json({
      error: 'Invalid password',
      expectedPrefix: adminPassHash.slice(0, 8),
      gotPrefix: inputHash.slice(0, 8),
    });
  }

  const ghToken = process.env.GH_TOKEN;
  if (!ghToken) return res.status(500).json({ error: 'Server not configured: GH_TOKEN missing' });

  const owner = 'the-X-alien';
  const repo = 'Me';
  const path = 'posts.json';
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

  try {
    const getRes = await fetch(apiUrl, {
      headers: { Authorization: `token ${ghToken}`, 'User-Agent': 'dhiaan-admin' },
    });
    if (!getRes.ok) throw new Error(`GitHub fetch failed: ${getRes.status}`);
    const fileData = await getRes.json();
    const currentContent = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf8'));
    const sha = fileData.sha;

    const newPost = { id, title, date, banner: banner || '', content };
    currentContent.push(newPost);

    const updatedJson = JSON.stringify(currentContent, null, 2);
    const encoded = Buffer.from(updatedJson, 'utf8').toString('base64');

    const commitRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `token ${ghToken}`,
        'User-Agent': 'dhiaan-admin',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Publish post: ${title}`,
        content: encoded,
        sha,
      }),
    });

    if (!commitRes.ok) throw new Error(`GitHub commit failed: ${commitRes.status}`);

    res.status(200).json({ success: true, id, title });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
