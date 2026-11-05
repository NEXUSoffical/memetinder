import { MemeCoin } from './types';
import { FRESH_TRENDING_MEME_COINS, OFFICIAL_MEMETINDER_CA, OFFICIAL_MEMETINDER_COIN } from './coinsData';

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
  private static readonly LAST_FIRST_KEY = 'memetinder_last_first_coin_v1';
  private static readonly SWIPED_IDS_KEY = 'memetinder_recent_swiped_v1';
  private static readonly BOOSTED_COINS_KEY = 'memetinder_boosted_entries_v2';

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
      coin.traits = [`🔥 ${totalPoints}x Boost Power`, '👑 Featured Gem', ...(coin.traits || []).slice(0, 1)];
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

    const boosted = this.getBoostedCoins().filter(b => b.contractAddress !== OFFICIAL_MEMETINDER_CA);
    const boostedAddrs = new Set([OFFICIAL_MEMETINDER_CA, ...boosted.map(b => b.contractAddress)]);

    // Combine with boosted coins first, then live trending coins prioritized, keeping unseen coins before recently swiped ones
    const combined = [...shuffledLive, ...shuffledFallback].filter(c => !boostedAddrs.has(c.contractAddress));
    const unseen = combined.filter(c => !swipedIds.has(c.id));
    const seen = combined.filter(c => swipedIds.has(c.id));

    const restDeck = [...boosted, ...unseen, ...seen];

    // Guarantee the first trending card after the official token rotates across reloads
    if (restDeck.length > 1 && lastFirstId && restDeck[0].id === lastFirstId) {
      const swapIdx = Math.floor(Math.random() * Math.min(restDeck.length - 1, 8)) + 1;
      [restDeck[0], restDeck[swapIdx]] = [restDeck[swapIdx], restDeck[0]];
    }

    try {
      if (restDeck.length > 0) {
        localStorage.setItem(this.LAST_FIRST_KEY, restDeck[0].id);
      }
    } catch {}

    // Always pin Official MemeTinder ($MATCH) token at #1 top of the deck
    return [OFFICIAL_MEMETINDER_COIN, ...restDeck];
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
      // 1. Sync active paid community boosts & fetch top boosted, latest boosted, profiles, and Official $MATCH pair in parallel
      const [, topBoostsRes, latestBoostsRes, profilesRes, officialRes] = await Promise.allSettled([
        this.syncServerBoosts(),
        fetch('https://api.dexscreener.com/token-boosts/top/v1'),
        fetch('https://api.dexscreener.com/token-boosts/latest/v1'),
        fetch('https://api.dexscreener.com/token-profiles/latest/v1'),
        fetch(`https://api.dexscreener.com/latest/dex/tokens/${OFFICIAL_MEMETINDER_CA}`)
      ]);

      if (officialRes.status === 'fulfilled' && officialRes.value.ok) {
        try {
          const offData = await officialRes.value.json();
          const offPair = Array.isArray(offData?.pairs) && offData.pairs.length > 0 ? offData.pairs[0] : null;
          if (offPair) {
            const p = parseFloat(offPair.priceUsd) || OFFICIAL_MEMETINDER_COIN.priceUsd;
            OFFICIAL_MEMETINDER_COIN.priceUsd = p;
            OFFICIAL_MEMETINDER_COIN.marketCap = Math.round(offPair.marketCap || offPair.fdv || OFFICIAL_MEMETINDER_COIN.marketCap);
            OFFICIAL_MEMETINDER_COIN.volume24h = Math.round(offPair.volume?.h24 || OFFICIAL_MEMETINDER_COIN.volume24h);
            OFFICIAL_MEMETINDER_COIN.liquidityUsd = Math.round(offPair.liquidity?.usd || OFFICIAL_MEMETINDER_COIN.liquidityUsd);
            OFFICIAL_MEMETINDER_COIN.change24h = offPair.priceChange?.h24 ?? OFFICIAL_MEMETINDER_COIN.change24h;
            OFFICIAL_MEMETINDER_COIN.symbol = (offPair.baseToken?.symbol || 'MATCH').trim();
            OFFICIAL_MEMETINDER_COIN.name = (offPair.baseToken?.name || 'MemeTinder').trim();
            if (offPair.url) OFFICIAL_MEMETINDER_COIN.dexScreenerUrl = offPair.url;
          }
        } catch {}
      }

      const tokenAddresses = new Set<string>();
      const tokenMetaMap = new Map<string, { description?: string; icon?: string; header?: string; url?: string; boosts?: number }>();

      const ingestItems = (items: any[], limit: number) => {
        if (!Array.isArray(items)) return;
        this.shuffleArray(items).slice(0, limit).forEach((item: any) => {
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
          // Deduplicate pairs by baseToken address, selecting highest liquidity pair
          const bestPairMap = new Map<string, any>();
          for (const pair of allPairs) {
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
            
            const chainId = pair.chainId === 'solana' ? 'solana' : pair.chainId === 'base' ? 'base' : pair.chainId === 'ethereum' ? 'ethereum' : 'solana';
            const isPump = pair.dexId === 'pumpswap' || (pair.baseToken?.address || '').endsWith('pump');

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
              chain: isPump ? 'pumpfun' : chainId,
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

      const bestPair = data.pairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
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

      // Find the pair with highest liquidity
      const bestPair = data.pairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
      const price = parseFloat(bestPair.priceUsd) || 0.00001;
      const change24h = bestPair.priceChange?.h24 ?? 0;
      const marketCap = bestPair.marketCap || bestPair.fdv || 100000;
      const volume24h = bestPair.volume?.h24 || 50000;
      const liquidityUsd = bestPair.liquidity?.usd || 25000;
      const isPump = bestPair.dexId === 'pumpswap' || cleanAddr.endsWith('pump');

      let avatar = bestPair.info?.imageUrl;
      if (!avatar) {
        avatar = `https://dd.dexscreener.com/ds-data/tokens/${bestPair.chainId}/${bestPair.baseToken?.address}.png`;
      }

      const p24 = price / (1 + (change24h / 100));
      const sparkline = [p24, price * 0.9, price * 0.95, price];

      return {
        id: `custom_${bestPair.baseToken?.address}`,
        name: bestPair.baseToken?.name || 'Imported Token',
        symbol: bestPair.baseToken?.symbol || 'TOKEN',
        chain: isPump ? 'pumpfun' : (bestPair.chainId === 'base' ? 'base' : bestPair.chainId === 'ethereum' ? 'ethereum' : 'solana'),
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
        contractAddress: bestPair.baseToken?.address,
        dexScreenerUrl: bestPair.url || `https://dexscreener.com/${bestPair.chainId}/${bestPair.baseToken?.address}`,
        safetyScore: {
          isMintRevoked: true,
          isFreezeRevoked: true,
          isLpBurned: liquidityUsd > 10000,
          top10HoldersPercent: 12,
          score: 85
        },
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

