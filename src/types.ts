export type Chain = 'solana' | 'ethereum' | 'base' | 'pumpfun';

export interface MemeCoin {
  id: string;
  name: string;
  symbol: string;
  chain: Chain;
  priceUsd: number;
  change24h: number;
  marketCap: number;
  volume24h: number;
  liquidityUsd: number;
  avatar: string;
  banner?: string;
  bio: string;
  tagline: string;
  hypeScore: number; // 0 - 100
  holdersCount: number;
  contractAddress: string;
  dexScreenerUrl: string;
  safetyScore: {
    isMintRevoked: boolean;
    isFreezeRevoked: boolean;
    isLpBurned: boolean;
    top10HoldersPercent: number;
    score: number; // 0 - 100
  };
  sparkline: number[];
  traits: string[];
  devStatus: 'Based Dev' | 'Community Takeover' | 'AI Autonomous' | 'Locked & Loaded';
  verified: boolean;
}

export interface MatchRecord {
  coin: MemeCoin;
  matchedAt: number;
  action: 'ape' | 'superlike';
  simulatedHoldingUsd?: number;
  simulatedBuyPrice?: number;
}

export interface PortfolioState {
  cashUsd: number;
  holdings: Array<{
    coinId: string;
    symbol: string;
    amount: number;
    buyPriceUsd: number;
    investedUsd: number;
  }>;
}

export type FilterChain = 'all' | 'solana' | 'ethereum' | 'base' | 'pumpfun' | 'top_gainers';
