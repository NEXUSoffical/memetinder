// Serverless Real-Time Visitor & Wallet Connection Analytics for MemeTinder Admin
const TREASURY_WALLET = 'EEjAgWkw5vVgFPvCS31TPhmAXeYjFrSt4awZNfDFsE9V';
const visitorsMap = new Map(); // visitorId -> { visitorId, device, refSource, walletAddress, walletProvider, solBalance, visitsCount, firstSeen, lastSeen }
const walletsMap = new Map();  // walletAddress -> { walletAddress, providerType, solBalance, handle, refSource, connectedAt, lastSeen }
let totalPageViews = 0;
let totalSwipes = 0;
let totalSwaps = 0;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const now = Date.now();

  if (req.method === 'GET') {
    const adminWallet = String(req.query?.adminWallet || '').trim();
    if (adminWallet !== TREASURY_WALLET) {
      return res.status(403).json({ error: 'Unauthorized: Founder Treasury Wallet required' });
    }
    const visitorsList = Array.from(visitorsMap.values())
      .sort((a, b) => b.lastSeen - a.lastSeen)
      .slice(0, 100);

    const walletsList = Array.from(walletsMap.values())
      .sort((a, b) => b.lastSeen - a.lastSeen)
      .slice(0, 100);

    // Count active visitors in the last 5 minutes
    const onlineNow = Array.from(visitorsMap.values()).filter(v => now - v.lastSeen < 5 * 60 * 1000).length;

    return res.status(200).json({
      summary: {
        totalPageViews,
        uniqueVisitors: visitorsMap.size,
        connectedWallets: walletsMap.size,
        onlineNow,
        totalSwipes,
        totalSwaps
      },
      wallets: walletsList,
      visitors: visitorsList
    });
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const event = String(body.event || '');
      const visitorId = String(body.visitorId || '').trim().slice(0, 64);

      if (event === 'page_view' && visitorId) {
        totalPageViews += 1;
        const ua = String(body.userAgent || req.headers['user-agent'] || '');
        const isMobile = /iPhone|iPad|iPod|Android|Mobile/i.test(ua);
        const device = isMobile ? '📱 Mobile' : '💻 Desktop';
        const refSource = String(body.refSource || 'Direct').slice(0, 50);

        const existing = visitorsMap.get(visitorId);
        visitorsMap.set(visitorId, {
          visitorId,
          device,
          refSource: existing?.refSource && existing.refSource !== 'Direct' ? existing.refSource : refSource,
          walletAddress: existing?.walletAddress || null,
          walletProvider: existing?.walletProvider || null,
          solBalance: existing?.solBalance ?? null,
          visitsCount: (existing?.visitsCount || 0) + 1,
          firstSeen: existing?.firstSeen || now,
          lastSeen: now
        });

        return res.status(200).json({ ok: true });
      }

      if (event === 'wallet_connect') {
        const walletAddress = String(body.walletAddress || '').trim();
        const providerType = String(body.providerType || 'phantom').toUpperCase();
        const solBalance = Number(body.solBalance || 0);
        const handle = String(body.handle || '').trim().slice(0, 24);
        const refSource = String(body.refSource || 'Direct').slice(0, 50);

        if (walletAddress) {
          const prevW = walletsMap.get(walletAddress);
          walletsMap.set(walletAddress, {
            walletAddress,
            providerType,
            solBalance,
            handle: handle || prevW?.handle || '',
            refSource: prevW?.refSource && prevW.refSource !== 'Direct' ? prevW.refSource : refSource,
            connectedAt: prevW?.connectedAt || now,
            lastSeen: now
          });

          if (visitorId && visitorsMap.has(visitorId)) {
            const v = visitorsMap.get(visitorId);
            v.walletAddress = walletAddress;
            v.walletProvider = providerType;
            v.solBalance = solBalance;
            v.lastSeen = now;
            visitorsMap.set(visitorId, v);
          }
        }

        return res.status(200).json({ ok: true });
      }

      if (event === 'swipe') {
        totalSwipes += 1;
        if (visitorId && visitorsMap.has(visitorId)) {
          const v = visitorsMap.get(visitorId);
          v.lastSeen = now;
          visitorsMap.set(visitorId, v);
        }
        return res.status(200).json({ ok: true });
      }

      if (event === 'swap') {
        totalSwaps += 1;
        return res.status(200).json({ ok: true });
      }

      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(400).json({ error: 'Invalid analytics payload' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
