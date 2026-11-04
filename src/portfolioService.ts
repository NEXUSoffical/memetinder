import { MatchRecord, MemeCoin, PortfolioState } from './types';

const STORAGE_PORTFOLIO = 'memetinder_portfolio_v1';
const STORAGE_MATCHES = 'memetinder_matches_v1';

export class PortfolioService {
  private static portfolio: PortfolioState = this.loadPortfolio();
  private static matches: MatchRecord[] = this.loadMatches();

  private static loadPortfolio(): PortfolioState {
    try {
      const raw = localStorage.getItem(STORAGE_PORTFOLIO);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      cashUsd: 5000, // $5,000 starter paper balance
      holdings: []
    };
  }

  private static loadMatches(): MatchRecord[] {
    try {
      const raw = localStorage.getItem(STORAGE_MATCHES);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  }

  public static save() {
    try {
      localStorage.setItem(STORAGE_PORTFOLIO, JSON.stringify(this.portfolio));
      localStorage.setItem(STORAGE_MATCHES, JSON.stringify(this.matches));
    } catch (e) {
      console.warn('Failed saving portfolio:', e);
    }
  }

  public static getPortfolio(): PortfolioState {
    return this.portfolio;
  }

  public static getMatches(): MatchRecord[] {
    return this.matches;
  }

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

  public static removeMatch(coinId: string) {
    this.matches = this.matches.filter(m => m.coin.id !== coinId);
    this.save();
  }

  /**
   * Simulates buying a meme coin with paper USD
   */
  public static buyPaper(coin: MemeCoin, amountUsd: number): { success: boolean; message: string } {
    if (this.portfolio.cashUsd < amountUsd) {
      return { success: false, message: `Insufficient paper funds! Balance: $${this.portfolio.cashUsd.toFixed(2)}` };
    }

    this.portfolio.cashUsd -= amountUsd;
    const tokens = amountUsd / coin.priceUsd;

    const holding = this.portfolio.holdings.find(h => h.coinId === coin.id);
    if (holding) {
      holding.amount += tokens;
      holding.investedUsd += amountUsd;
    } else {
      this.portfolio.holdings.push({
        coinId: coin.id,
        symbol: coin.symbol,
        amount: tokens,
        buyPriceUsd: coin.priceUsd,
        investedUsd: amountUsd
      });
    }

    // Also link to match record if exists
    const match = this.matches.find(m => m.coin.id === coin.id);
    if (match) {
      match.simulatedHoldingUsd = (match.simulatedHoldingUsd || 0) + amountUsd;
      match.simulatedBuyPrice = coin.priceUsd;
    }

    this.save();
    return {
      success: true,
      message: `🚀 Aped $${amountUsd.toLocaleString()} into $${coin.symbol}! Received ${tokens > 1000 ? tokens.toLocaleString(undefined, { maximumFractionDigits: 0 }) : tokens.toFixed(4)} tokens.`
    };
  }

  /**
   * Total portfolio net worth including paper cash + current coin holdings value
   */
  public static calculateTotalValue(coinMap: Map<string, MemeCoin>): {
    totalValueUsd: number;
    holdingsValueUsd: number;
    totalInvestedUsd: number;
    pnlUsd: number;
    pnlPercent: number;
  } {
    let holdingsValueUsd = 0;
    let totalInvestedUsd = 0;

    for (const h of this.portfolio.holdings) {
      totalInvestedUsd += h.investedUsd;
      const coin = coinMap.get(h.coinId);
      const currentPrice = coin ? coin.priceUsd : h.buyPriceUsd;
      holdingsValueUsd += h.amount * currentPrice;
    }

    const totalValueUsd = this.portfolio.cashUsd + holdingsValueUsd;
    const pnlUsd = holdingsValueUsd - totalInvestedUsd;
    const pnlPercent = totalInvestedUsd > 0 ? (pnlUsd / totalInvestedUsd) * 100 : 0;

    return {
      totalValueUsd,
      holdingsValueUsd,
      totalInvestedUsd,
      pnlUsd,
      pnlPercent
    };
  }
}
