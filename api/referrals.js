// Serverless Referral Codes & On-Chain Earnings Tracker for MemeTinder
const codesMap = new Map(); // code (lowercase) -> { code, walletAddress, createdAt }
const statsMap = new Map(); // walletAddress -> { walletAddress, code, referralsCount, totalEarnedSol, totalTrades }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    const code = String(req.query?.code || '').trim().toLowerCase();
    const wallet = String(req.query?.wallet || '').trim();

    if (code) {
      const entry = codesMap.get(code);
      if (entry) {
        return res.status(200).json({ found: true, code: entry.code, walletAddress: entry.walletAddress });
      }
      return res.status(200).json({ found: false });
    }

    if (wallet) {
      const stats = statsMap.get(wallet) || {
        walletAddress: wallet,
        code: '',
        referralsCount: 0,
        totalEarnedSol: 0,
        totalTrades: 0
      };
      return res.status(200).json(stats);
    }

    return res.status(200).json({ activeCodes: codesMap.size });
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const action = String(body.action || '');

      // 1. Register or update a custom referral code for a wallet
      if (action === 'register_code') {
        const walletAddress = String(body.walletAddress || '').trim();
        const rawCode = String(body.code || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20);
        const cleanKey = rawCode.toLowerCase();

        if (!walletAddress || !cleanKey || cleanKey.length < 2) {
          return res.status(400).json({ error: 'Valid wallet address and code (min 2 chars) required' });
        }

        const existingCodeOwner = codesMap.get(cleanKey);
        if (existingCodeOwner && existingCodeOwner.walletAddress !== walletAddress) {
          return res.status(409).json({ error: 'That referral code is already taken by another wallet!' });
        }

        codesMap.set(cleanKey, {
          code: rawCode,
          walletAddress,
          createdAt: Date.now()
        });

        const prevStats = statsMap.get(walletAddress) || {
          walletAddress,
          code: rawCode,
          referralsCount: 0,
          totalEarnedSol: 0,
          totalTrades: 0
        };
        prevStats.code = rawCode;
        statsMap.set(walletAddress, prevStats);

        return res.status(200).json({ ok: true, stats: prevStats });
      }

      // 2. Record a new referred visitor landing
      if (action === 'record_visit') {
        const referrerWallet = String(body.referrerWallet || '').trim();
        if (referrerWallet) {
          const prevStats = statsMap.get(referrerWallet) || {
            walletAddress: referrerWallet,
            code: '',
            referralsCount: 0,
            totalEarnedSol: 0,
            totalTrades: 0
          };
          prevStats.referralsCount += 1;
          statsMap.set(referrerWallet, prevStats);
        }
        return res.status(200).json({ ok: true });
      }

      // 3. Record an on-chain fee split payout to referrer
      if (action === 'record_earning') {
        const referrerWallet = String(body.referrerWallet || '').trim();
        const earnedSol = Number(body.earnedSol || 0);
        if (referrerWallet && earnedSol > 0) {
          const prevStats = statsMap.get(referrerWallet) || {
            walletAddress: referrerWallet,
            code: '',
            referralsCount: 1,
            totalEarnedSol: 0,
            totalTrades: 0
          };
          prevStats.totalEarnedSol = Number((prevStats.totalEarnedSol + earnedSol).toFixed(6));
          prevStats.totalTrades += 1;
          statsMap.set(referrerWallet, prevStats);
          return res.status(200).json({ ok: true, stats: prevStats });
        }
        return res.status(200).json({ ok: false });
      }

      return res.status(400).json({ error: 'Unknown action' });
    } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
