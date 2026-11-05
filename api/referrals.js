// Serverless Referral Codes & On-Chain Earnings Tracker for MemeTinder (with Cold-Start Memo Recovery)
const TREASURY_WALLET = 'EEjAgWkw5vVgFPvCS31TPhmAXeYjFrSt4awZNfDFsE9V';
const RPC_ENDPOINTS = [
  'https://solana-rpc.publicnode.com',
  'https://api.mainnet-beta.solana.com'
];

const codesMap = new Map(); // code (lowercase) -> { code, walletAddress, createdAt }
const statsMap = new Map(); // walletAddress -> { walletAddress, code, referralsCount, totalEarnedSol, totalTrades }
const usedRefTxHashes = new Set();
let lastRefChainSyncAt = 0;

async function syncReferralsFromChainIfNeeded() {
  const now = Date.now();
  if (now - lastRefChainSyncAt < 45000 && statsMap.size > 0) return;
  lastRefChainSyncAt = now;

  for (const endpoint of RPC_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'mt-ref-sync',
          method: 'getSignaturesForAddress',
          params: [TREASURY_WALLET, { limit: 40, commitment: 'confirmed' }]
        })
      });
      if (!res.ok) continue;
      const data = await res.json();
      const sigs = data?.result;
      if (!Array.isArray(sigs)) continue;

      for (const sigInfo of sigs) {
        if (!sigInfo || sigInfo.err || !sigInfo.signature || !sigInfo.memo) continue;
        if (usedRefTxHashes.has(sigInfo.signature)) continue;

        const match = String(sigInfo.memo).match(/MT_REF:([1-9A-HJ-NP-Za-km-z]{32,44}):(\d+)/);
        if (!match) continue;

        const [, refWallet, lamportsStr] = match;
        const lamports = Number(lamportsStr || 0);
        if (!refWallet || lamports <= 0) continue;

        usedRefTxHashes.add(sigInfo.signature);
        const earnedSol = lamports / 1e9;
        const prev = statsMap.get(refWallet) || {
          walletAddress: refWallet,
          code: '',
          referralsCount: 1,
          totalEarnedSol: 0,
          totalTrades: 0
        };
        prev.totalEarnedSol = Number((prev.totalEarnedSol + earnedSol).toFixed(6));
        prev.totalTrades += 1;
        statsMap.set(refWallet, prev);
      }
      break;
    } catch {}
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  await syncReferralsFromChainIfNeeded();

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

    const allAffiliates = Array.from(statsMap.values()).sort((a, b) => b.totalEarnedSol - a.totalEarnedSol);
    return res.status(200).json({ activeCodes: codesMap.size, affiliates: allAffiliates });
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
        const txHash = String(body.txHash || '').trim();
        if (txHash && usedRefTxHashes.has(txHash)) {
          return res.status(200).json({ ok: true, stats: statsMap.get(referrerWallet) });
        }
        if (referrerWallet && earnedSol > 0 && earnedSol <= 10) {
          if (txHash) usedRefTxHashes.add(txHash);
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
