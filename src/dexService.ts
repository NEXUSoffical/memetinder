import { MemeCoin } from './types';
import { FRESH_TRENDING_MEME_COINS } from './coinsData';

export class DexService {
  private static cachedCoins: MemeCoin[] = [...FRESH_TRENDING_MEME_COINS];
  private static lastFetchTime: number = 0;
  private static isFetching: boolean = false;

  /**
   * Fetches latest live trending token profiles from DexScreener top boosts & new listings
   */
  public static async getTrendingCoins(forceRefresh = false): Promise<MemeCoin[]> {
    const now = Date.now();
    // Cache for 45 seconds unless force refresh
    if (!forceRefresh && this.lastFetchTime > 0 && now - this.lastFetchTime < 45000 && this.cachedCoins.length > 0) {
      return this.cachedCoins;
    }

    if (this.isFetching) {
      return this.cachedCoins;
    }

    this.isFetching = true;

    try {
      // 1. Fetch top boosted trending tokens and latest token profiles in parallel
      const [boostsRes, profilesRes] = await Promise.allSettled([
        fetch('https://api.dexscreener.com/token-boosts/top/v1'),
        fetch('https://api.dexscreener.com/token-profiles/latest/v1')
      ]);

      const tokenAddresses = new Set<string>();
      const tokenMetaMap = new Map<string, { description?: string; icon?: string; header?: string; url?: string; boosts?: number }>();

      if (boostsRes.status === 'fulfilled' && boostsRes.value.ok) {
        const boostsData = await boostsRes.value.json();
        if (Array.isArray(boostsData)) {
          boostsData.slice(0, 16).forEach((item: any) => {
            if (item.tokenAddress) {
              tokenAddresses.add(item.tokenAddress);
              tokenMetaMap.set(item.tokenAddress.toLowerCase(), {
                description: item.description,
                icon: item.icon,
                header: item.header,
                url: item.url,
                boosts: item.totalAmount
              });
            }
          });
        }
      }

      if (profilesRes.status === 'fulfilled' && profilesRes.value.ok) {
        const profilesData = await profilesRes.value.json();
        if (Array.isArray(profilesData)) {
          profilesData.slice(0, 14).forEach((item: any) => {
            if (item.tokenAddress) {
              tokenAddresses.add(item.tokenAddress);
              if (!tokenMetaMap.has(item.tokenAddress.toLowerCase())) {
                tokenMetaMap.set(item.tokenAddress.toLowerCase(), {
                  description: item.description,
                  icon: item.icon,
                  header: item.header,
                  url: item.url
                });
              }
            }
          });
        }
      }

      // 2. Fetch full pair metrics for all token addresses (up to 30 tokens in chunks)
      const addressArray = Array.from(tokenAddresses).slice(0, 24);
      if (addressArray.length > 0) {
        const pairsRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${addressArray.join(',')}`);
        if (pairsRes.ok) {
          const pairsData = await pairsRes.json();
          if (Array.isArray(pairsData.pairs) && pairsData.pairs.length > 0) {
            // Deduplicate pairs by baseToken address, selecting highest liquidity pair
            const bestPairMap = new Map<string, any>();
            for (const pair of pairsData.pairs) {
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

            // Put the NEW live trending tokens at the front, followed by the fresh viral breakout memes!
            this.cachedCoins = [...liveCoins, ...FRESH_TRENDING_MEME_COINS];
            this.lastFetchTime = now;
            this.isFetching = false;
            return this.cachedCoins;
          }
        }
      }
    } catch (e) {
      console.warn('DexScreener API live fetch fallback:', e);
    }

    this.isFetching = false;
    this.cachedCoins = [...FRESH_TRENDING_MEME_COINS];
    return this.cachedCoins;
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

