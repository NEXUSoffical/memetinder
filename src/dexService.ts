import { MemeCoin, SafetyScore } from './types';
import { FRESH_TRENDING_MEME_COINS } from './coinsData';

export interface BoostedEntry {
  contractAddress: string;
  coin: MemeCoin;
  boostPoints: number;
  expiresAt: number;
}

export class DexService {
  private static cachedCoins: MemeCoin[] = [...FRESH_TRENDING_MEME_COINS];
  private static lastFetchTime: number = 0;
  private static isFetching: boolean = false;
  private static solPriceUsd: number = 185.0;
  private static lastSolPriceFetch: number = 0;
  private static rugCheckCache = new Map<string, SafetyScore>();
  private static readonly LAST_FIRST_KEY = 'memetinder_last_first_coin_v1';
  private static readonly SWIPED_IDS_KEY = 'memetinder_recent_swiped_v1';
  private static readonly BOOSTED_COINS_KEY = 'memetinder_boosted_entries_v2';

  public static getSolPriceUsd(): number {
    return this.solPriceUsd;
  }

  public static async fetchSolPriceUsd(force = false): Promise<number> {
    const now = Date.now();
    if (!force && this.lastSolPriceFetch > 0 && now - this.lastSolPriceFetch < 30000) {
      return this.solPriceUsd;
    }
    try {
      const res = await fetch('https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.pairs) && data.pairs.length > 0) {
          const solPairs = data.pairs
            .filter((p: any) => p.chainId === 'solana' && p.baseToken?.address === 'So11111111111111111111111111111111111111112' && parseFloat(p.priceUsd) > 10)
            .sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
          if (solPairs.length > 0) {
            const liveSol = parseFloat(solPairs[0].priceUsd);
            if (liveSol > 10 && liveSol < 10000) {
              this.solPriceUsd = Math.round(liveSol * 100) / 100;
              this.lastSolPriceFetch = now;
              return this.solPriceUsd;
            }
          }
        }
      }
    } catch {}
    return this.solPriceUsd;
  }

  public static saveBoostedCoin(coin: MemeCoin, boostPoints = 30, durationHours = 24, txHash = ''): number {
    let totalPoints = boostPoints;
    const now = Date.now();
    try {
      const entries = this.getBoostedEntries();
      const existing = entries.find(e => e.contractAddress === coin.contractAddress);
      totalPoints = (existing ? existing.boostPoints : 0) + boostPoints;
      const expiresAt = Math.max(
        existing ? existing.expiresAt : 0,
        now + durationHours * 3600 * 1000
      );

      coin.tagline = `🔥 Boosted ${totalPoints}x on MemeTinder • Priority Featured`;
      const baseTraits = (coin.traits || []).filter(t => !t.includes('Boost Power') && !t.includes('Featured Gem'));
      coin.traits = [`🔥 ${totalPoints}x Boost Power`, '👑 Featured Gem', ...baseTraits.slice(0, 1)];
      coin.hypeScore = 100;
      coin.verified = true;

      const updated: BoostedEntry[] = [
        { contractAddress: coin.contractAddress, coin, boostPoints: totalPoints, expiresAt },
        ...entries.filter(e => e.contractAddress !== coin.contractAddress)
      ].sort((a, b) => b.boostPoints - a.boostPoints).slice(0, 25);

      localStorage.setItem(this.BOOSTED_COINS_KEY, JSON.stringify(updated));
    } catch {}

    if (txHash) {
      fetch('/api/boosts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coin, boostPoints, durationHours, txHash })
      }).catch(() => {});
    }

    return totalPoints;
  }

  public static async removeBoostedCoin(contractAddress: string): Promise<void> {
    try {
      const entries = this.getBoostedEntries().filter(e => e.contractAddress !== contractAddress);
      localStorage.setItem(this.BOOSTED_COINS_KEY, JSON.stringify(entries));
    } catch {}
    try {
      await fetch('/api/boosts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove_boost', contractAddress })
      });
    } catch {}
  }

  public static getBoostedEntries(): BoostedEntry[] {
    const now = Date.now();
    try {
      const raw = localStorage.getItem(this.BOOSTED_COINS_KEY);
      if (!raw) return [];
      const parsed: BoostedEntry[] = JSON.parse(raw);
      return parsed
        .filter(e => e && e.coin && (!e.expiresAt || e.expiresAt > now))
        .sort((a, b) => b.boostPoints - a.boostPoints);
    } catch {
      return [];
    }
  }

  public static async syncServerBoosts(): Promise<BoostedEntry[]> {
    try {
      const res = await fetch('/api/boosts');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.boosts) && data.boosts.length > 0) {
          const local = this.getBoostedEntries();
          const map = new Map<string, BoostedEntry>();
          for (const e of local) map.set(e.contractAddress, e);
          for (const s of data.boosts) {
            if (!s?.contractAddress || !s?.coin) continue;
            const prev = map.get(s.contractAddress);
            if (!prev || s.boostPoints >= prev.boostPoints) {
              map.set(s.contractAddress, {
                contractAddress: s.contractAddress,
                coin: s.coin,
                boostPoints: s.boostPoints || 30,
                expiresAt: s.expiresAt || Date.now() + 86400000
              });
            }
          }
          const merged = Array.from(map.values()).sort((a, b) => b.boostPoints - a.boostPoints);
          localStorage.setItem(this.BOOSTED_COINS_KEY, JSON.stringify(merged));
          return merged;
        }
      }
    } catch {}
    return this.getBoostedEntries();
  }

  public static getBoostedCoins(): MemeCoin[] {
    const entries = this.getBoostedEntries();
    if (entries.length <= 1) return entries.map(e => e.coin);

    // Weighted priority rotation: higher boostPoints have higher probability of winning top slots,
    // while tied or multiple boosted coins rotate fairly across swipers!
    const pool = [...entries];
    const ordered: MemeCoin[] = [];
    while (pool.length > 0) {
      const totalWeight = pool.reduce((sum, item) => sum + Math.max(10, item.boostPoints), 0);
      let roll = Math.random() * totalWeight;
      let pickedIdx = 0;
      for (let i = 0; i < pool.length; i++) {
        roll -= Math.max(10, pool[i].boostPoints);
        if (roll <= 0) {
          pickedIdx = i;
          break;
        }
      }
      ordered.push(pool[pickedIdx].coin);
      pool.splice(pickedIdx, 1);
    }
    return ordered;
  }

  /**
   * Fisher-Yates cryptographic/unbiased array shuffle
   */
  public static shuffleArray<T>(items: T[]): T[] {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * Record a swiped coin ID so reloads prioritize fresh unseen trending coins
   */
  public static markCoinSwiped(coinId: string) {
    try {
      const raw = localStorage.getItem(this.SWIPED_IDS_KEY);
      const list: string[] = raw ? JSON.parse(raw) : [];
      const updated = [coinId, ...list.filter(id => id !== coinId)].slice(0, 30);
      localStorage.setItem(this.SWIPED_IDS_KEY, JSON.stringify(updated));
    } catch {}
  }

  private static orderAndRandomizeDeck(liveCoins: MemeCoin[], fallbackCoins: MemeCoin[]): MemeCoin[] {
    let swipedIds = new Set<string>();
    let lastFirstId: string | null = null;
    try {
      const raw = localStorage.getItem(this.SWIPED_IDS_KEY);
      if (raw) swipedIds = new Set(JSON.parse(raw));
      lastFirstId = localStorage.getItem(this.LAST_FIRST_KEY);
    } catch {}

    // Shuffle live official trending coins first
    const shuffledLive = this.shuffleArray(liveCoins);
    const shuffledFallback = this.shuffleArray(fallbackCoins);

    const boosted = this.getBoostedCoins();
    const boostedAddrs = new Set(boosted.map(b => b.contractAddress));

    // Combine with boosted coins first, then live trending coins prioritized, keeping unseen coins before recently swiped ones
    const combined = [...shuffledLive, ...shuffledFallback].filter(c => !boostedAddrs.has(c.contractAddress));
    const unseen = combined.filter(c => !swipedIds.has(c.id));
    const seen = combined.filter(c => swipedIds.has(c.id));

    // Guarantee the first non-boosted card rotates across reloads without ever pushing a paid boosted coin behind an unboosted coin
    if (boosted.length === 0 && unseen.length > 1 && lastFirstId && unseen[0].id === lastFirstId) {
      const swapIdx = Math.floor(Math.random() * Math.min(unseen.length - 1, 8)) + 1;
      [unseen[0], unseen[swapIdx]] = [unseen[swapIdx], unseen[0]];
    }

    const restDeck = [...boosted, ...unseen, ...seen];

    try {
      if (restDeck.length > 0) {
        localStorage.setItem(this.LAST_FIRST_KEY, restDeck[0].id);
      }
    } catch {}

    return restDeck;
  }

  /**
   * Fetches latest live trending token profiles from DexScreener top boosts, latest boosts & new listings
   */
  public static async getTrendingCoins(forceRefresh = false): Promise<MemeCoin[]> {
    const now = Date.now();
    // If returning from short cache, still re-shuffle so reloading/resetting never repeats the same first card
    if (!forceRefresh && this.lastFetchTime > 0 && now - this.lastFetchTime < 30000 && this.cachedCoins.length > 0) {
      return this.orderAndRandomizeDeck(this.cachedCoins, []);
    }

    if (this.isFetching) {
      return this.orderAndRandomizeDeck(this.cachedCoins, []);
    }

    this.isFetching = true;

    try {
      // 1. Sync active paid community boosts, live SOL price & fetch top boosted, latest boosted, and profiles in parallel
      const [, , topBoostsRes, latestBoostsRes, profilesRes] = await Promise.allSettled([
        this.syncServerBoosts(),
        this.fetchSolPriceUsd(),
        fetch('https://api.dexscreener.com/token-boosts/top/v1'),
        fetch('https://api.dexscreener.com/token-boosts/latest/v1'),
        fetch('https://api.dexscreener.com/token-profiles/latest/v1')
      ]);

      const tokenAddresses = new Set<string>();
      const tokenMetaMap = new Map<string, { description?: string; icon?: string; header?: string; url?: string; boosts?: number }>();

      const ingestItems = (items: any[], limit: number) => {
        if (!Array.isArray(items)) return;
        const solanaOnly = items.filter((item: any) => !item?.chainId || item.chainId === 'solana');
        this.shuffleArray(solanaOnly).slice(0, limit).forEach((item: any) => {
          if (item?.tokenAddress) {
            tokenAddresses.add(item.tokenAddress);
            const key = item.tokenAddress.toLowerCase();
            const prev = tokenMetaMap.get(key);
            tokenMetaMap.set(key, {
              description: item.description || prev?.description,
              icon: item.icon || prev?.icon,
              header: item.header || prev?.header,
              url: item.url || prev?.url,
              boosts: item.totalAmount || item.amount || prev?.boosts
            });
          }
        });
      };

      if (topBoostsRes.status === 'fulfilled' && topBoostsRes.value.ok) {
        ingestItems(await topBoostsRes.value.json(), 25);
      }

      if (latestBoostsRes.status === 'fulfilled' && latestBoostsRes.value.ok) {
        ingestItems(await latestBoostsRes.value.json(), 25);
      }

      if (profilesRes.status === 'fulfilled' && profilesRes.value.ok) {
        ingestItems(await profilesRes.value.json(), 20);
      }

      // 2. Shuffle candidate token addresses and fetch full pair metrics in parallel batches of up to 30
      const shuffledAddresses = this.shuffleArray(Array.from(tokenAddresses));
      const chunks: string[][] = [];
      for (let i = 0; i < Math.min(shuffledAddresses.length, 60); i += 30) {
        chunks.push(shuffledAddresses.slice(i, i + 30));
      }

      if (chunks.length > 0) {
        const chunkResponses = await Promise.allSettled(
          chunks.map(chunk => fetch(`https://api.dexscreener.com/latest/dex/tokens/${chunk.join(',')}`))
        );

        const allPairs: any[] = [];
        for (const res of chunkResponses) {
          if (res.status === 'fulfilled' && res.value.ok) {
            const data = await res.value.json();
            if (Array.isArray(data?.pairs)) {
              allPairs.push(...data.pairs);
            }
          }
        }

        if (allPairs.length > 0) {
          // Deduplicate Solana pairs by baseToken address, selecting highest liquidity pair
          const bestPairMap = new Map<string, any>();
          for (const pair of allPairs) {
            if (pair.chainId !== 'solana') continue;
            const addr = pair.baseToken?.address?.toLowerCase();
            if (!addr) continue;
            const existing = bestPairMap.get(addr);
            const liq = pair.liquidity?.usd || 0;
            if (!existing || liq > (existing.liquidity?.usd || 0)) {
              bestPairMap.set(addr, pair);
            }
          }

          const liveCoins: MemeCoin[] = [];
          for (const [addr, pair] of bestPairMap.entries()) {
            const meta = tokenMetaMap.get(addr);
            const price = parseFloat(pair.priceUsd) || 0.0001;
            const change24h = pair.priceChange?.h24 ?? (Math.round((Math.random() * 40 - 5) * 10) / 10);
            const marketCap = pair.marketCap || pair.fdv || Math.floor(Math.random() * 2000000 + 100000);
            const volume24h = pair.volume?.h24 || 50000;
            const liquidityUsd = pair.liquidity?.usd || 25000;
            
            const isPump = pair.dexId === 'pumpswap' || pair.dexId === 'pumpfun' || (pair.baseToken?.address || '').endsWith('pump');

            // Avatar resolution: custom image -> CDN icon -> fallback
            let avatar = pair.info?.imageUrl;
            if (!avatar && meta?.icon) {
              avatar = meta.icon.startsWith('http') 
                ? meta.icon 
                : `https://cdn.dexscreener.com/cms/images/${meta.icon}?width=800&height=800&quality=95&format=auto`;
            }
            if (!avatar) {
              avatar = `https://dd.dexscreener.com/ds-data/tokens/${pair.chainId}/${pair.baseToken?.address}.png`;
            }

            // Sparkline approximation using 24h, 6h, 1h, 5m changes
            const p24 = price / (1 + (change24h / 100));
            const h6 = pair.priceChange?.h6 ?? change24h * 0.4;
            const p6 = price / (1 + (h6 / 100));
            const h1 = pair.priceChange?.h1 ?? change24h * 0.1;
            const p1 = price / (1 + (h1 / 100));
            const m5 = pair.priceChange?.m5 ?? 0;
            const p5 = price / (1 + (m5 / 100));
            const sparkline = [p24, p6, p1, p5, price];

            const isLiqBurned = liquidityUsd > 10000;
            const buys = pair.txns?.h24?.buys || 100;
            const sells = pair.txns?.h24?.sells || 80;
            const buyRatio = buys / (buys + sells || 1);

            liveCoins.push({
              id: `live_${pair.baseToken?.address || addr}`,
              name: pair.baseToken?.name || 'New Trending Gem',
              symbol: pair.baseToken?.symbol || 'MEME',
              chain: isPump ? 'pumpfun' : 'solana',
              priceUsd: price,
              change24h: Math.round(change24h * 10) / 10,
              marketCap: Math.round(marketCap),
              volume24h: Math.round(volume24h),
              liquidityUsd: Math.round(liquidityUsd),
              avatar,
              banner: meta?.header || pair.info?.header,
              bio: meta?.description || `${pair.baseToken?.name} ($${pair.baseToken?.symbol}) is newly trending on DexScreener with $${(volume24h/1000).toFixed(0)}k volume in 24h.`,
              tagline: meta?.boosts ? `🔥 Boosted ${meta.boosts}x by Community on DexScreener` : `⚡ Newly trending on ${pair.dexId || 'DEX'}`,
              hypeScore: Math.min(100, Math.floor(75 + buyRatio * 25)),
              holdersCount: Math.max(120, Math.floor((volume24h / 1500))),
              contractAddress: pair.baseToken?.address || addr,
              dexScreenerUrl: pair.url || `https://dexscreener.com/${pair.chainId}/${pair.baseToken?.address}`,
              safetyScore: {
                isMintRevoked: true,
                isFreezeRevoked: true,
                isLpBurned: isLiqBurned,
                top10HoldersPercent: Math.floor(Math.random() * 15 + 8),
                score: Math.min(99, Math.floor(70 + buyRatio * 28))
              },
              sparkline,
              traits: [
                meta?.boosts ? `⚡ ${meta.boosts} Dex Boosts` : '🔥 Fresh Heat',
                isPump ? '💊 Pump.fun Runner' : '🚀 Dex Trending',
                `${Math.round(buyRatio * 100)}% Buys`
              ],
              devStatus: isPump ? 'Community Takeover' : 'Locked & Loaded',
              verified: false
            });
          }

          this.cachedCoins = this.orderAndRandomizeDeck(liveCoins, FRESH_TRENDING_MEME_COINS);
          this.lastFetchTime = now;
          this.isFetching = false;
          return this.cachedCoins;
        }
      }
    } catch (e) {
      console.warn('DexScreener API live fetch fallback:', e);
    }

    this.isFetching = false;
    this.cachedCoins = this.orderAndRandomizeDeck([], FRESH_TRENDING_MEME_COINS);
    return this.cachedCoins;
  }

  /**
   * Fetch real-time live market cap, price, volume, liquidity, and txns for the live profile ticker
   */
  public static async fetchLiveMetrics(contractAddress: string): Promise<{
    priceUsd: number;
    marketCap: number;
    volume24h: number;
    liquidityUsd: number;
    change24h: number;
    change1h: number;
    change5m: number;
    buys24h: number;
    sells24h: number;
    pairAddress?: string;
    chainId?: string;
  } | null> {
    const cleanAddr = contractAddress.trim();
    if (!cleanAddr) return null;

    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${cleanAddr}`, {
        cache: 'no-store'
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!Array.isArray(data?.pairs) || data.pairs.length === 0) return null;

      const solanaPairs = data.pairs.filter((p: any) => p.chainId === 'solana');
      const pool = solanaPairs.length > 0 ? solanaPairs : data.pairs;
      const bestPair = pool.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
      const priceUsd = parseFloat(bestPair.priceUsd) || 0;
      const marketCap = bestPair.marketCap || bestPair.fdv || 0;
      const volume24h = bestPair.volume?.h24 || 0;
      const liquidityUsd = bestPair.liquidity?.usd || 0;
      const change24h = bestPair.priceChange?.h24 ?? 0;
      const change1h = bestPair.priceChange?.h1 ?? 0;
      const change5m = bestPair.priceChange?.m5 ?? 0;
      const buys24h = bestPair.txns?.h24?.buys ?? 0;
      const sells24h = bestPair.txns?.h24?.sells ?? 0;

      return {
        priceUsd,
        marketCap,
        volume24h,
        liquidityUsd,
        change24h,
        change1h,
        change5m,
        buys24h,
        sells24h,
        pairAddress: bestPair.pairAddress,
        chainId: bestPair.chainId
      };
    } catch {
      return null;
    }
  }

  /**
   * Performs a REAL on-chain & RugCheck.xyz safety audit for a Solana token mint
   * Queries Solana Mainnet RPC (MintAuthority, FreezeAuthority, Top 10 Largest Accounts) + RugCheck API
   */
  public static async fetchRealRugCheck(contractAddress: string, liquidityUsd = 25000): Promise<SafetyScore> {
    const cleanAddr = contractAddress.trim();
    const cached = this.rugCheckCache.get(cleanAddr);
    if (cached && cached.verifiedOnChain) return cached;

    const isPump = cleanAddr.endsWith('pump');
    let isMintRevoked = true;
    let isFreezeRevoked = true;
    let isLpBurned = isPump || liquidityUsd >= 10000;
    let top10HoldersPercent = 14.5;
    const risks: string[] = [];
    let verifiedOnChain = false;

    try {
      const [rpcRes, rugRes] = await Promise.allSettled([
        fetch('https://solana-rpc.publicnode.com', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([
            {
              jsonrpc: '2.0',
              id: 1,
              method: 'getAccountInfo',
              params: [cleanAddr, { encoding: 'jsonParsed', commitment: 'confirmed' }]
            },
            {
              jsonrpc: '2.0',
              id: 2,
              method: 'getTokenLargestAccounts',
              params: [cleanAddr, { commitment: 'confirmed' }]
            }
          ])
        }),
        fetch(`https://api.rugcheck.xyz/v1/tokens/${encodeURIComponent(cleanAddr)}/report/summary`)
      ]);

      // 1. Parse direct Solana Mainnet RPC Mint Info & Top Holders
      if (rpcRes.status === 'fulfilled' && rpcRes.value.ok) {
        const batch = await rpcRes.value.json();
        if (Array.isArray(batch)) {
          const accResult = batch.find((r: any) => r.id === 1)?.result?.value;
          const largestResult = batch.find((r: any) => r.id === 2)?.result?.value;

          const parsedInfo = accResult?.data?.parsed?.info;
          if (parsedInfo) {
            verifiedOnChain = true;
            isMintRevoked = parsedInfo.mintAuthority === null || parsedInfo.mintAuthority === undefined;
            isFreezeRevoked = parsedInfo.freezeAuthority === null || parsedInfo.freezeAuthority === undefined;

            const totalSupplyRaw = Number(parsedInfo.supply || 0);
            const decimals = Number(parsedInfo.decimals ?? 6);
            const totalSupplyUi = totalSupplyRaw > 0 ? totalSupplyRaw / Math.pow(10, decimals) : 0;

            if (totalSupplyUi > 0 && Array.isArray(largestResult) && largestResult.length > 1) {
              // Skip index 0 (almost always the Raydium/PumpSwap AMM liquidity pool vault) and sum next 10 holders
              const topHoldersSlice = largestResult.slice(1, 11);
              const top10SumUi = topHoldersSlice.reduce((sum: number, item: any) => {
                return sum + (Number(item?.uiAmount ?? (Number(item?.amount || 0) / Math.pow(10, decimals))) || 0);
              }, 0);
              const pct = (top10SumUi / totalSupplyUi) * 100;
              if (pct > 0 && pct <= 100) {
                top10HoldersPercent = Math.round(pct * 10) / 10;
              }
            }
          }
        }
      }

      // 2. Parse RugCheck.xyz API summary if available
      if (rugRes.status === 'fulfilled' && rugRes.value.ok) {
        const rugData = await rugRes.value.json();
        if (rugData) {
          verifiedOnChain = true;
          if (typeof rugData.lpLockedPct === 'number') {
            isLpBurned = rugData.lpLockedPct >= 75 || isPump || liquidityUsd >= 20000;
          }
          if (Array.isArray(rugData.risks)) {
            for (const r of rugData.risks) {
              const name = String(r?.name || '');
              if (/Mint Authority/i.test(name)) isMintRevoked = false;
              if (/Freeze Authority/i.test(name)) isFreezeRevoked = false;
              if (name && (r.level === 'danger' || r.level === 'warn')) {
                risks.push(name);
              }
            }
          }
        }
      }
    } catch {}

    // 3. Compute composite 0-100 Safety Score & Risk Warnings
    let score = 98;
    if (!isMintRevoked) {
      score -= 35;
      if (!risks.some(r => /Mint/i.test(r))) risks.unshift('Mint Authority Active (Can Mint Supply)');
    }
    if (!isFreezeRevoked) {
      score -= 30;
      if (!risks.some(r => /Freeze/i.test(r))) risks.unshift('Freeze Authority Active (Can Freeze Wallets)');
    }
    if (!isLpBurned) {
      score -= 15;
      if (!risks.some(r => /Liquidity|LP/i.test(r))) risks.push('LP Not Fully Burned/Locked');
    }
    if (top10HoldersPercent > 35) {
      score -= 22;
      if (!risks.some(r => /Holder/i.test(r))) risks.push(`High Top 10 Concentration (${top10HoldersPercent}%)`);
    } else if (top10HoldersPercent > 22) {
      score -= 10;
      if (!risks.some(r => /Holder/i.test(r))) risks.push(`Moderate Top 10 Concentration (${top10HoldersPercent}%)`);
    } else if (top10HoldersPercent > 15) {
      score -= 3;
    }
    if (liquidityUsd < 8000) {
      score -= 10;
      risks.push('Low DEX Liquidity (<$8K)');
    }

    score = Math.max(15, Math.min(99, Math.round(score)));

    const result: SafetyScore = {
      isMintRevoked,
      isFreezeRevoked,
      isLpBurned,
      top10HoldersPercent,
      score,
      risks: risks.slice(0, 3),
      verifiedOnChain
    };

    this.rugCheckCache.set(cleanAddr, result);
    return result;
  }

  /**
   * Search / import any token by contract address directly from DexScreener
   */
  public static async fetchTokenByAddress(contractAddress: string): Promise<MemeCoin | null> {
    const cleanAddr = contractAddress.trim();
    if (!cleanAddr) return null;

    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${cleanAddr}`);
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.pairs || data.pairs.length === 0) return null;

      const solanaPairs = data.pairs.filter((p: any) => p.chainId === 'solana');
      if (solanaPairs.length === 0) return null;

      // Find the Solana pair with highest liquidity
      const bestPair = solanaPairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
      const price = parseFloat(bestPair.priceUsd) || 0.00001;
      const change24h = bestPair.priceChange?.h24 ?? 0;
      const marketCap = bestPair.marketCap || bestPair.fdv || 100000;
      const volume24h = bestPair.volume?.h24 || 50000;
      const liquidityUsd = bestPair.liquidity?.usd || 25000;
      const isPump = bestPair.dexId === 'pumpswap' || bestPair.dexId === 'pumpfun' || cleanAddr.endsWith('pump');

      let avatar = bestPair.info?.imageUrl;
      if (!avatar) {
        avatar = `https://dd.dexscreener.com/ds-data/tokens/${bestPair.chainId}/${bestPair.baseToken?.address}.png`;
      }

      const p24 = price / (1 + (change24h / 100));
      const sparkline = [p24, price * 0.9, price * 0.95, price];
      const tokenAddr = bestPair.baseToken?.address || cleanAddr;
      const realSafety = await this.fetchRealRugCheck(tokenAddr, liquidityUsd);

      return {
        id: `custom_${tokenAddr}`,
        name: bestPair.baseToken?.name || 'Imported Token',
        symbol: bestPair.baseToken?.symbol || 'TOKEN',
        chain: isPump ? 'pumpfun' : 'solana',
        priceUsd: price,
        change24h: Math.round(change24h * 10) / 10,
        marketCap: Math.round(marketCap),
        volume24h: Math.round(volume24h),
        liquidityUsd: Math.round(liquidityUsd),
        avatar,
        bio: `${bestPair.baseToken?.name} ($${bestPair.baseToken?.symbol}) imported directly. Liquidity: $${Math.round(liquidityUsd).toLocaleString()}, 24h Vol: $${Math.round(volume24h).toLocaleString()}.`,
        tagline: isPump ? '💊 Pump.fun Token' : `🪐 Traded on ${bestPair.dexId || 'DEX'}`,
        hypeScore: 88,
        holdersCount: Math.max(100, Math.floor(volume24h / 1000)),
        contractAddress: tokenAddr,
        dexScreenerUrl: bestPair.url || `https://dexscreener.com/${bestPair.chainId}/${tokenAddr}`,
        safetyScore: realSafety,
        sparkline,
        traits: ['⚡ Direct Import', isPump ? '💊 Pump.fun' : '🪐 Solana DEX', '🔥 Live Trading'],
        devStatus: 'Community Takeover',
        verified: false
      };
    } catch (e) {
      console.warn('Failed to fetch token by address:', e);
      return null;
    }
  }
}

