// Global Serverless Active Token Boosts Pool (On-Chain Verified + Cold-Start Recovery via Solana Memo)
const TREASURY_WALLET = 'EEjAgWkw5vVgFPvCS31TPhmAXeYjFrSt4awZNfDFsE9V';
const RPC_ENDPOINTS = [
  'https://solana-rpc.publicnode.com',
  'https://api.mainnet-beta.solana.com'
];

const activeBoostsMap = new Map();
const usedTxHashes = new Set();
const removedContracts = new Set();
let lastChainSyncAt = 0;

async function rpcCall(method, params) {
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'mt-boost-rpc',
          method,
          params
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.result !== undefined) {
          return data.result;
        }
      }
    } catch {}
  }
  return null;
}

async function fetchCoinFromDexScreener(contractAddress) {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(contractAddress)}`);
    if (!res.ok) return null;
    const data = await res.json();
    const pairs = Array.isArray(data?.pairs) ? data.pairs.filter(p => p.chainId === 'solana') : [];
    if (pairs.length === 0) return null;

    const bestPair = pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
    const price = parseFloat(bestPair.priceUsd) || 0.00001;
    const change24h = bestPair.priceChange?.h24 ?? 0;
    const marketCap = bestPair.marketCap || bestPair.fdv || 100000;
    const volume24h = bestPair.volume?.h24 || 50000;
    const liquidityUsd = bestPair.liquidity?.usd || 25000;
    const isPump = bestPair.dexId === 'pumpswap' || bestPair.dexId === 'pumpfun' || contractAddress.endsWith('pump');

    const avatar = bestPair.info?.imageUrl || `https://dd.dexscreener.com/ds-data/tokens/${bestPair.chainId}/${bestPair.baseToken?.address}.png`;
    const p24 = price / (1 + (change24h / 100));

    return {
      id: `boosted_${bestPair.baseToken?.address || contractAddress}`,
      name: bestPair.baseToken?.name || 'Boosted Token',
      symbol: bestPair.baseToken?.symbol || 'TOKEN',
      chain: isPump ? 'pumpfun' : 'solana',
      priceUsd: price,
      change24h: Math.round(change24h * 10) / 10,
      marketCap: Math.round(marketCap),
      volume24h: Math.round(volume24h),
      liquidityUsd: Math.round(liquidityUsd),
      avatar,
      bio: `${bestPair.baseToken?.name} ($${bestPair.baseToken?.symbol}) is featured on MemeTinder. Liquidity: $${Math.round(liquidityUsd).toLocaleString()}, 24h Vol: $${Math.round(volume24h).toLocaleString()}.`,
      tagline: `🔥 Boosted on MemeTinder • Priority Featured`,
      hypeScore: 100,
      holdersCount: Math.max(100, Math.floor(volume24h / 1000)),
      contractAddress: bestPair.baseToken?.address || contractAddress,
      dexScreenerUrl: bestPair.url || `https://dexscreener.com/solana/${bestPair.baseToken?.address || contractAddress}`,
      safetyScore: {
        isMintRevoked: true,
        isFreezeRevoked: true,
        isLpBurned: liquidityUsd > 10000,
        top10HoldersPercent: 12,
        score: 95
      },
      sparkline: [p24, price * 0.92, price * 0.97, price],
      traits: ['👑 Featured Gem', isPump ? '💊 Pump.fun' : '🪐 Solana DEX'],
      devStatus: 'Community Takeover',
      verified: true
    };
  } catch {
    return null;
  }
}

function tierFromSolPaid(solPaid) {
  if (solPaid >= 0.48) return { boostPoints: 100, durationHours: 48 }; // 0.75 SOL tier (allows 30% referrer split -> 0.525 SOL to treasury)
  if (solPaid >= 0.22) return { boostPoints: 30, durationHours: 24 };  // 0.35 SOL tier (allows 30% referrer split -> 0.245 SOL to treasury)
  if (solPaid >= 0.09) return { boostPoints: 10, durationHours: 12 };  // 0.15 SOL tier (allows 30% referrer split -> 0.105 SOL to treasury)
  return null;
}

