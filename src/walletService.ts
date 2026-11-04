export type WalletType = 'phantom' | 'demo' | 'none';

export interface WalletState {
  type: WalletType;
  isConnected: boolean;
  publicKey: string | null;
  solBalance: number;
}

const STORAGE_DEMO_BALANCE = 'memetinder_demo_sol_balance';
const STORAGE_WALLET_PREF = 'memetinder_wallet_pref';

export class WalletService {
  private static state: WalletState = {
    type: 'none',
    isConnected: false,
    publicKey: null,
    solBalance: 0
  };

  private static listeners: Array<(state: WalletState) => void> = [];

  public static init() {
    const savedPref = localStorage.getItem(STORAGE_WALLET_PREF);
    if (savedPref === 'demo') {
      this.connectDemo();
    } else if (savedPref === 'phantom' && (window as any).solana?.isPhantom) {
      // Eagerly connect if previously connected
      (window as any).solana.connect({ onlyIfTrusted: true })
        .then((resp: any) => {
          this.state = {
            type: 'phantom',
            isConnected: true,
            publicKey: resp.publicKey.toString(),
            solBalance: 1.25 // Will update via balance fetch
          };
          this.fetchSolBalance();
          this.notify();
        })
        .catch(() => {
          // Fallback to demo mode if eager connection fails
          this.connectDemo();
        });
      return;
    } else {
      // Default to demo wallet so user can immediately experience 1-click swaps!
      this.connectDemo();
    }
  }

  public static getState(): WalletState {
    return this.state;
  }

  public static onStateChange(listener: (state: WalletState) => void) {
    this.listeners.push(listener);
    listener(this.state);
  }

  private static notify() {
    this.listeners.forEach(fn => fn(this.state));
  }

  /**
   * Connect Real Phantom Wallet
   */
  public static async connectPhantom(): Promise<{ success: boolean; message: string }> {
    const solana = (window as any).solana;
    if (!solana || !solana.isPhantom) {
      return {
        success: false,
        message: 'Phantom Wallet extension not detected! Please install Phantom or use Demo Degen Wallet.'
      };
    }

    try {
      const resp = await solana.connect();
      const pubkey = resp.publicKey.toString();

      this.state = {
        type: 'phantom',
        isConnected: true,
        publicKey: pubkey,
        solBalance: 1.5 // Initial placeholder until RPC fetch
      };

      localStorage.setItem(STORAGE_WALLET_PREF, 'phantom');
      this.fetchSolBalance();
      this.notify();

      return {
        success: true,
        message: `Connected Phantom: ${pubkey.slice(0, 4)}...${pubkey.slice(-4)}`
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Phantom connection rejected'
      };
    }
  }

  /**
   * Connect Demo Degen Wallet (pre-loaded with 5.0 SOL)
   */
  public static connectDemo() {
    const savedBal = localStorage.getItem(STORAGE_DEMO_BALANCE);
    const balance = savedBal ? parseFloat(savedBal) : 5.0;

    this.state = {
      type: 'demo',
      isConnected: true,
      publicKey: 'DeGeN...420x (Demo)',
      solBalance: balance
    };

    localStorage.setItem(STORAGE_WALLET_PREF, 'demo');
    this.notify();
  }

  public static disconnect() {
    if (this.state.type === 'phantom' && (window as any).solana) {
      try { (window as any).solana.disconnect(); } catch {}
    }

    this.state = {
      type: 'none',
      isConnected: false,
      publicKey: null,
      solBalance: 0
    };

    localStorage.removeItem(STORAGE_WALLET_PREF);
    this.notify();
  }

  /**
   * Deducts SOL balance after successful swap
   */
  public static deductSol(amount: number) {
    if (this.state.solBalance >= amount) {
      this.state.solBalance = Math.max(0, Math.round((this.state.solBalance - amount) * 1000) / 1000);
      if (this.state.type === 'demo') {
        localStorage.setItem(STORAGE_DEMO_BALANCE, this.state.solBalance.toString());
      }
      this.notify();
    }
  }

  /**
   * Adds SOL balance (e.g. faucet or reset)
   */
  public static resetDemoBalance(amount = 5.0) {
    if (this.state.type === 'demo') {
      this.state.solBalance = amount;
      localStorage.setItem(STORAGE_DEMO_BALANCE, amount.toString());
      this.notify();
    }
  }

  private static async fetchSolBalance() {
    if (this.state.type !== 'phantom' || !this.state.publicKey) return;

    try {
      // Free public Solana RPC balance query
      const res = await fetch('https://api.mainnet-beta.solana.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBalance',
          params: [this.state.publicKey]
        })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.result?.value !== undefined) {
          const sol = json.result.value / 1e9;
          this.state.solBalance = Math.round(sol * 1000) / 1000;
          this.notify();
        }
      }
    } catch (e) {
      console.info('Using local balance estimate for Phantom.');
    }
  }
}
