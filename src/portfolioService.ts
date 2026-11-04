import { MatchRecord, MemeCoin, RealHolding } from './types';

const STORAGE_MATCHES = 'memetinder_matches_v2';
const STORAGE_HOLDINGS = 'memetinder_holdings_v2';

export class PortfolioService {
  private static matches: MatchRecord[] = this.loadMatches();
  private static holdings: RealHolding[] = this.loadHoldings();

  private static loadMatches(): MatchRecord[] {
    try {
      const raw = localStorage.getItem(STORAGE_MATCHES);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  }

  private static loadHoldings(): RealHolding[] {
    try {
      const raw = localStorage.getItem(STORAGE_HOLDINGS);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  }

  public static save() {
    try {
      localStorage.setItem(STORAGE_MATCHES, JSON.stringify(this.matches));
      localStorage.setItem(STORAGE_HOLDINGS, JSON.stringify(this.holdings));
    } catch (e) {
      console.warn('Failed saving user data:', e);
    }
  }

  public static getMatches(): MatchRecord[] {
    return this.matches;
  }

  public static getHoldings(): RealHolding[] {
    return this.holdings;
  }

  /**
   * Records a match when swiped right (ape) or up (superlike)
   */
  public static addMatch(coin: MemeCoin, action: 'ape' | 'superlike'): MatchRecord {
    const existing = this.matches.find(m => m.coin.id === coin.id);
    if (existing) {
      existing.action = action;
      this.save();
      return existing;
    }

    const record: MatchRecord = {
      coin,
      matchedAt: Date.now(),
      action
    };
    this.matches.unshift(record);
    this.save();
    return record;
  }

  /**
   * Logs a real on-chain transaction completed via Jupiter
   */
  public static recordRealTrade(
    coin: MemeCoin,
    solSpent: number,
    txSignature: string,
    tokensBought: number
  ) {
    // Update or add to matches
    const match = this.matches.find(m => m.coin.id === coin.id) || this.addMatch(coin, 'ape');
    match.txSignature = txSignature;
    match.solSpent = (match.solSpent || 0) + solSpent;
    match.tokensBought = (match.tokensBought || 0) + tokensBought;
    match.boughtAtPrice = coin.priceUsd;

    // Record holding
    const existingHolding = this.holdings.find(h => h.coinId === coin.id);
    if (existingHolding) {
      existingHolding.tokensBought += tokensBought;
      existingHolding.solSpent += solSpent;
      existingHolding.lastTxSignature = txSignature;
      existingHolding.timestamp = Date.now();
    } else {
      this.holdings.unshift({
        coinId: coin.id,
        symbol: coin.symbol,
        contractAddress: coin.contractAddress,
        tokensBought,
        solSpent,
        boughtAtPrice: coin.priceUsd,
        lastTxSignature: txSignature,
        timestamp: Date.now()
      });
    }

    this.save();
  }

  public static removeMatch(coinId: string) {
    this.matches = this.matches.filter(m => m.coin.id !== coinId);
    this.save();
  }
}