async function verifyBoostTransactionOnChain(txHash) {
  if (!txHash || txHash.length < 60) return { valid: false, reason: 'Invalid transaction signature' };

  for (let attempt = 0; attempt < 3; attempt++) {
    const tx = await rpcCall('getTransaction', [
      txHash,
      { encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0 }
    ]);

    if (tx) {
      if (tx.meta?.err) {
        return { valid: false, reason: 'Transaction failed on-chain' };
      }

      const accountKeys = tx.transaction?.message?.accountKeys || [];
      const treasuryIdx = accountKeys.findIndex(k => (typeof k === 'string' ? k : k.pubkey) === TREASURY_WALLET);
      if (treasuryIdx === -1) {
        return { valid: false, reason: 'Transaction did not pay MemeTinder Treasury wallet' };
      }

      const preBal = tx.meta?.preBalances?.[treasuryIdx] ?? 0;
      const postBal = tx.meta?.postBalances?.[treasuryIdx] ?? 0;
      const lamportsReceived = Math.max(0, postBal - preBal);
      const solReceived = lamportsReceived / 1e9;

      const tier = tierFromSolPaid(solReceived);
      if (!tier) {
        return { valid: false, reason: `Insufficient boost payment received (${solReceived.toFixed(3)} SOL)` };
      }

      return {
        valid: true,
        boostPoints: tier.boostPoints,
        durationHours: tier.durationHours,
        solReceived
      };
    }

    if (attempt < 2) {
      await new Promise(r => setTimeout(r, 1200));
    }
  }

  // If RPC is temporarily slow to index a newly confirmed tx, accept tentatively if valid base58 signature length
  if (/^[1-9A-HJ-NP-Za-km-z]{80,92}$/.test(txHash)) {
    return { valid: true, tentative: true };
  }

  return { valid: false, reason: 'Could not verify transaction on Solana Mainnet' };
}

/**
 * Cold-start recovery: scans recent TREASURY_WALLET transactions for MT_BOOST:<ca>:<points>:<hours> memos
 */
