import { VersionedTransaction } from '@solana/web3.js';
import { MemeCoin } from './types';
import { WalletService } from './walletService';
import { PortfolioService } from './portfolioService';

export const SOL_MINT = 'So11111111111111111111111111111111111111112';

export interface JupiterQuote {
  inAmountSol: number;
  outAmountTokens: number;
  priceImpactPct: number;
  routeLabel: string;
  minimumReceived: number;
  rawQuote: any;
}

export interface SwapResult {
  success: boolean;
  message: string;
  txHash?: string;
  solscanUrl?: string;
  tokensReceived?: number;
}

export class JupiterService {
  /**
   * Fetches real live quote from Jupiter V1 Aggregator API
   */
  public static async getQuote(tokenMint: string, solAmount: number, slippageBps = 100): Promise<JupiterQuote | null> {
    const lamports = Math.round(solAmount * 1e9);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);

      const url = `https://api.jup.ag/swap/v1/quote?inputMint=${SOL_MINT}&outputMint=${tokenMint}&amount=${lamports}&slippageBps=${slippageBps}`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        if (data.outAmount) {
          const outTokens = parseFloat(data.outAmount) / 1e6; // 6 decimals standard
          const route = data.routePlan?.[0]?.swapInfo?.label || 'Raydium / Meteora';
          return {
            inAmountSol: solAmount,
            outAmountTokens: outTokens,
            priceImpactPct: parseFloat(data.priceImpactPct) || 0.1,
            routeLabel: route,
            minimumReceived: parseFloat(data.otherAmountThreshold || data.outAmount) / 1e6,
            rawQuote: data
          };
        }
      }
    } catch (e) {
      console.warn('Jupiter API quote fetch fallback:', e);
    }

    return null;
  }

  /**
   * Executes a REAL 1-Click Swap on Solana Mainnet via Jupiter & Connected Wallet
   */
  public static async executeSwap(coin: MemeCoin, solAmount: number, quote?: JupiterQuote | null): Promise<SwapResult> {
    const wallet = WalletService.getState();
    if (!wallet.isConnected || !wallet.publicKey) {
      return { 
        success: false, 
        message: 'Please connect your Solana wallet (Phantom or Solflare) to trade real tokens!' 
      };
    }

    const provider = WalletService.getProvider(wallet.providerType || 'phantom');
    if (!provider) {
      return { success: false, message: 'Wallet provider not found in browser.' };
    }

    if (!wallet.balanceLoaded || wallet.solBalance === 0) {
      await WalletService.refreshBalance();
    }

    const latestWallet = WalletService.getState();
    if (latestWallet.balanceLoaded && latestWallet.solBalance < solAmount) {
      return { 
        success: false, 
        message: `Insufficient SOL balance! You have ${latestWallet.solBalance.toFixed(4)} SOL, need ${solAmount} SOL.` 
      };
    }

    try {
      // 1. Ensure we have an active Jupiter quote
      let activeQuote = quote;
      if (!activeQuote || !activeQuote.rawQuote) {
        activeQuote = await this.getQuote(coin.contractAddress, solAmount, 150);
      }

      if (!activeQuote || !activeQuote.rawQuote) {
        return {
          success: false,
          message: 'Could not find a live liquidity route on Jupiter for this token. Try buying directly on Raydium or Pump.fun.'
        };
      }

      // 2. Request real serialized VersionedTransaction from Jupiter API
      const swapRes = await fetch('https://api.jup.ag/swap/v1/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userPublicKey: wallet.publicKey,
          quoteResponse: activeQuote.rawQuote,
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: 'auto'
        })
      });

      if (!swapRes.ok) {
        const errText = await swapRes.text();
        return { success: false, message: `Jupiter Swap error: ${errText.slice(0, 100)}` };
      }

      const { swapTransaction } = await swapRes.json();
      if (!swapTransaction) {
        return { success: false, message: 'Jupiter did not return a valid swap transaction.' };
      }

      // 3. Deserialize into Solana VersionedTransaction
      const txBytes = Uint8Array.from(atob(swapTransaction), c => c.charCodeAt(0));
      const versionedTx = VersionedTransaction.deserialize(txBytes);

      // 4. Request user signature & broadcast on Solana Mainnet
      const { signature } = await provider.signAndSendTransaction(versionedTx);

      if (!signature) {
        return { success: false, message: 'Wallet did not return a transaction signature.' };
      }

      // 5. Update wallet balance & portfolio match bag
      WalletService.refreshBalance();
      PortfolioService.addMatch(coin, 'ape');

      return {
        success: true,
        message: `🎉 Swap broadcasted on Solana Mainnet!`,
        txHash: signature,
        solscanUrl: `https://solscan.io/tx/${signature}`,
        tokensReceived: activeQuote.outAmountTokens
      };
    } catch (err: any) {
      if (err?.code === 4001 || (err?.message && err.message.includes('User rejected'))) {
        return { success: false, message: 'Transaction cancelled in wallet.' };
      }
      return {
        success: false,
        message: err?.message || 'Transaction failed. Check slippage or network congestion.'
      };
    }
  }

  /**
   * Direct Web Swap Link to Jupiter pre-filled with token
   */
  public static getJupiterDirectUrl(tokenMint: string): string {
    return `https://jup.ag/swap/SOL-${tokenMint}`;
  }
}
