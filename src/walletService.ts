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

  /**
   * Auto-connects if the user previously authorized the dApp
   */
  public static async autoConnect(): Promise<void> {
    const provider = this.getProvider('phantom') || this.getProvider('solflare') || this.getProvider('injected');
    if (!provider) return;

    try {
      if (provider.isConnected && provider.publicKey) {
        this.setConnectedState('phantom', provider.publicKey.toString());
        await this.refreshBalance();
        return;
      }
      if (provider.connect) {
        const resp = await provider.connect({ onlyIfTrusted: true });
        const pubkey = resp?.publicKey?.toString() || provider.publicKey?.toString();
        if (pubkey) {
          this.setConnectedState('phantom', pubkey);
          await this.refreshBalance();
        }
      }
    } catch {
      // User hasn't pre-authorized, stay disconnected
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

    this.state = {
      isConnected: false,
      providerType: null,
      publicKey: null,
      solBalance: 0
    };
    this.notify();
  }

  private static setConnectedState(type: WalletProviderType, pubkey: string) {
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
}
