export type Chain = 'solana' | 'pumpfun';

export interface SafetyScore {
  isMintRevoked: boolean;
  isFreezeRevoked: boolean;
  isLpBurned: boolean;
  top10HoldersPercent: number;
  score: number; // 0 - 100
  risks?: string[];
  verifiedOnChain?: boolean;
}

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
  safetyScore: SafetyScore;
  sparkline: number[];
  traits: string[];
  devStatus: 'Based Dev' | 'Community Takeover' | 'AI Autonomous' | 'Locked & Loaded';
  verified: boolean;
}

export interface MatchRecord {
  coin: MemeCoin;
  matchedAt: number;
  action: 'ape' | 'superlike';
  txSignature?: string;
  solSpent?: number;
  tokensBought?: number;
  boughtAtPrice?: number;
}

export interface RealHolding {
  coinId: string;
  symbol: string;
  contractAddress: string;
  tokensBought: number;
  solSpent: number;
  boughtAtPrice: number;
  lastTxSignature?: string;
  timestamp: number;
}

export type FilterChain = 'all' | 'solana' | 'pumpfun' | 'microcaps' | 'runners' | 'boosted';
