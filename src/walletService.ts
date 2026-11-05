export type WalletProviderType = 'phantom' | 'solflare' | 'backpack' | 'injected';

export interface RealWalletState {
  isConnected: boolean;
  providerType: WalletProviderType | null;
  publicKey: string | null;
  solBalance: number;
  balanceLoaded?: boolean;
}

export class WalletService {
  private static state: RealWalletState = {
    isConnected: false,
    providerType: null,
    publicKey: null,
    solBalance: 0,
    balanceLoaded: false
  };

  private static listeners: Array<(state: RealWalletState) => void> = [];

  public static getState(): RealWalletState {
    return this.state;
  }

  public static onStateChange(listener: (state: RealWalletState) => void) {
    this.listeners.push(listener);
    listener(this.state);
  }

  private static notify() {
    this.listeners.forEach(fn => fn(this.state));
  }

  private static readonly LAST_PROVIDER_KEY = 'memetinder_last_wallet_provider_v1';

  /**
   * Auto-connects if the user previously authorized the dApp
   */
  public static async autoConnect(): Promise<void> {
    const savedType = localStorage.getItem(this.LAST_PROVIDER_KEY) as WalletProviderType | null;
    const candidates: WalletProviderType[] = [];
    if (savedType && ['phantom', 'solflare', 'backpack', 'injected'].includes(savedType)) {
      candidates.push(savedType);
    }
    for (const t of ['phantom', 'solflare', 'backpack', 'injected'] as WalletProviderType[]) {
      if (!candidates.includes(t)) candidates.push(t);
    }

    for (const candidateType of candidates) {
      const provider = this.getProvider(candidateType);
      if (!provider) continue;

      try {
        if (provider.isConnected && provider.publicKey) {
          this.setConnectedState(candidateType, provider.publicKey.toString());
          await this.refreshBalance();
          return;
        }
        if (provider.connect) {
          const resp = await provider.connect({ onlyIfTrusted: true });
          const pubkey = resp?.publicKey?.toString() || provider.publicKey?.toString();
          if (pubkey) {
            this.setConnectedState(candidateType, pubkey);
            await this.refreshBalance();
            return;
          }
        }
      } catch {
        // Try next candidate
      }
    }
  }

  public static getProvider(type: WalletProviderType): any {
    const w = window as any;
    if (type === 'phantom') {
      return w.phantom?.solana || (w.solana?.isPhantom ? w.solana : null);
    }
    if (type === 'solflare') {
      return w.solflare?.isSolflare ? w.solflare : null;
    }
    if (type === 'backpack') {
      return w.backpack;
    }
    return w.solana || null;
  }

  public static isWalletInstalled(type: WalletProviderType): boolean {
    return !!this.getProvider(type);
  }

  /**
   * Connect real Solana wallet
   */
  public static async connect(type: WalletProviderType = 'phantom'): Promise<{ success: boolean; message: string }> {
    const provider = this.getProvider(type);

    if (!provider) {
      // Mobile deep link fallback for Phantom
      const currentUrl = encodeURIComponent(window.location.href);
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      if (isMobile) {
        window.location.href = `https://phantom.app/ul/browse/${currentUrl}?ref=${encodeURIComponent(window.location.origin)}`;
        return {
          success: false,
          message: 'Opening MemeTinder inside Phantom Mobile App...'
        };
      }

      return {
        success: false,
        message: `${type.toUpperCase()} not found! Please install the browser extension or open in mobile app.`
      };
    }

    try {
      const resp = await provider.connect();
      const pubkey = resp.publicKey ? resp.publicKey.toString() : provider.publicKey?.toString();

      if (!pubkey) {
        return { success: false, message: 'Could not retrieve public key from wallet.' };
      }

      this.setConnectedState(type, pubkey);
      await this.refreshBalance();

      // Listen for account change / disconnect
      if (provider.on) {
        provider.on('disconnect', () => this.disconnect());
        provider.on('accountChanged', (newPubkey: any) => {
          if (newPubkey) {
            this.setConnectedState(type, newPubkey.toString());
            this.refreshBalance();
          } else {
            this.disconnect();
          }
        });
      }

      return {
        success: true,
        message: `Connected: ${pubkey.slice(0, 4)}...${pubkey.slice(-4)}`
      };
    } catch (err: any) {
      if (err?.code === 4001) {
        return { success: false, message: 'Wallet connection rejected by user.' };
      }
      return { success: false, message: err?.message || 'Connection failed.' };
    }
  }

