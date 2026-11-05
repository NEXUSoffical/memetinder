import { VersionedTransaction, Transaction, TransactionInstruction, SystemProgram, PublicKey } from '@solana/web3.js';
import { MemeCoin } from './types';
import { WalletService } from './walletService';
import { PortfolioService } from './portfolioService';
import { DexService } from './dexService';

export const SOL_MINT = 'So11111111111111111111111111111111111111112';
export const TREASURY_WALLET = 'EEjAgWkw5vVgFPvCS31TPhmAXeYjFrSt4awZNfDFsE9V';
export const PLATFORM_FEE_BPS = 80; // 0.8% platform fee on 1-Click Swaps
export const REFERRER_SHARE = 0.30; // 30% of fees go directly to the referrer wallet on-chain
export const REFERRER_STORAGE_KEY = 'memetinder_referrer_wallet_v1';

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
  private static readonly JUP_ENDPOINTS = [
    'https://lite-api.jup.ag/swap/v1',
    'https://api.jup.ag/swap/v1'
  ];
  private static referrerFundedCache = new Map<string, boolean>();

  public static async isReferrerTransferSafe(referrerWallet: string | null, referrerLamports: number): Promise<boolean> {
    if (!referrerWallet || referrerLamports <= 0) return false;
    // Solana rent-exempt minimum for a 0-byte system account is 890,880 lamports (~0.00089088 SOL).
    // Any transfer >= 890,880 lamports is always valid even if the recipient wallet has 0 SOL.
    if (referrerLamports >= 890880) return true;
    if (this.referrerFundedCache.get(referrerWallet) === true) return true;

    try {
      const res = await fetch(`/api/balance?pubkey=${encodeURIComponent(referrerWallet)}`);
      if (res.ok) {
        const data = await res.json();
        const bal = Number(data?.sol || 0);
        if (bal >= 0.00089) {
          this.referrerFundedCache.set(referrerWallet, true);
          return true;
        }
        return false;
      }
    } catch {}
    return true;
  }

  public static getActiveReferrerWallet(userPubkey: string): string | null {
    try {
      const refWallet = (localStorage.getItem(REFERRER_STORAGE_KEY) || '').trim();
      if (!refWallet || refWallet === userPubkey || refWallet === TREASURY_WALLET) return null;
      // Validate valid base58 Solana PublicKey
      new PublicKey(refWallet);
      return refWallet;
    } catch {
      return null;
    }
  }

  public static recordReferralEarning(referrerWallet: string, earnedSol: number) {
    if (!referrerWallet || earnedSol <= 0) return;
    fetch('/api/referrals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'record_earning',
        referrerWallet,
        earnedSol
      })
    }).catch(() => {});
  }

  private static ensureWritableAccountIndex(msg: any, targetPubkey: PublicKey): number {
    let idx = msg.staticAccountKeys.findIndex((k: PublicKey) => k.equals(targetPubkey));
    if (idx === -1) {
      const insertIdx = msg.staticAccountKeys.length - msg.header.numReadonlyUnsignedAccounts;
      msg.staticAccountKeys.splice(insertIdx, 0, targetPubkey);
      for (const ix of msg.compiledInstructions) {
        if (ix.programIdIndex >= insertIdx) ix.programIdIndex += 1;
        ix.accountKeyIndexes = ix.accountKeyIndexes.map((kIdx: number) => kIdx >= insertIdx ? kIdx + 1 : kIdx);
      }
      idx = insertIdx;
    }
    return idx;
  }

  /**
   * Safely appends the 0.8% platform fee instruction (and 30% on-chain referral split if referred)
   */
  private static async attachPlatformFeeInstruction(versionedTx: VersionedTransaction, feeLamports: number, userPubkey: string): Promise<{ referrerWallet: string | null; referrerSol: number }> {
    if (feeLamports <= 0 || userPubkey === TREASURY_WALLET) {
      return { referrerWallet: null, referrerSol: 0 };
    }
    try {
      const msg = versionedTx.message as any;
      const treasuryPubkey = new PublicKey(TREASURY_WALLET);
      const sysPubkey = SystemProgram.programId;
      const computeBudgetPubkey = new PublicKey('ComputeBudget111111111111111111111111111111');
      const sysIdx = msg.staticAccountKeys.findIndex((k: PublicKey) => k.equals(sysPubkey));

      if (sysIdx !== -1 && Array.isArray(msg.compiledInstructions)) {
        // Bump SetComputeUnitLimit (ix discriminator 0x02) by +25,000 CU so extra transfer(s) never hit CU cap
        const cbIdx = msg.staticAccountKeys.findIndex((k: PublicKey) => k.equals(computeBudgetPubkey));
        if (cbIdx !== -1) {
          for (const ix of msg.compiledInstructions) {
            if (ix.programIdIndex === cbIdx && ix.data && ix.data.length === 5 && ix.data[0] === 2) {
              const view = new DataView(ix.data.buffer, ix.data.byteOffset, ix.data.byteLength);
              const currentUnits = view.getUint32(1, true);
              view.setUint32(1, currentUnits + 25000, true);
            }
          }
        }

        const candidateReferrer = this.getActiveReferrerWallet(userPubkey);
        const candidateLamports = candidateReferrer ? Math.floor(feeLamports * REFERRER_SHARE) : 0;
        const canSplitToReferrer = await this.isReferrerTransferSafe(candidateReferrer, candidateLamports);

        const referrerWallet = canSplitToReferrer ? candidateReferrer : null;
        const referrerLamports = canSplitToReferrer ? candidateLamports : 0;
        const treasuryLamports = feeLamports - referrerLamports;

        const treasuryIdx = this.ensureWritableAccountIndex(msg, treasuryPubkey);
        let referrerIdx = -1;
        let referrerPubkey: PublicKey | null = null;
        if (referrerWallet && referrerLamports > 0) {
          referrerPubkey = new PublicKey(referrerWallet);
          referrerIdx = this.ensureWritableAccountIndex(msg, referrerPubkey);
        }

        const finalSysIdx = msg.staticAccountKeys.findIndex((k: PublicKey) => k.equals(sysPubkey));
        const finalTreasuryIdx = msg.staticAccountKeys.findIndex((k: PublicKey) => k.equals(treasuryPubkey));

        if (treasuryLamports > 0) {
          const transferIx = SystemProgram.transfer({
            fromPubkey: msg.staticAccountKeys[0],
            toPubkey: treasuryPubkey,
            lamports: treasuryLamports
          });
          msg.compiledInstructions.push({
            programIdIndex: finalSysIdx,
            accountKeyIndexes: [0, finalTreasuryIdx !== -1 ? finalTreasuryIdx : treasuryIdx],
            data: Uint8Array.from(transferIx.data)
          });
        }

        if (referrerPubkey && referrerLamports > 0) {
          const finalRefIdx = msg.staticAccountKeys.findIndex((k: PublicKey) => k.equals(referrerPubkey!));
          const refTransferIx = SystemProgram.transfer({
            fromPubkey: msg.staticAccountKeys[0],
            toPubkey: referrerPubkey,
            lamports: referrerLamports
          });
          msg.compiledInstructions.push({
            programIdIndex: finalSysIdx,
            accountKeyIndexes: [0, finalRefIdx !== -1 ? finalRefIdx : referrerIdx],
            data: Uint8Array.from(refTransferIx.data)
          });
          return { referrerWallet, referrerSol: referrerLamports / 1e9 };
        }
      }
    } catch (feeErr) {
      console.warn('Skipping platform fee instruction fallback:', feeErr);
    }
    return { referrerWallet: null, referrerSol: 0 };
  }

  /**
   * Fetches real live quote from Jupiter V1 Aggregator API with multi-endpoint fallback
   */
  public static async getQuote(tokenMint: string, solAmount: number, slippageBps = 250, tokenPriceUsd = 0): Promise<JupiterQuote | null> {
    if (tokenMint === SOL_MINT) return null;
    const netSolAmount = solAmount * (1 - PLATFORM_FEE_BPS / 10000);
    const lamports = Math.max(1000, Math.round(netSolAmount * 1e9));

    for (const baseUrl of this.JUP_ENDPOINTS) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4500);

        const url = `${baseUrl}/quote?inputMint=${SOL_MINT}&outputMint=${tokenMint}&amount=${lamports}&slippageBps=${slippageBps}`;
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        if (res.ok) {
          const data = await res.json();
          if (data.outAmount) {
            const rawOut = parseFloat(data.outAmount);
            let decimals = 6;
            const swapUsd = parseFloat(data.swapUsdValue) || (netSolAmount * DexService.getSolPriceUsd());
            if (tokenPriceUsd > 0 && swapUsd > 0 && rawOut > 0) {
              const approxUiTokens = swapUsd / tokenPriceUsd;
              const estDec = Math.round(Math.log10(rawOut / approxUiTokens));
              if (estDec >= 0 && estDec <= 12) {
                decimals = estDec;
              }
            }
            const divisor = Math.pow(10, decimals);
            const outTokens = rawOut / divisor;
            const route = data.routePlan?.[0]?.swapInfo?.label || 'Raydium / Meteora';
            return {
              inAmountSol: solAmount,
              outAmountTokens: outTokens,
              priceImpactPct: parseFloat(data.priceImpactPct) || 0.1,
              routeLabel: route,
              minimumReceived: parseFloat(data.otherAmountThreshold || data.outAmount) / divisor,
              rawQuote: data
            };
          }
        }
      } catch (e) {
        console.warn(`Jupiter quote fallback (${baseUrl}):`, e);
      }
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
      // 1. Always fetch a fresh quote with 2.5% slippage right before building swap tx so pool state isn't stale
      let activeQuote = await this.getQuote(coin.contractAddress, solAmount, 250, coin.priceUsd);
      if (!activeQuote || !activeQuote.rawQuote) {
        activeQuote = quote || null;
      }

      if (!activeQuote || !activeQuote.rawQuote) {
        return {
          success: false,
          message: 'Could not find a live Solana liquidity route on Jupiter for this token (make sure it is a Solana token with active liquidity).'
        };
      }

      // 2. Request real serialized VersionedTransaction from Jupiter API (with endpoint fallback)
      let swapTransaction: string | null = null;
      let lastSwapErr = '';

      for (const baseUrl of this.JUP_ENDPOINTS) {
        try {
          const swapRes = await fetch(`${baseUrl}/swap`, {
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

          if (swapRes.ok) {
            const json = await swapRes.json();
            if (json?.swapTransaction) {
              swapTransaction = json.swapTransaction;
              break;
            }
          } else {
            lastSwapErr = await swapRes.text();
          }
        } catch (e: any) {
          lastSwapErr = e?.message || 'Network error';
        }
      }

      if (!swapTransaction) {
        return { success: false, message: `Jupiter Swap error: ${lastSwapErr.slice(0, 100) || 'Failed to build transaction'}` };
      }

      // 3. Deserialize into Solana VersionedTransaction & bundle 0.8% SOL platform fee to Treasury
      const txBytes = Uint8Array.from(atob(swapTransaction), c => c.charCodeAt(0));
      const versionedTx = VersionedTransaction.deserialize(txBytes);

      const feeLamports = Math.floor(solAmount * 1e9 * (PLATFORM_FEE_BPS / 10000));
      const refSplit = await this.attachPlatformFeeInstruction(versionedTx, feeLamports, wallet.publicKey);

      // 4. Request user signature & broadcast on Solana Mainnet
      const { signature } = await provider.signAndSendTransaction(versionedTx);

      if (!signature) {
        return { success: false, message: 'Wallet did not return a transaction signature.' };
      }

      if (refSplit.referrerWallet && refSplit.referrerSol > 0) {
        this.recordReferralEarning(refSplit.referrerWallet, refSplit.referrerSol);
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
   * Executes a REAL 1-Click Sell (Token -> SOL) on Solana Mainnet via Jupiter & Connected Wallet
   */
  public static async executeSellToSol(coin: MemeCoin, sellPercent = 100): Promise<SwapResult> {
    const wallet = WalletService.getState();
    if (!wallet.isConnected || !wallet.publicKey) {
      return {
        success: false,
        message: 'Please connect your Solana wallet first to sell tokens!'
      };
    }

    const provider = WalletService.getProvider(wallet.providerType || 'phantom');
    if (!provider) {
      return { success: false, message: 'Wallet provider not found in browser.' };
    }

    try {
      // 1. Query real on-chain SPL token balance in user's wallet
      const tokenBal = await WalletService.getTokenBalance(coin.contractAddress);
      const totalRaw = BigInt(tokenBal.rawAmount || '0');

      if (totalRaw <= 0n) {
        return {
          success: false,
          message: `You don't hold any $${coin.symbol} in your connected wallet yet!`
        };
      }

      const sellRaw = sellPercent >= 100 ? totalRaw : (totalRaw * BigInt(sellPercent)) / 100n;
      if (sellRaw <= 0n) {
        return { success: false, message: 'Sell amount too small.' };
      }

      // 2. Fetch Jupiter Quote (Token -> SOL) across endpoints
      let quoteData: any = null;
      for (const baseUrl of this.JUP_ENDPOINTS) {
        try {
          const quoteUrl = `${baseUrl}/quote?inputMint=${coin.contractAddress}&outputMint=${SOL_MINT}&amount=${sellRaw.toString()}&slippageBps=250`;
          const quoteRes = await fetch(quoteUrl);
          if (quoteRes.ok) {
            const d = await quoteRes.json();
            if (d?.outAmount) {
              quoteData = d;
              break;
            }
          }
        } catch {}
      }

      if (!quoteData?.outAmount) {
        return { success: false, message: 'No active SOL liquidity route found for selling.' };
      }

      const outLamports = Number(quoteData.outAmount || 0);
      const solReceived = outLamports / 1e9;

      // 3. Request serialized VersionedTransaction from Jupiter
      let swapTransaction: string | null = null;
      for (const baseUrl of this.JUP_ENDPOINTS) {
        try {
          const swapRes = await fetch(`${baseUrl}/swap`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userPublicKey: wallet.publicKey,
              quoteResponse: quoteData,
              wrapAndUnwrapSol: true,
              dynamicComputeUnitLimit: true,
              prioritizationFeeLamports: 'auto'
            })
          });
          if (swapRes.ok) {
            const json = await swapRes.json();
            if (json?.swapTransaction) {
              swapTransaction = json.swapTransaction;
              break;
            }
          }
        } catch {}
      }

      if (!swapTransaction) {
        return { success: false, message: 'Jupiter did not return a valid sell transaction.' };
      }

      const txBytes = Uint8Array.from(atob(swapTransaction), c => c.charCodeAt(0));
      const versionedTx = VersionedTransaction.deserialize(txBytes);

      // 4. Bundle 0.8% SOL platform fee on Sell proceeds to TREASURY_WALLET (with 30% referral split if applicable)
      const feeLamports = Math.floor(outLamports * (PLATFORM_FEE_BPS / 10000));
      const refSplit = await this.attachPlatformFeeInstruction(versionedTx, feeLamports, wallet.publicKey);

      // 5. Request wallet signature & broadcast on Solana Mainnet
      const { signature } = await provider.signAndSendTransaction(versionedTx);
      if (!signature) {
        return { success: false, message: 'Wallet did not return a transaction signature.' };
      }

      if (refSplit.referrerWallet && refSplit.referrerSol > 0) {
        this.recordReferralEarning(refSplit.referrerWallet, refSplit.referrerSol);
      }

      PortfolioService.recordRealSell(coin, sellPercent, solReceived, signature);
      WalletService.refreshBalance();

      return {
        success: true,
        message: `💰 Sold ${sellPercent}% of $${coin.symbol} for ~${solReceived.toFixed(4)} SOL!`,
        txHash: signature,
        solscanUrl: `https://solscan.io/tx/${signature}`
      };
    } catch (err: any) {
      if (err?.code === 4001 || (err?.message && err.message.includes('User rejected'))) {
        return { success: false, message: 'Sell transaction cancelled in wallet.' };
      }
      return {
        success: false,
        message: err?.message || 'Sell transaction failed. Check slippage or network congestion.'
      };
    }
  }

  /**
   * Executes a real SOL payment to TREASURY_WALLET for featuring/boosting a coin on the MemeTinder deck
   */
  public static async executeBoostPayment(
    solAmount: number,
    contractAddress = '',
    boostPoints = 30,
    durationHours = 24
  ): Promise<SwapResult> {
    const wallet = WalletService.getState();
    if (!wallet.isConnected || !wallet.publicKey) {
      return {
        success: false,
        message: 'Please connect your Solana wallet first to boost a token!'
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
      let blockhash: string | null = null;

      // 1. Fetch latest blockhash from CORS-friendly Solana Mainnet RPC or serverless proxy
      try {
        const rpcRes = await fetch('https://solana-rpc.publicnode.com', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'memetinder-bh',
            method: 'getLatestBlockhash',
            params: [{ commitment: 'confirmed' }]
          })
        });
        if (rpcRes.ok) {
          const rpcData = await rpcRes.json();
          blockhash = rpcData?.result?.value?.blockhash || null;
        }
      } catch {}

      if (!blockhash) {
        const apiRes = await fetch('/api/blockhash');
        if (apiRes.ok) {
          const apiData = await apiRes.json();
          blockhash = apiData?.blockhash || null;
        }
      }

      if (!blockhash) {
        return { success: false, message: 'Could not fetch recent blockhash from Solana Mainnet.' };
      }

      const fromPubkey = new PublicKey(wallet.publicKey);
      const toPubkey = new PublicKey(TREASURY_WALLET);
      const totalLamports = Math.round(solAmount * 1e9);

      const candidateReferrer = this.getActiveReferrerWallet(wallet.publicKey);
      const candidateLamports = candidateReferrer ? Math.floor(totalLamports * REFERRER_SHARE) : 0;
      const canSplit = await this.isReferrerTransferSafe(candidateReferrer, candidateLamports);

      const referrerWallet = canSplit ? candidateReferrer : null;
      const referrerLamports = canSplit ? candidateLamports : 0;
      const treasuryLamports = totalLamports - referrerLamports;

      const tx = new Transaction();
      tx.recentBlockhash = blockhash as any;
      tx.feePayer = fromPubkey;
      tx.add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports: treasuryLamports
        })
      );

      if (referrerWallet && referrerLamports > 0) {
        tx.add(
          SystemProgram.transfer({
            fromPubkey,
            toPubkey: new PublicKey(referrerWallet),
            lamports: referrerLamports
          })
        );
      }

      // Attach on-chain SPL Memo so boosts persist across serverless cold starts directly on Solana
      if (contractAddress) {
        try {
          const memoProgramId = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
          const memoData = new TextEncoder().encode(`MT_BOOST:${contractAddress}:${boostPoints}:${durationHours}`);
          tx.add(
            new TransactionInstruction({
              keys: [{ pubkey: fromPubkey, isSigner: true, isWritable: false }],
              programId: memoProgramId,
              data: memoData as any
            })
          );
        } catch {}
      }

      const { signature } = await provider.signAndSendTransaction(tx);
      if (!signature) {
        return { success: false, message: 'Wallet did not return a transaction signature.' };
      }

      if (referrerWallet && referrerLamports > 0) {
        this.recordReferralEarning(referrerWallet, referrerLamports / 1e9);
      }

      WalletService.refreshBalance();

      return {
        success: true,
        message: '🚀 Boost payment confirmed on Solana Mainnet!',
        txHash: signature,
        solscanUrl: `https://solscan.io/tx/${signature}`
      };
    } catch (err: any) {
      if (err?.code === 4001 || (err?.message && err.message.includes('User rejected'))) {
        return { success: false, message: 'Boost transaction cancelled in wallet.' };
      }
      return {
        success: false,
        message: err?.message || 'Boost transaction failed.'
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