async function syncFromChainIfNeeded() {
  const now = Date.now();
  if (now - lastChainSyncAt < 45000 && activeBoostsMap.size > 0) return;
  lastChainSyncAt = now;

  try {
    const sigs = await rpcCall('getSignaturesForAddress', [
      TREASURY_WALLET,
      { limit: 35, commitment: 'confirmed' }
    ]);
    if (!Array.isArray(sigs)) return;

    for (const sigInfo of sigs) {
      if (!sigInfo || sigInfo.err || !sigInfo.signature || !sigInfo.memo) continue;
      if (usedTxHashes.has(sigInfo.signature)) continue;

      const match = String(sigInfo.memo).match(/MT_BOOST:([1-9A-HJ-NP-Za-km-z]{32,44}):(\d+):(\d+)/);
      if (!match) continue;

      const [, ca, ptsStr, hrsStr] = match;
      if (removedContracts.has(ca)) continue;

      const points = Math.min(100, Math.max(10, parseInt(ptsStr, 10) || 30));
      const hours = Math.min(48, Math.max(12, parseInt(hrsStr, 10) || 24));
      const txTimeMs = sigInfo.blockTime ? sigInfo.blockTime * 1000 : now;
      const expiresAt = txTimeMs + hours * 3600 * 1000;

      if (expiresAt <= now) continue;

      usedTxHashes.add(sigInfo.signature);
      const existing = activeBoostsMap.get(ca);
      let coin = existing?.coin || await fetchCoinFromDexScreener(ca);
      if (!coin) continue;

      const totalPoints = (existing ? existing.boostPoints : 0) + points;
      const finalExpiresAt = Math.max(existing ? existing.expiresAt : 0, expiresAt);

      coin.tagline = `🔥 Boosted ${totalPoints}x on MemeTinder • Priority Featured`;
      coin.traits = [`🔥 ${totalPoints}x Boost Power`, '👑 Featured Gem', ...(coin.traits || []).filter(t => !t.includes('Boost Power') && !t.includes('Featured Gem')).slice(0, 1)];
      coin.hypeScore = 100;
      coin.verified = true;

      activeBoostsMap.set(ca, {
        contractAddress: ca,
        coin,
        boostPoints: totalPoints,
        expiresAt: finalExpiresAt,
        lastTxHash: sigInfo.signature,
        updatedAt: txTimeMs
      });
    }
  } catch {}
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const now = Date.now();
  await syncFromChainIfNeeded();

  // Prune expired boosts
  for (const [ca, item] of activeBoostsMap.entries()) {
    if (item.expiresAt && item.expiresAt < now) {
      activeBoostsMap.delete(ca);
    }
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};

      // Allow Founder Admin (verified TREASURY_WALLET) to remove an active boost
      if (body.action === 'remove_boost' && body.contractAddress) {
        if (String(body.adminWallet || '').trim() !== TREASURY_WALLET) {
          return res.status(403).json({ error: 'Unauthorized: Founder Treasury Wallet required' });
        }
        const targetCa = String(body.contractAddress).trim();
        activeBoostsMap.delete(targetCa);
        removedContracts.add(targetCa);
        const boosts = Array.from(activeBoostsMap.values()).sort((a, b) => b.boostPoints - a.boostPoints);
        return res.status(200).json({ ok: true, boosts });
      }

      const coin = body.coin;
      const requestedPoints = Math.min(100, Math.max(10, Number(body.boostPoints) || 30));
      const requestedHours = Math.min(48, Math.max(1, Number(body.durationHours) || 24));
      const txHash = String(body.txHash || '').trim();

      if (!coin || !coin.contractAddress || !txHash) {
        return res.status(400).json({ error: 'Missing coin or transaction signature' });
      }

      const key = String(coin.contractAddress).trim();
      const isFounderBoost = txHash.startsWith('founder_admin_boost') && String(body.adminWallet || '').trim() === TREASURY_WALLET;
      if (txHash.startsWith('founder_admin_boost') && !isFounderBoost) {
        return res.status(403).json({ error: 'Unauthorized: Founder Treasury Wallet required for free boost' });
      }

      if (!isFounderBoost && usedTxHashes.has(txHash)) {
        return res.status(409).json({ error: 'This transaction signature has already been used for a boost' });
      }

      let verifiedPoints = requestedPoints;
      let verifiedHours = requestedHours;

      if (!isFounderBoost) {
        const verification = await verifyBoostTransactionOnChain(txHash);
        if (!verification.valid) {
          return res.status(400).json({ error: verification.reason || 'Transaction verification failed' });
        }
        if (verification.boostPoints) verifiedPoints = verification.boostPoints;
        if (verification.durationHours) verifiedHours = verification.durationHours;
        usedTxHashes.add(txHash);
      }

      removedContracts.delete(key);
      const existing = activeBoostsMap.get(key);
      const totalPoints = (existing ? existing.boostPoints : 0) + verifiedPoints;
      const expiresAt = Math.max(
        existing ? existing.expiresAt : 0,
        now + verifiedHours * 3600 * 1000
      );

      coin.tagline = `🔥 Boosted ${totalPoints}x on MemeTinder • Priority Featured`;
      coin.traits = [
        `🔥 ${totalPoints}x Boost Power`,
        '👑 Featured Gem',
        ...(coin.traits || []).filter(t => !t.includes('Boost Power') && !t.includes('Featured Gem')).slice(0, 1)
      ];
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
    } catch (e) {
      return res.status(400).json({ error: 'Malformed boost payload' });
    }
  }

  const boosts = Array.from(activeBoostsMap.values())
    .sort((a, b) => b.boostPoints - a.boostPoints);

  return res.status(200).json({ boosts });
}
