// Global Serverless Active Token Boosts Pool (Stackable Boost Power & Weighted Rotation)
const activeBoostsMap = new Map();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const now = Date.now();

  // Prune expired boosts
  for (const [ca, item] of activeBoostsMap.entries()) {
    if (item.expiresAt && item.expiresAt < now) {
      activeBoostsMap.delete(ca);
    }
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const coin = body.coin;
      const boostPoints = Math.max(10, Number(body.boostPoints) || 30);
      const durationHours = Math.max(1, Number(body.durationHours) || 24);
      const txHash = String(body.txHash || '').trim();

      if (coin && coin.contractAddress && txHash) {
        const key = String(coin.contractAddress).trim();
        const existing = activeBoostsMap.get(key);
        const totalPoints = (existing ? existing.boostPoints : 0) + boostPoints;
        const expiresAt = Math.max(
          existing ? existing.expiresAt : 0,
          now + durationHours * 3600 * 1000
        );

        coin.tagline = `🔥 Boosted ${totalPoints}x on MemeTinder • Priority Featured`;
        coin.traits = [`🔥 ${totalPoints}x Boost Power`, '👑 Featured Gem', ...(coin.traits || []).slice(0, 1)];
        coin.hypeScore = 100;
        coin.verified = true;

        activeBoostsMap.set(key, {
          contractAddress: key,
          coin,
          boostPoints: totalPoints,
          expiresAt,
          lastTxHash: txHash,
          updatedAt: now
        });
      }
    } catch (e) {
      // Ignore malformed payload
    }
  }

  const boosts = Array.from(activeBoostsMap.values())
    .sort((a, b) => b.boostPoints - a.boostPoints);

  return res.status(200).json({ boosts });
}