  public static disconnect() {
    const provider = this.getProvider(this.state.providerType || 'phantom');
    if (provider?.disconnect) {
      try { provider.disconnect(); } catch {}
    }
    try { localStorage.removeItem(this.LAST_PROVIDER_KEY); } catch {}

    this.state = {
      isConnected: false,
      providerType: null,
      publicKey: null,
      solBalance: 0
    };
    this.notify();
  }

  private static setConnectedState(type: WalletProviderType, pubkey: string) {
    try { localStorage.setItem(this.LAST_PROVIDER_KEY, type); } catch {}
    this.state = {
      isConnected: true,
      providerType: type,
      publicKey: pubkey,
      solBalance: this.state.solBalance
    };
    this.notify();
  }

  /**
   * Queries real on-chain balance from CORS-friendly Solana Mainnet RPCs + serverless fallback
   */
  public static async refreshBalance(): Promise<number> {
    if (!this.state.publicKey) return 0;
    const pubkey = this.state.publicKey;

    const rpcEndpoints = [
      'https://solana-rpc.publicnode.com',
      'https://api.mainnet-beta.solana.com'
    ];

    for (const rpcUrl of rpcEndpoints) {
      try {
        const res = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'memetinder-bal',
            method: 'getBalance',
            params: [pubkey, { commitment: 'confirmed' }]
          })
        });

        if (res.ok) {
          const json = await res.json();
          if (typeof json.result?.value === 'number') {
            const sol = json.result.value / 1e9;
            this.state.solBalance = Math.round(sol * 10000) / 10000;
            this.state.balanceLoaded = true;
            this.notify();
            return this.state.solBalance;
          }
        }
      } catch (e) {
        console.warn(`Solana RPC balance query failed on ${rpcUrl}:`, e);
      }
    }

    // Serverless proxy fallback (/api/balance) to bypass browser Origin restrictions
    try {
      const apiRes = await fetch(`/api/balance?pubkey=${encodeURIComponent(pubkey)}`);
      if (apiRes.ok) {
        const data = await apiRes.json();
        if (typeof data.sol === 'number') {
          this.state.solBalance = Math.round(data.sol * 10000) / 10000;
          this.state.balanceLoaded = true;
          this.notify();
          return this.state.solBalance;
        }
      }
    } catch (e) {
      console.warn('Serverless balance proxy fallback error:', e);
    }

    return this.state.solBalance;
  }

  /**
   * Queries real on-chain SPL token balance for the connected wallet
   */
  public static async getTokenBalance(mintAddress: string): Promise<{ rawAmount: string; decimals: number; uiAmount: number }> {
    if (!this.state.publicKey || !mintAddress) {
      return { rawAmount: '0', decimals: 6, uiAmount: 0 };
    }
    const owner = this.state.publicKey;

    try {
      const res = await fetch('https://solana-rpc.publicnode.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'memetinder-tokbal',
          method: 'getTokenAccountsByOwner',
          params: [
            owner,
            { mint: mintAddress },
            { encoding: 'jsonParsed', commitment: 'confirmed' }
          ]
        })
      });

      if (res.ok) {
        const json = await res.json();
        const accounts = json?.result?.value;
        if (Array.isArray(accounts)) {
          let totalRaw = 0n;
          let decimals = 6;
          let uiAmount = 0;
          for (const acc of accounts) {
            const info = acc?.account?.data?.parsed?.info?.tokenAmount;
            if (info) {
              decimals = info.decimals ?? 6;
              totalRaw += BigInt(info.amount || '0');
              uiAmount += Number(info.uiAmount || 0);
            }
          }
          return { rawAmount: totalRaw.toString(), decimals, uiAmount };
        }
      }
    } catch {}

    // Serverless fallback
    try {
      const apiRes = await fetch(`/api/token-balance?owner=${encodeURIComponent(owner)}&mint=${encodeURIComponent(mintAddress)}`);
      if (apiRes.ok) {
        const data = await apiRes.json();
        if (data && typeof data.rawAmount === 'string') {
          return {
            rawAmount: data.rawAmount,
            decimals: data.decimals ?? 6,
            uiAmount: Number(data.uiAmount || 0)
          };
        }
      }
    } catch {}

    return { rawAmount: '0', decimals: 6, uiAmount: 0 };
  }
}
