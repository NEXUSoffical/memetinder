// Live Serverless Leaderboard Store (Real Swipers & Connected Wallets Only)
const playersMap = new Map();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const playerId = String(body.playerId || '').trim();
      const displayName = String(body.displayName || '').trim();
      const xp = Math.max(0, Number(body.xp) || 0);
      const badge = String(body.badge || '🌱 Lvl 1 Rookie').trim();

      if (playerId && displayName) {
        const existing = playersMap.get(playerId);
        playersMap.set(playerId, {
          playerId,
          displayName,
          xp: existing ? Math.max(existing.xp, xp) : xp,
          badge,
          updatedAt: Date.now()
        });
      }
    } catch (e) {
      // Ignore malformed body
    }
  }

  const leaderboard = Array.from(playersMap.values())
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 20);

  return res.status(200).json({ leaderboard });
}
