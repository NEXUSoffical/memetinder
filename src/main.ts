import { MemeCoin, FilterChain } from './types';
import { DexService } from './dexService';
import { OFFICIAL_MEMETINDER_CA, OFFICIAL_MEMETINDER_COIN } from './coinsData';
import { SwipeEngine } from './swipeEngine';
import { SoundEngine } from './soundEngine';
import { PortfolioService } from './portfolioService';
import { WalletService, RealWalletState } from './walletService';
import { JupiterService, JupiterQuote } from './jupiterService';
import { escapeHtml } from './utils';

// Initialize Sound Engine
const sound = new SoundEngine();

// App State
let allCoins: MemeCoin[] = [];
let activeFilter: FilterChain = 'all';
let currentSwipedMatchCoin: MemeCoin | null = null;
let currentJupiterQuote: JupiterQuote | null = null;
let swipeEngine: SwipeEngine | null = null;

// Quick Ape Settings
let selectedApeSol = 0.1;
let isAutoApeMode = false;

// DOM Elements
const cardStackContainer = document.getElementById('cardStackContainer') as HTMLElement;
const matchesCountBadge = document.getElementById('matchesCountBadge') as HTMLElement;
const btnAudioToggle = document.getElementById('btnAudioToggle') as HTMLButtonElement;
const btnBrandHome = document.getElementById('btnBrandHome') as HTMLElement;

// Wallet DOM Elements
const btnWalletToggle = document.getElementById('btnWalletToggle') as HTMLButtonElement;
const walletBtnLabel = document.getElementById('walletBtnLabel') as HTMLElement;
const walletModalBackdrop = document.getElementById('walletModalBackdrop') as HTMLElement;
const btnCloseWalletModal = document.getElementById('btnCloseWalletModal') as HTMLButtonElement;
const activeWalletInfoCard = document.getElementById('activeWalletInfoCard') as HTMLElement;
const walletOptionsList = document.getElementById('walletOptionsList') as HTMLElement;
const walletModalAddress = document.getElementById('walletModalAddress') as HTMLElement;
const walletModalSolBal = document.getElementById('walletModalSolBal') as HTMLElement;
const walletStatusTypeBadge = document.getElementById('walletStatusTypeBadge') as HTMLElement;

const btnConnectPhantom = document.getElementById('btnConnectPhantom') as HTMLButtonElement;
const btnConnectSolflare = document.getElementById('btnConnectSolflare') as HTMLButtonElement;
const btnConnectBackpack = document.getElementById('btnConnectBackpack') as HTMLButtonElement;
const btnOpenMobilePhantom = document.getElementById('btnOpenMobilePhantom') as HTMLAnchorElement;
const btnDisconnectWallet = document.getElementById('btnDisconnectWallet') as HTMLButtonElement;

// Quick Ape Presets & Auto-Ape Toggle
const apePresetBtns = document.querySelectorAll('.ape-preset-btn');
const btnAutoApeToggle = document.getElementById('btnAutoApeToggle') as HTMLElement;
const autoApeText = document.getElementById('autoApeText') as HTMLElement;

// Filter chips
const filterChips = document.querySelectorAll('.filter-chip');

// Action buttons
const btnActionRewind = document.getElementById('btnActionRewind') as HTMLButtonElement;
const btnActionPass = document.getElementById('btnActionPass') as HTMLButtonElement;
const btnActionSuperlike = document.getElementById('btnActionSuperlike') as HTMLButtonElement;
const btnActionApe = document.getElementById('btnActionApe') as HTMLButtonElement;
const btnActionBoost = document.getElementById('btnActionBoost') as HTMLButtonElement;

// Match Modal
const matchModalBackdrop = document.getElementById('matchModalBackdrop') as HTMLElement;
const btnCloseMatchModal = document.getElementById('btnCloseMatchModal') as HTMLButtonElement;
const matchSubtitleText = document.getElementById('matchSubtitleText') as HTMLElement;
const matchCoinAvatar = document.getElementById('matchCoinAvatar') as HTMLImageElement;
const btnOpenDexChart = document.getElementById('btnOpenDexChart') as HTMLAnchorElement;
const btnOpenJupiterDirect = document.getElementById('btnOpenJupiterDirect') as HTMLAnchorElement;
const btnKeepSwiping = document.getElementById('btnKeepSwiping') as HTMLButtonElement;

// Jupiter Swap DOM
const jupRouteLabel = document.getElementById('jupRouteLabel') as HTMLElement;
const jupInAmount = document.getElementById('jupInAmount') as HTMLElement;
const jupOutAmount = document.getElementById('jupOutAmount') as HTMLElement;
const btnExecuteJupiterSwap = document.getElementById('btnExecuteJupiterSwap') as HTMLButtonElement;
const btnSwapLabel = document.getElementById('btnSwapLabel') as HTMLElement;
const txConfirmationArea = document.getElementById('txConfirmationArea') as HTMLElement;

// Social Viral Share DOM
const btnShareMatchX = document.getElementById('btnShareMatchX') as HTMLButtonElement;
const btnShareMatchTg = document.getElementById('btnShareMatchTg') as HTMLButtonElement;
const btnCopyMatchCa = document.getElementById('btnCopyMatchCa') as HTMLButtonElement;

// Search & Custom CA DOM
const btnOpenSearch = document.getElementById('btnOpenSearch') as HTMLButtonElement;
const searchModalBackdrop = document.getElementById('searchModalBackdrop') as HTMLElement;
const btnCloseSearchModal = document.getElementById('btnCloseSearchModal') as HTMLButtonElement;
const inputCustomCa = document.getElementById('inputCustomCa') as HTMLInputElement;
const btnSubmitCustomCa = document.getElementById('btnSubmitCustomCa') as HTMLButtonElement;

// Profile Modal
const profileModalBackdrop = document.getElementById('profileModalBackdrop') as HTMLElement;
const btnCloseProfileModal = document.getElementById('btnCloseProfileModal') as HTMLButtonElement;
const profileModalBody = document.getElementById('profileModalBody') as HTMLElement;

// Matches & Portfolio Modal
const matchesModalBackdrop = document.getElementById('matchesModalBackdrop') as HTMLElement;
const btnOpenMatches = document.getElementById('btnOpenMatches') as HTMLButtonElement;
const btnCloseMatchesModal = document.getElementById('btnCloseMatchesModal') as HTMLButtonElement;
const matchesListContainer = document.getElementById('matchesListContainer') as HTMLElement;

// Toast Utility
function showToast(message: string, duration = 3000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerText = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Update Matches Badge Count
function updateMatchesBadge() {
  const count = PortfolioService.getMatches().length;
  matchesCountBadge.innerText = count.toString();
  matchesCountBadge.style.display = count > 0 ? 'inline-block' : 'none';
}

// Update Real Wallet UI
function updateWalletUI(wallet: RealWalletState) {
  if (wallet.isConnected && wallet.publicKey) {
    btnWalletToggle.classList.add('connected');
    const short = `${wallet.publicKey.slice(0, 4)}...${wallet.publicKey.slice(-4)}`;
    const formattedBal = wallet.solBalance > 0 && wallet.solBalance < 0.1
      ? wallet.solBalance.toFixed(3)
      : wallet.solBalance.toFixed(2);
    walletBtnLabel.innerHTML = `🟢 <b>${formattedBal} SOL</b> (${short})`;
    
    activeWalletInfoCard.style.display = 'block';
    walletOptionsList.style.display = 'none';

    walletStatusTypeBadge.innerText = (wallet.providerType || 'SOLANA').toUpperCase();
    walletModalAddress.innerText = wallet.publicKey;
    walletModalSolBal.innerText = `${wallet.solBalance.toFixed(4)} SOL`;

    if (btnSwapLabel && (!currentSwipedMatchCoin || !btnExecuteJupiterSwap.disabled)) {
      btnSwapLabel.innerText = `🔥 1-Click Ape ${selectedApeSol} SOL Now`;
    }
  } else {
    btnWalletToggle.classList.remove('connected');
    walletBtnLabel.innerText = '🟣 Connect Wallet';
    
    activeWalletInfoCard.style.display = 'none';
    walletOptionsList.style.display = 'flex';

    if (btnSwapLabel) {
      btnSwapLabel.innerText = '🟣 Connect Wallet to Ape In';
    }
  }
}

// Fetch & Update Jupiter Swap Quote for Match Modal
async function loadJupiterQuoteForCoin(coin: MemeCoin) {
  currentJupiterQuote = null;
  jupInAmount.innerText = `${selectedApeSol} SOL (~$${(selectedApeSol * 95.8).toFixed(2)})`;
  jupOutAmount.innerText = 'Routing best DEX quote on Jupiter...';
  jupRouteLabel.innerText = '🪐 Jupiter Routing...';
  txConfirmationArea.style.display = 'none';
  btnExecuteJupiterSwap.disabled = false;

  const wallet = WalletService.getState();
  if (wallet.isConnected) {
    btnSwapLabel.innerText = `🔥 1-Click Ape ${selectedApeSol} SOL Now`;
  } else {
    btnSwapLabel.innerText = '🟣 Connect Wallet to Ape In';
  }

  const quote = await JupiterService.getQuote(coin.contractAddress, selectedApeSol);
  currentJupiterQuote = quote;

  if (quote) {
    const formattedTokens = quote.outAmountTokens > 1000 
      ? quote.outAmountTokens.toLocaleString(undefined, { maximumFractionDigits: 0 })
      : quote.outAmountTokens.toFixed(2);
    jupOutAmount.innerText = `~${formattedTokens} $${coin.symbol}`;
    jupRouteLabel.innerText = `🪐 ${quote.routeLabel}`;
  } else {
    const estTokens = (selectedApeSol * 95.8) / (coin.priceUsd || 0.001);
    const formattedTokens = estTokens > 1000 
      ? estTokens.toLocaleString(undefined, { maximumFractionDigits: 0 })
      : estTokens.toFixed(2);
    jupOutAmount.innerText = `~${formattedTokens} $${coin.symbol}`;
    jupRouteLabel.innerText = '🪐 Direct Pool Route';
  }
}

// Open Match Modal with Jupiter Swap
async function triggerMatchModal(coin: MemeCoin, isSuperLike = false) {
  currentSwipedMatchCoin = coin;
  matchSubtitleText.innerText = isSuperLike 
    ? `⭐ SUPER LIKE! 1-Click Swap $${coin.symbol} via Jupiter.`
    : `You matched with $${coin.symbol}! Ape in directly on Solana Mainnet.`;
  
  matchCoinAvatar.src = coin.avatar;
  btnOpenDexChart.href = coin.dexScreenerUrl;
  btnOpenJupiterDirect.href = JupiterService.getJupiterDirectUrl(coin.contractAddress);

  document.body.classList.add('modal-active');
  matchModalBackdrop.classList.add('active');

  loadJupiterQuoteForCoin(coin);
}

function closeMatchModal() {
  document.body.classList.remove('modal-active');
  matchModalBackdrop.classList.remove('active');
}

// Execute Real 1-Click Swap
async function handleSwapExecution() {
  if (!currentSwipedMatchCoin) return;
  const coin = currentSwipedMatchCoin;
  const wallet = WalletService.getState();

  if (!wallet.isConnected) {
    closeMatchModal();
    openWalletModal();
    showToast('Please connect your Solana wallet first!');
    return;
  }

  btnExecuteJupiterSwap.disabled = true;
  btnSwapLabel.innerText = '⏳ Approving Swap in Wallet...';

  const res = await JupiterService.executeSwap(coin, selectedApeSol, currentJupiterQuote);

  if (res.success && res.txHash) {
    sound.playBuy();
    PortfolioService.recordRealTrade(
      coin,
      selectedApeSol,
      res.txHash,
      currentJupiterQuote?.outAmountTokens || 0
    );
    updateMatchesBadge();
    btnSwapLabel.innerText = '✓ Swap Broadcasted!';
    
    // Show Solscan transaction link
    txConfirmationArea.style.display = 'block';
    txConfirmationArea.innerHTML = `
      <div class="tx-confirmation-banner">
        <span style="font-weight: 800; color: #10b981;">🚀 Swap Broadcasted on Solana Mainnet!</span>
        <span style="color: #cbd5e1;">Aped ${selectedApeSol} SOL into <b>$${coin.symbol}</b></span>
        <a class="tx-solscan-link" href="${res.solscanUrl}" target="_blank" rel="noopener">
          View on Solscan ↗
        </a>
      </div>
    `;
    showToast(`⚡ Broadcasted swap for $${coin.symbol}!`);
  } else {
    btnExecuteJupiterSwap.disabled = false;
    btnSwapLabel.innerText = `🔥 1-Click Ape ${selectedApeSol} SOL Now`;
    showToast(`⚠️ ${res.message}`, 4000);
  }
}

let profileLiveInterval: number | null = null;

function formatPriceUsd(price: number): string {
  if (price < 0.0001) return `$${price.toFixed(7)}`;
  if (price < 0.01) return `$${price.toFixed(6)}`;
  if (price < 1) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(2)}`;
}

function formatMcapShort(mcap: number): string {
  if (mcap >= 1_000_000_000) return `$${(mcap / 1e9).toFixed(2)}B`;
  if (mcap >= 1_000_000) return `$${(mcap / 1e6).toFixed(2)}M`;
  if (mcap >= 1_000) return `$${(mcap / 1e3).toFixed(1)}K`;
  return `$${Math.round(mcap).toLocaleString()}`;
}

function renderLiveSvgChart(series: number[], color: string): string {
  const svgWidth = 400;
  const svgHeight = 130;
  const minVal = Math.min(...series);
  const maxVal = Math.max(...series);
  const range = (maxVal - minVal) || (maxVal * 0.01) || 1;

  const coords = series.map((val, idx) => {
    const x = (idx / Math.max(1, series.length - 1)) * (svgWidth - 12) + 6;
    const y = svgHeight - ((val - minVal) / range) * (svgHeight - 28) - 14;
    return { x, y };
  });

  const polylineStr = coords.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const firstX = coords[0]?.x.toFixed(1) || '6';
  const lastPoint = coords[coords.length - 1] || { x: svgWidth - 6, y: svgHeight / 2 };
  const areaStr = `${firstX},${svgHeight} ${polylineStr} ${lastPoint.x.toFixed(1)},${svgHeight}`;

  return `
    <svg viewBox="0 0 ${svgWidth} ${svgHeight}" style="width: 100%; height: 120px; overflow: visible;">
      <defs>
        <linearGradient id="chartGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.38" />
          <stop offset="100%" stop-color="${color}" stop-opacity="0.0" />
        </linearGradient>
      </defs>
      <polygon points="${areaStr}" fill="url(#chartGrad)" />
      <polyline points="${polylineStr}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="${lastPoint.x.toFixed(1)}" cy="${lastPoint.y.toFixed(1)}" r="5" fill="${color}" />
      <circle cx="${lastPoint.x.toFixed(1)}" cy="${lastPoint.y.toFixed(1)}" r="10" fill="${color}" opacity="0.28">
        <animate attributeName="r" values="5;13;5" dur="1.6s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.45;0.05;0.45" dur="1.6s" repeatCount="indefinite" />
      </circle>
    </svg>
    <div style="display: flex; justify-content: space-between; font-size: 0.68rem; color: var(--text-subtle); font-family: monospace; margin-top: 2px;">
      <span>Low: ${formatPriceUsd(minVal)}</span>
      <span>High: ${formatPriceUsd(maxVal)}</span>
    </div>
  `;
}

// Open Token Profile Modal with Real-Time Live Updating MC & Chart
function openProfileModal(coin: MemeCoin) {
  if (profileLiveInterval) {
    clearInterval(profileLiveInterval);
    profileLiveInterval = null;
  }

  let liveSeries = [...(coin.sparkline && coin.sparkline.length > 1 ? coin.sparkline : [coin.priceUsd * 0.96, coin.priceUsd * 0.98, coin.priceUsd])];
  let baselineDexPrice = coin.priceUsd;
  let baselineDexMcap = coin.marketCap;

  const isPos = coin.change24h >= 0;
  const changeColor = isPos ? '#10b981' : '#ef4444';
  const changeSign = isPos ? '+' : '';
  const embedChain = coin.chain === 'pumpfun' ? 'solana' : coin.chain;

  profileModalBody.innerHTML = `
    <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 14px;">
      <img src="${coin.avatar}" style="width: 64px; height: 64px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.15); object-fit: cover;" alt="${coin.name}" onerror="this.src='https://assets.coingecko.com/coins/images/29850/large/pepe-token.png'" />
      <div style="flex: 1;">
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <h2 style="font-family: var(--font-display); font-size: 1.5rem; font-weight: 800;">${escapeHtml(coin.name)}</h2>
          <span style="color: var(--text-muted); font-weight: 700;">$${escapeHtml(coin.symbol)}</span>
          ${coin.verified ? '<span class="verified-check">✓</span>' : ''}
        </div>
        <div style="display: flex; align-items: baseline; gap: 8px; margin-top: 2px; flex-wrap: wrap;">
          <span id="livePriceVal" style="font-size: 1.35rem; font-weight: 900; font-family: monospace; transition: color 0.25s ease;">${formatPriceUsd(coin.priceUsd)}</span>
          <span id="liveChangeVal" style="color: ${changeColor}; font-weight: 800; font-size: 0.85rem;">${changeSign}${coin.change24h}% (24h)</span>
        </div>
      </div>
    </div>

    <!-- Real-Time Chart Box with Tick / Candlestick Toggle -->
    <div style="background: rgba(0,0,0,0.35); border-radius: 16px; padding: 12px; border: 1px solid var(--border-subtle); margin-bottom: 14px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 0.76rem; color: var(--text-muted);">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span class="live-dot"></span>
          <span id="liveStatusBadge" style="color: #34d399; font-weight: 800;">LIVE STREAMING (2s)</span>
        </div>
        <div style="display: flex; gap: 4px;">
          <button id="btnModeTickChart" style="background: rgba(16, 185, 129, 0.2); border: 1px solid rgba(16, 185, 129, 0.4); color: #34d399; padding: 3px 8px; border-radius: 6px; font-size: 0.7rem; font-weight: 800; cursor: pointer;">⚡ Live Line</button>
          <button id="btnModeCandleChart" style="background: rgba(255, 255, 255, 0.06); border: 1px solid var(--border-subtle); color: #cbd5e1; padding: 3px 8px; border-radius: 6px; font-size: 0.7rem; font-weight: 700; cursor: pointer;">🕯️ Candles</button>
        </div>
      </div>

      <div id="liveSvgChartContainer">
        ${renderLiveSvgChart(liveSeries, changeColor)}
      </div>

      <div id="liveCandleIframeContainer" style="display: none; width: 100%; height: 240px; border-radius: 10px; overflow: hidden;"></div>
    </div>

    <!-- Real-Time Tokenomics Grid -->
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 14px;">
      <div class="stat-pill" style="align-items: flex-start; padding: 10px;">
        <span class="stat-label">Live Market Cap</span>
        <span class="stat-val" id="liveMcapVal" style="transition: color 0.25s ease;">${formatMcapShort(coin.marketCap)}</span>
        <span id="liveMcapExact" style="font-size: 0.7rem; color: var(--text-muted); font-family: monospace;">$${Math.round(coin.marketCap).toLocaleString()}</span>
      </div>
      <div class="stat-pill" style="align-items: flex-start; padding: 10px;">
        <span class="stat-label">24h Volume</span>
        <span class="stat-val" id="liveVolVal">${formatMcapShort(coin.volume24h)}</span>
        <span id="liveVolExact" style="font-size: 0.7rem; color: var(--text-muted); font-family: monospace;">$${Math.round(coin.volume24h).toLocaleString()}</span>
      </div>
      <div class="stat-pill" style="align-items: flex-start; padding: 10px;">
        <span class="stat-label">Liquidity</span>
        <span class="stat-val" id="liveLiqVal">$${Math.round(coin.liquidityUsd).toLocaleString()}</span>
      </div>
      <div class="stat-pill" style="align-items: flex-start; padding: 10px;">
        <span class="stat-label">24h Activity / Holders</span>
        <span class="stat-val" id="liveHoldersVal">${coin.holdersCount.toLocaleString()}</span>
      </div>
    </div>

    <!-- Safety Radar -->
    <div style="background: rgba(255,255,255,0.04); border-radius: 16px; padding: 12px 14px; border: 1px solid var(--border-subtle); margin-bottom: 14px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span style="font-weight: 800; font-size: 0.88rem;">🛡️ Safety Radar Score</span>
        <span style="color: #34d399; font-weight: 900; font-size: 1rem;">${coin.safetyScore.score}/100</span>
      </div>
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; font-size: 0.76rem; color: #cbd5e1;">
        <div>${coin.safetyScore.isMintRevoked ? '✅' : '❌'} Mint Revoked</div>
        <div>${coin.safetyScore.isFreezeRevoked ? '✅' : '❌'} Freeze Revoked</div>
        <div>${coin.safetyScore.isLpBurned ? '✅' : '⚠️'} LP Burned/Locked</div>
        <div>👥 Top 10: <b>${coin.safetyScore.top10HoldersPercent}%</b></div>
      </div>
    </div>

    <!-- Contract Address Box -->
    <div style="background: rgba(0,0,0,0.4); border-radius: 14px; padding: 10px 12px; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between; border: 1px solid var(--border-subtle);">
      <div style="display: flex; flex-direction: column; gap: 2px; overflow: hidden; margin-right: 8px;">
        <span style="font-size: 0.65rem; color: var(--text-subtle); text-transform: uppercase;">Contract Address (CA)</span>
        <span style="font-family: monospace; font-size: 0.78rem; color: #93c5fd; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${coin.contractAddress}</span>
      </div>
      <button id="btnCopyCA" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15); color: white; padding: 6px 12px; border-radius: 8px; font-size: 0.78rem; font-weight: 700; cursor: pointer; white-space: nowrap;">
        📋 Copy
      </button>
    </div>

    <!-- Action Bar -->
    <div style="display: flex; gap: 10px;">
      <button id="btnProfileQuickApe" style="flex: 1.2; background: linear-gradient(135deg, #f43f5e, #fb7185); border: none; color: white; padding: 12px; border-radius: 999px; font-weight: 800; font-size: 0.9rem; cursor: pointer;">
        🔥 Ape ${selectedApeSol} SOL
      </button>
      <a href="${JupiterService.getJupiterDirectUrl(coin.contractAddress)}" target="_blank" rel="noopener" style="flex: 1; text-align: center; background: rgba(250, 204, 21, 0.12); border: 1px solid rgba(250, 204, 21, 0.35); color: #facc15; padding: 12px; border-radius: 999px; text-decoration: none; font-weight: 800; font-size: 0.88rem;">
        🪐 Jupiter
      </a>
      <a href="${coin.dexScreenerUrl}" target="_blank" rel="noopener" style="flex: 1; text-align: center; background: rgba(255,255,255,0.08); border: 1px solid var(--border-subtle); color: white; padding: 12px; border-radius: 999px; text-decoration: none; font-weight: 700; font-size: 0.88rem;">
        📈 Dex
      </a>
    </div>
  `;

  // Attach dynamic event listeners in modal
  const btnCopy = document.getElementById('btnCopyCA');
  if (btnCopy) {
    btnCopy.addEventListener('click', () => {
      navigator.clipboard.writeText(coin.contractAddress);
      btnCopy.innerText = '✓ Copied!';
      showToast(`Copied $${coin.symbol} CA to clipboard!`);
      setTimeout(() => { if (btnCopy) btnCopy.innerText = '📋 Copy'; }, 2000);
    });
  }

  const btnProfileQuickApe = document.getElementById('btnProfileQuickApe') as HTMLButtonElement | null;
  if (btnProfileQuickApe) {
    btnProfileQuickApe.addEventListener('click', async () => {
      const wallet = WalletService.getState();
      if (!wallet.isConnected) {
        closeProfileModal();
        PortfolioService.addMatch(coin, 'ape');
        updateMatchesBadge();
        triggerMatchModal(coin, false);
        return;
      }

      const origText = btnProfileQuickApe.innerText;
      btnProfileQuickApe.disabled = true;
      btnProfileQuickApe.innerText = '⏳ Confirm in Phantom...';

      const res = await JupiterService.executeSwap(coin, selectedApeSol);
      btnProfileQuickApe.disabled = false;

      if (res.success && res.txHash) {
        sound.playBuy();
        PortfolioService.recordRealTrade(coin, selectedApeSol, res.txHash, res.tokensReceived || 0);
        updateMatchesBadge();
        btnProfileQuickApe.innerText = '✓ Bought in Wallet!';
        showToast(`🚀 Bought ${selectedApeSol} SOL of $${coin.symbol} on Solana Mainnet!`);
      } else {
        btnProfileQuickApe.innerText = origText;
        showToast(`⚠️ ${res.message}`, 4000);
      }
    });
  }

  // Toggle between Live SVG Line and Embedded DexScreener Candlestick Iframe
  const btnModeTickChart = document.getElementById('btnModeTickChart');
  const btnModeCandleChart = document.getElementById('btnModeCandleChart');
  const liveSvgChartContainer = document.getElementById('liveSvgChartContainer');
  const liveCandleIframeContainer = document.getElementById('liveCandleIframeContainer');

  if (btnModeTickChart && btnModeCandleChart && liveSvgChartContainer && liveCandleIframeContainer) {
    btnModeTickChart.addEventListener('click', () => {
      liveSvgChartContainer.style.display = 'block';
      liveCandleIframeContainer.style.display = 'none';
      btnModeTickChart.style.background = 'rgba(16, 185, 129, 0.2)';
      btnModeTickChart.style.color = '#34d399';
      btnModeCandleChart.style.background = 'rgba(255, 255, 255, 0.06)';
      btnModeCandleChart.style.color = '#cbd5e1';
    });

    btnModeCandleChart.addEventListener('click', () => {
      liveSvgChartContainer.style.display = 'none';
      liveCandleIframeContainer.style.display = 'block';
      btnModeCandleChart.style.background = 'rgba(16, 185, 129, 0.2)';
      btnModeCandleChart.style.color = '#34d399';
      btnModeTickChart.style.background = 'rgba(255, 255, 255, 0.06)';
      btnModeTickChart.style.color = '#cbd5e1';

      if (!liveCandleIframeContainer.querySelector('iframe')) {
        liveCandleIframeContainer.innerHTML = `
          <iframe
            src="https://dexscreener.com/${embedChain}/${encodeURIComponent(coin.contractAddress)}?embed=1&theme=dark&trades=0&info=0"
            style="width: 100%; height: 240px; border: none;"
            allow="clipboard-write"
          ></iframe>
        `;
      }
    });
  }

  // Real-time live polling loop (DexScreener pair feed without burning Jupiter swap rate-limit)
  const runLiveTick = async () => {
    const dexData = await DexService.fetchLiveMetrics(coin.contractAddress);

    const prevPrice = coin.priceUsd;
    const prevMcap = coin.marketCap;

    if (dexData && dexData.priceUsd > 0) {
      baselineDexPrice = dexData.priceUsd;
      baselineDexMcap = dexData.marketCap || coin.marketCap;
      coin.volume24h = dexData.volume24h || coin.volume24h;
      coin.liquidityUsd = dexData.liquidityUsd || coin.liquidityUsd;
      coin.change24h = Math.round(dexData.change24h * 10) / 10;
    }

    let nextPrice = baselineDexPrice;
    let nextMcap = baselineDexMcap;

    // Apply subtle real-time orderflow jitter if pool snapshot is identical between 2s blocks so chart stays alive
    if (Math.abs(nextPrice - prevPrice) < prevPrice * 0.00001) {
      const microDelta = 1 + (Math.random() - 0.492) * 0.0022;
      nextPrice = prevPrice * microDelta;
      nextMcap = prevMcap * microDelta;
    }

    const wentUp = nextMcap >= prevMcap;
    const tickColor = wentUp ? '#10b981' : '#ef4444';

    coin.priceUsd = nextPrice;
    coin.marketCap = Math.max(1000, Math.round(nextMcap));

    liveSeries.push(coin.priceUsd);
    if (liveSeries.length > 28) liveSeries.shift();
    coin.sparkline = [...liveSeries];

    // Update DOM elements in-place
    const elPrice = document.getElementById('livePriceVal');
    const elChange = document.getElementById('liveChangeVal');
    const elMcap = document.getElementById('liveMcapVal');
    const elMcapExact = document.getElementById('liveMcapExact');
    const elVol = document.getElementById('liveVolVal');
    const elVolExact = document.getElementById('liveVolExact');
    const elLiq = document.getElementById('liveLiqVal');
    const elHolders = document.getElementById('liveHoldersVal');
    const elSvgBox = document.getElementById('liveSvgChartContainer');
    const elStatus = document.getElementById('liveStatusBadge');

    if (elPrice) {
      elPrice.innerText = formatPriceUsd(coin.priceUsd);
      elPrice.style.color = tickColor;
      setTimeout(() => { if (elPrice) elPrice.style.color = '#f8fafc'; }, 700);
    }

    if (elChange) {
      const pos = coin.change24h >= 0;
      elChange.style.color = pos ? '#10b981' : '#ef4444';
      elChange.innerText = `${pos ? '+' : ''}${coin.change24h}% (24h)`;
    }

    if (elMcap) {
      elMcap.innerText = formatMcapShort(coin.marketCap);
      elMcap.style.color = tickColor;
      setTimeout(() => { if (elMcap) elMcap.style.color = '#f8fafc'; }, 700);
    }

    if (elMcapExact) {
      elMcapExact.innerText = `$${coin.marketCap.toLocaleString()} (${wentUp ? '▲' : '▼'})`;
      elMcapExact.style.color = tickColor;
    }

    if (elVol) elVol.innerText = formatMcapShort(coin.volume24h);
    if (elVolExact) elVolExact.innerText = `$${Math.round(coin.volume24h).toLocaleString()}`;
    if (elLiq) elLiq.innerText = `$${Math.round(coin.liquidityUsd).toLocaleString()}`;
    if (elHolders && dexData && (dexData.buys24h || dexData.sells24h)) {
      elHolders.innerText = `${dexData.buys24h}B / ${dexData.sells24h}S (24h)`;
    }

    if (elSvgBox) {
      const chartColor = coin.change24h >= 0 ? '#10b981' : '#ef4444';
      elSvgBox.innerHTML = renderLiveSvgChart(liveSeries, chartColor);
    }

    if (elStatus) {
      elStatus.innerText = `LIVE • ${new Date().toLocaleTimeString()}`;
    }
  };

  document.body.classList.add('modal-active');
  profileModalBackdrop.classList.add('active');

  // Trigger immediate live update, then poll every 2.2 seconds
  runLiveTick();
  profileLiveInterval = window.setInterval(runLiveTick, 2200);
}

function closeProfileModal() {
  if (profileLiveInterval) {
    clearInterval(profileLiveInterval);
    profileLiveInterval = null;
  }
  document.body.classList.remove('modal-active');
  profileModalBackdrop.classList.remove('active');
}

let bagLiveInterval: number | null = null;

// Open Matches / Live PnL Bag Modal
function openMatchesModal() {
  if (bagLiveInterval) {
    clearInterval(bagLiveInterval);
    bagLiveInterval = null;
  }

  const bagSummaryCard = document.getElementById('bagSummaryCard');
  const bagTotalValueUsd = document.getElementById('bagTotalValueUsd');
  const bagTotalPnlBadge = document.getElementById('bagTotalPnlBadge');
  const bagTxConfirmArea = document.getElementById('bagTxConfirmArea');
  const bagLiveTickLabel = document.getElementById('bagLiveTickLabel');

  if (bagTxConfirmArea) bagTxConfirmArea.style.display = 'none';

  const onChainBalances = new Map<string, number>();

  const syncWalletBalancesForBag = async () => {
    const wallet = WalletService.getState();
    if (!wallet.isConnected || !wallet.publicKey) return;
    const matches = PortfolioService.getMatches();
    await Promise.all(
      matches.slice(0, 12).map(async (m, idx) => {
        if (!m.coin.contractAddress) return;
        const bal = await WalletService.getTokenBalance(m.coin.contractAddress);
        onChainBalances.set(m.coin.contractAddress, bal.uiAmount || 0);
        const elHoldBadge = document.getElementById(`bagHoldBadge_${idx}`);
        if (elHoldBadge) {
          if (bal.uiAmount > 0) {
            const fmtBal = bal.uiAmount > 1000
              ? bal.uiAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })
              : bal.uiAmount.toFixed(2);
            elHoldBadge.style.background = 'rgba(16, 185, 129, 0.2)';
            elHoldBadge.style.borderColor = 'rgba(16, 185, 129, 0.45)';
            elHoldBadge.style.color = '#6ee7b7';
            elHoldBadge.innerText = `🟢 In Phantom: ${fmtBal} $${m.coin.symbol}`;
          } else if (!m.solSpent) {
            elHoldBadge.style.background = 'rgba(245, 158, 11, 0.16)';
            elHoldBadge.style.borderColor = 'rgba(245, 158, 11, 0.4)';
            elHoldBadge.style.color = '#fcd34d';
            elHoldBadge.innerText = `👀 Watchlist (Not Bought in Phantom Yet)`;
          }
        }
      })
    );
  };

  const renderBagList = () => {
    const matches = PortfolioService.getMatches();

    if (matches.length === 0) {
      if (bagSummaryCard) bagSummaryCard.style.display = 'none';
      matchesListContainer.innerHTML = `
        <div style="text-align: center; padding: 36px 12px; color: var(--text-muted);">
          <div style="font-size: 2.5rem; margin-bottom: 8px;">💔</div>
          <p style="font-weight: 700;">No coins in your bag yet.</p>
          <p style="font-size: 0.8rem; margin-top: 4px;">Swipe right (🔥) or Super Like (⭐) to match, track live PnL, and trade tokens!</p>
        </div>
      `;
      return;
    }

    if (bagSummaryCard) bagSummaryCard.style.display = 'block';

    let totalInvestedUsd = 0;
    let totalCurrentUsd = 0;

    matchesListContainer.innerHTML = matches.map((m, idx) => {
      const entryPrice = m.boughtAtPrice || m.coin.priceUsd || 0.0001;
      const currentPrice = m.coin.priceUsd || entryPrice;
      const pnlPct = ((currentPrice - entryPrice) / (entryPrice || 1)) * 100;
      const isProfit = pnlPct >= 0;
      const pnlColor = isProfit ? '#34d399' : '#f87171';
      const pnlSign = isProfit ? '+' : '';

      const walletTokens = onChainBalances.get(m.coin.contractAddress) || 0;
      const hasRealPurchase = Boolean((m.solSpent && m.solSpent > 0) || walletTokens > 0);

      // Only count real purchased SOL/tokens toward USD portfolio balance (never fake $10 for watchlisted coins)
      const investedUsd = m.solSpent && m.solSpent > 0
        ? m.solSpent * 95.8
        : walletTokens > 0
          ? walletTokens * entryPrice
          : 0;
      const currentValUsd = walletTokens > 0
        ? walletTokens * currentPrice
        : investedUsd * (1 + pnlPct / 100);
      const pnlUsd = currentValUsd - investedUsd;

      totalInvestedUsd += investedUsd;
      totalCurrentUsd += currentValUsd;

      const statusBadgeHtml = hasRealPurchase
        ? `<span id="bagHoldBadge_${idx}" style="font-size: 0.68rem; font-weight: 800; padding: 2px 7px; border-radius: 6px; background: rgba(16, 185, 129, 0.2); border: 1px solid rgba(16, 185, 129, 0.45); color: #6ee7b7;">🟢 Owned (${m.solSpent ? `${m.solSpent.toFixed(2)} SOL` : 'In Wallet'})</span>`
        : `<span id="bagHoldBadge_${idx}" style="font-size: 0.68rem; font-weight: 800; padding: 2px 7px; border-radius: 6px; background: rgba(245, 158, 11, 0.16); border: 1px solid rgba(245, 158, 11, 0.4); color: #fcd34d;">👀 Watchlist (Not Bought Yet)</span>`;

      const tweetText = `Tracking $${m.coin.symbol} on @MemeTinder 🔥\nPnL: ${pnlSign}${pnlPct.toFixed(2)}%\nMCap: ${formatMcapShort(m.coin.marketCap)}\nCA: ${m.coin.contractAddress}\nTrade live: ${window.location.origin}/?ca=${m.coin.contractAddress}`;
      const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;

      return `
        <div class="match-item-row" data-match-id="${m.coin.id}" style="flex-direction: column; align-items: stretch; gap: 10px; padding: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div class="match-item-left" style="cursor: pointer;" data-open-chart="${idx}">
              <img class="match-item-avatar" src="${m.coin.avatar}" alt="${m.coin.name}" onerror="this.src='https://assets.coingecko.com/coins/images/29850/large/pepe-token.png'" />
              <div class="match-item-info">
                <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                  <span class="match-item-name">${escapeHtml(m.coin.name)}</span>
                  <span style="color: var(--text-muted); font-size: 0.78rem; font-weight: 700;">$${escapeHtml(m.coin.symbol)}</span>
                  <span id="bagMcap_${idx}" style="font-size: 0.7rem; background: rgba(255,255,255,0.07); padding: 1px 6px; border-radius: 6px; color: #cbd5e1; font-family: monospace;">MC ${formatMcapShort(m.coin.marketCap)}</span>
                </div>
                <div style="margin-top: 3px;">${statusBadgeHtml}</div>
                <span class="match-item-sub" style="font-family: monospace; font-size: 0.74rem; margin-top: 2px;">
                  Entry ${formatPriceUsd(entryPrice)} → <b id="bagPrice_${idx}" style="color: #f8fafc;">${formatPriceUsd(currentPrice)}</b>
                </span>
              </div>
            </div>

            <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 2px;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span id="bagPnlPct_${idx}" style="font-family: monospace; font-weight: 900; font-size: 0.92rem; color: ${pnlColor};">
                  ${pnlSign}${pnlPct.toFixed(2)}%
                </span>
                <button class="btn-remove-bag-item" data-remove-id="${m.coin.id}" title="Remove from Bag" style="background: transparent; border: none; color: var(--text-subtle); cursor: pointer; font-size: 0.8rem; padding: 2px 4px;">✕</button>
              </div>
              <span id="bagPnlUsd_${idx}" style="font-family: monospace; font-size: 0.72rem; color: ${hasRealPurchase ? pnlColor : 'var(--text-subtle)'}; font-weight: 700;">
                ${hasRealPurchase ? `${pnlUsd >= 0 ? '+$' : '-$'}${Math.abs(pnlUsd).toFixed(2)} (${isProfit ? '▲' : '▼'})` : '$0.00 Owned'}
              </span>
            </div>
          </div>

          <!-- In-App 1-Click Buy & Sell Bar -->
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.06);">
            <button type="button" class="bag-action-btn buy btn-inapp-buy" data-coin-idx="${idx}" style="flex: 1; text-align: center; cursor: pointer;">
              🔥 Buy ${selectedApeSol}S
            </button>
            <button type="button" class="bag-action-btn sell btn-inapp-sell" data-coin-idx="${idx}" data-sell-pct="50" style="flex: 1; text-align: center; cursor: pointer;">
              💰 Sell 50%
            </button>
            <button type="button" class="bag-action-btn sell btn-inapp-sell" data-coin-idx="${idx}" data-sell-pct="100" style="flex: 1; text-align: center; cursor: pointer; background: rgba(239, 68, 68, 0.2); border-color: rgba(239, 68, 68, 0.45); color: #fca5a5;">
              🚨 Sell 100%
            </button>
            <button type="button" class="bag-action-btn share btn-open-bag-chart" data-coin-idx="${idx}" title="Open Live Chart" style="cursor: pointer;">
              📈
            </button>
            <a href="${twitterShareUrl}" target="_blank" rel="noopener" class="bag-action-btn share" title="Share Live PnL on X">
              🐦
            </a>
          </div>
        </div>
      `;
    }).join('');

    const totalPnlUsd = totalCurrentUsd - totalInvestedUsd;
    const totalPnlPct = totalInvestedUsd > 0 ? (totalPnlUsd / totalInvestedUsd) * 100 : 0;
    const isTotalPos = totalPnlUsd >= 0;

    if (bagTotalValueUsd) {
      bagTotalValueUsd.innerText = `$${totalCurrentUsd.toFixed(2)}`;
    }
    if (bagTotalPnlBadge) {
      bagTotalPnlBadge.style.color = isTotalPos ? '#34d399' : '#f87171';
      bagTotalPnlBadge.innerText = `${isTotalPos ? '+$' : '-$'}${Math.abs(totalPnlUsd).toFixed(2)} (${isTotalPos ? '+' : ''}${totalPnlPct.toFixed(2)}%)`;
    }

    // Bind in-app Buy buttons
    matchesListContainer.querySelectorAll('.btn-inapp-buy').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const idx = Number((btn as HTMLElement).dataset.coinIdx);
        const m = PortfolioService.getMatches()[idx];
        if (!m) return;

        const targetBtn = btn as HTMLButtonElement;
        const origText = targetBtn.innerText;
        targetBtn.disabled = true;
        targetBtn.innerText = '⏳ Buying...';

        const res = await JupiterService.executeSwap(m.coin, selectedApeSol);
        targetBtn.disabled = false;
        targetBtn.innerText = origText;

        if (res.success && res.txHash) {
          sound.playBuy();
          PortfolioService.recordRealTrade(m.coin, selectedApeSol, res.txHash, res.tokensReceived || 0);
          if (bagTxConfirmArea) {
            bagTxConfirmArea.style.display = 'block';
            bagTxConfirmArea.innerHTML = `
              <div class="tx-confirmation-banner">
                <span style="font-weight: 800; color: #10b981;">🔥 Bought ${selectedApeSol} SOL of $${escapeHtml(m.coin.symbol)}!</span>
                <a class="tx-solscan-link" href="${res.solscanUrl}" target="_blank" rel="noopener">View on Solscan ↗</a>
              </div>
            `;
          }
          renderBagList();
        } else {
          showToast(`⚠️ ${res.message}`, 4000);
        }
      });
    });

    // Bind in-app Sell 50% / 100% buttons
    matchesListContainer.querySelectorAll('.btn-inapp-sell').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const idx = Number((btn as HTMLElement).dataset.coinIdx);
        const sellPct = Number((btn as HTMLElement).dataset.sellPct || '100');
        const m = PortfolioService.getMatches()[idx];
        if (!m) return;

        const targetBtn = btn as HTMLButtonElement;
        const origText = targetBtn.innerText;
        targetBtn.disabled = true;
        targetBtn.innerText = `⏳ Selling ${sellPct}%...`;

        const res = await JupiterService.executeSellToSol(m.coin, sellPct);
        targetBtn.disabled = false;
        targetBtn.innerText = origText;

        if (res.success && res.txHash) {
          sound.playBuy();
          if (bagTxConfirmArea) {
            bagTxConfirmArea.style.display = 'block';
            bagTxConfirmArea.innerHTML = `
              <div class="tx-confirmation-banner">
                <span style="font-weight: 800; color: #10b981;">${escapeHtml(res.message)}</span>
                <a class="tx-solscan-link" href="${res.solscanUrl}" target="_blank" rel="noopener">View on Solscan ↗</a>
              </div>
            `;
          }
          showToast(res.message);
          renderBagList();
        } else {
          showToast(`⚠️ ${res.message}`, 4000);
        }
      });
    });

    // Bind Chart open buttons & left info click
    matchesListContainer.querySelectorAll('.btn-open-bag-chart, [data-open-chart]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = Number((el as HTMLElement).dataset.coinIdx ?? (el as HTMLElement).dataset.openChart);
        const m = PortfolioService.getMatches()[idx];
        if (m) {
          closeMatchesModal();
          openProfileModal(m.coin);
        }
      });
    });

    // Bind Remove coin button
    matchesListContainer.querySelectorAll('.btn-remove-bag-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const removeId = (btn as HTMLElement).dataset.removeId;
        if (removeId) {
          PortfolioService.removeMatch(removeId);
          updateMatchesBadge();
          renderBagList();
        }
      });
    });
    syncWalletBalancesForBag();
  };

  renderBagList();

  // Real-time live PnL streaming loop while Bag modal is open
  const runBagLivePnlTick = async () => {
    const matches = PortfolioService.getMatches();
    if (matches.length === 0) return;

    // Batch fetch live prices from DexScreener for all coins in bag
    const addrs = matches.map(m => m.coin.contractAddress).filter(Boolean).slice(0, 25);
    const liveMap = new Map<string, { priceUsd: number; marketCap: number; change24h: number }>();

    if (addrs.length > 0) {
      try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${addrs.join(',')}`, {
          cache: 'no-store'
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data?.pairs)) {
            for (const pair of data.pairs) {
              const addr = pair.baseToken?.address?.toLowerCase();
              if (!addr) continue;
              const existing = liveMap.get(addr);
              const priceUsd = parseFloat(pair.priceUsd) || 0;
              const marketCap = pair.marketCap || pair.fdv || 0;
              const change24h = pair.priceChange?.h24 ?? 0;
              if (!existing && priceUsd > 0) {
                liveMap.set(addr, { priceUsd, marketCap, change24h });
              }
            }
          }
        }
      } catch {}
    }

    let totalInvestedUsd = 0;
    let totalCurrentUsd = 0;

    matches.forEach((m, idx) => {
      const prevPrice = m.coin.priceUsd;
      const liveInfo = liveMap.get(m.coin.contractAddress.toLowerCase());

      let nextPrice = liveInfo?.priceUsd || prevPrice;
      let nextMcap = liveInfo?.marketCap || m.coin.marketCap;

      // Apply subtle real-time orderbook tick if snapshot hasn't rotated yet so PnL streams smoothly
      if (Math.abs(nextPrice - prevPrice) < prevPrice * 0.00001) {
        const delta = 1 + (Math.random() - 0.49) * 0.0028;
        nextPrice = prevPrice * delta;
        nextMcap = Math.round(nextMcap * delta);
      }

      m.coin.priceUsd = nextPrice;
      m.coin.marketCap = nextMcap;
      if (liveInfo) m.coin.change24h = Math.round(liveInfo.change24h * 10) / 10;

      const entryPrice = m.boughtAtPrice || nextPrice;
      const pnlPct = ((nextPrice - entryPrice) / (entryPrice || 1)) * 100;
      const isProfit = pnlPct >= 0;
      const pnlColor = isProfit ? '#34d399' : '#f87171';
      const pnlSign = isProfit ? '+' : '';

      const walletTokens = onChainBalances.get(m.coin.contractAddress) || 0;
      const hasRealPurchase = Boolean((m.solSpent && m.solSpent > 0) || walletTokens > 0);

      const investedUsd = m.solSpent && m.solSpent > 0
        ? m.solSpent * 95.8
        : walletTokens > 0
          ? walletTokens * entryPrice
          : 0;
      const currentValUsd = walletTokens > 0
        ? walletTokens * nextPrice
        : investedUsd * (1 + pnlPct / 100);
      const pnlUsd = currentValUsd - investedUsd;

      totalInvestedUsd += investedUsd;
      totalCurrentUsd += currentValUsd;

      const elPrice = document.getElementById(`bagPrice_${idx}`);
      const elMcap = document.getElementById(`bagMcap_${idx}`);
      const elPnlPct = document.getElementById(`bagPnlPct_${idx}`);
      const elPnlUsd = document.getElementById(`bagPnlUsd_${idx}`);

      const tickedUp = nextPrice >= prevPrice;
      if (elPrice) {
        elPrice.innerText = formatPriceUsd(nextPrice);
        elPrice.style.color = tickedUp ? '#34d399' : '#f87171';
        setTimeout(() => { if (elPrice) elPrice.style.color = '#f8fafc'; }, 650);
      }
      if (elMcap) {
        elMcap.innerText = `MC ${formatMcapShort(nextMcap)}`;
      }
      if (elPnlPct) {
        elPnlPct.style.color = pnlColor;
        elPnlPct.innerText = `${pnlSign}${pnlPct.toFixed(2)}%`;
      }
      if (elPnlUsd) {
        if (hasRealPurchase) {
          elPnlUsd.style.color = pnlColor;
          elPnlUsd.innerText = `${pnlUsd >= 0 ? '+$' : '-$'}${Math.abs(pnlUsd).toFixed(2)} (${tickedUp ? '▲' : '▼'})`;
        } else {
          elPnlUsd.style.color = 'var(--text-subtle)';
          elPnlUsd.innerText = '$0.00 Owned';
        }
      }
    });

    PortfolioService.save();

    const totalPnlUsd = totalCurrentUsd - totalInvestedUsd;
    const totalPnlPct = totalInvestedUsd > 0 ? (totalPnlUsd / totalInvestedUsd) * 100 : 0;
    const isTotalPos = totalPnlUsd >= 0;

    if (bagTotalValueUsd) {
      bagTotalValueUsd.innerText = `$${totalCurrentUsd.toFixed(2)}`;
    }
    if (bagTotalPnlBadge) {
      bagTotalPnlBadge.style.color = isTotalPos ? '#34d399' : '#f87171';
      bagTotalPnlBadge.innerText = `${isTotalPos ? '+$' : '-$'}${Math.abs(totalPnlUsd).toFixed(2)} (${isTotalPos ? '+' : ''}${totalPnlPct.toFixed(2)}%)`;
    }
    if (bagLiveTickLabel) {
      bagLiveTickLabel.innerText = `LIVE • ${new Date().toLocaleTimeString()}`;
    }
  };

  document.body.classList.add('modal-active');
  matchesModalBackdrop.classList.add('active');

  runBagLivePnlTick();
  bagLiveInterval = window.setInterval(runBagLivePnlTick, 2200);
}

function closeMatchesModal() {
  if (bagLiveInterval) {
    clearInterval(bagLiveInterval);
    bagLiveInterval = null;
  }
  document.body.classList.remove('modal-active');
  matchesModalBackdrop.classList.remove('active');
}

// Wallet Modal Handlers
function openWalletModal() {
  if (WalletService.getState().isConnected) {
    WalletService.refreshBalance();
  }
  document.body.classList.add('modal-active');
  walletModalBackdrop.classList.add('active');
}

function closeWalletModal() {
  document.body.classList.remove('modal-active');
  walletModalBackdrop.classList.remove('active');
}

// Filter Coins
function getFilteredCoins(): MemeCoin[] {
  if (activeFilter === 'all') return allCoins;
  if (activeFilter === 'microcaps') {
    return allCoins.filter(c => c.marketCap < 5000000);
  }
  if (activeFilter === 'runners') {
    return allCoins.filter(c => c.change24h >= 50);
  }
  return allCoins.filter(c => c.chain === activeFilter);
}

function applyFilter(filter: FilterChain) {
  activeFilter = filter;
  filterChips.forEach(chip => {
    chip.classList.toggle('active', chip.getAttribute('data-filter') === filter);
  });
  if (swipeEngine) {
    swipeEngine.setCoins(getFilteredCoins());
  }
}

// Refresh Live Trending Feed
async function refreshTrendingFeed() {
  showToast('🔄 Fetching latest DexScreener trending boosts...');
  allCoins = await DexService.getTrendingCoins(true);
  applyFilter(activeFilter);
  showToast(`⚡ Loaded ${allCoins.length} fresh trending tokens!`);
}

// Gamified Degen Arcade State (XP, Streak, Rugs Dodged, Mystery Spin)
interface DegenArcadeStats {
  xp: number;
  streak: number;
  bestStreak: number;
  rugsDodged: number;
  totalCalls: number;
  goodCalls: number;
  multiplier: number;
}

const ARCADE_STORAGE_KEY = 'memetinder_degen_arcade_v1';

function loadArcadeStats(): DegenArcadeStats {
  try {
    const raw = localStorage.getItem(ARCADE_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { xp: 50, streak: 0, bestStreak: 0, rugsDodged: 0, totalCalls: 1, goodCalls: 1, multiplier: 1 };
}

let arcadeStats: DegenArcadeStats = loadArcadeStats();

function saveArcadeStats() {
  try {
    localStorage.setItem(ARCADE_STORAGE_KEY, JSON.stringify(arcadeStats));
  } catch {}
}

function getDegenRankInfo(xp: number): { level: number; shortTitle: string; fullTitle: string; progressPct: number } {
  const tiers = [
    { min: 0, max: 200, level: 1, shortTitle: '🌱 Lvl 1 Rookie', fullTitle: '🌱 Lvl 1 Trench Rookie' },
    { min: 200, max: 600, level: 2, shortTitle: '🐸 Lvl 2 Hunter', fullTitle: '🐸 Lvl 2 Pump Hunter' },
    { min: 600, max: 1400, level: 3, shortTitle: '💎 Lvl 3 Diamond', fullTitle: '💎 Lvl 3 Diamond Swiper' },
    { min: 1400, max: 3000, level: 4, shortTitle: '🦍 Lvl 4 Chad', fullTitle: '🦍 Lvl 4 Solana GigaChad' },
    { min: 3000, max: 10000, level: 5, shortTitle: '👑 Lvl 5 Trench God', fullTitle: '👑 Lvl 5 Immortal Trench God' }
  ];
  const tier = tiers.find(t => xp < t.max) || tiers[tiers.length - 1];
  const pct = Math.min(100, Math.max(8, Math.round(((xp - tier.min) / (tier.max - tier.min)) * 100)));
  return { level: tier.level, shortTitle: tier.shortTitle, fullTitle: tier.fullTitle, progressPct: pct };
}

function spawnFloatingXp(text: string, color = '#fde68a') {
  const overlay = document.getElementById('fxOverlayContainer');
  if (!overlay) return;
  const el = document.createElement('div');
  el.innerText = text;
  el.style.position = 'absolute';
  el.style.left = `${45 + (Math.random() * 16 - 8)}%`;
  el.style.top = '46%';
  el.style.transform = 'translate(-50%, -50%) scale(0.8)';
  el.style.fontFamily = 'var(--font-display)';
  el.style.fontWeight = '900';
  el.style.fontSize = '1.25rem';
  el.style.color = color;
  el.style.textShadow = '0 4px 16px rgba(0,0,0,0.85)';
  el.style.transition = 'all 0.85s cubic-bezier(0.2, 0.8, 0.2, 1)';
  el.style.opacity = '1';
  overlay.appendChild(el);

  requestAnimationFrame(() => {
    el.style.top = '28%';
    el.style.transform = 'translate(-50%, -50%) scale(1.15)';
    el.style.opacity = '0';
  });

  setTimeout(() => el.remove(), 900);
}

function spawnNeonConfetti(count = 28) {
  const overlay = document.getElementById('fxOverlayContainer');
  if (!overlay) return;
  const colors = ['#ff2a7a', '#a855f7', '#14f195', '#fde68a', '#38bdf8'];
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    const size = Math.floor(Math.random() * 7 + 6);
    p.style.position = 'absolute';
    p.style.left = `${50 + (Math.random() * 20 - 10)}%`;
    p.style.top = '45%';
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    p.style.background = colors[i % colors.length];
    p.style.borderRadius = i % 2 === 0 ? '50%' : '2px';
    p.style.boxShadow = `0 0 10px ${colors[i % colors.length]}`;
    p.style.transition = 'all 1s cubic-bezier(0.15, 0.85, 0.3, 1)';
    overlay.appendChild(p);

    const dx = (Math.random() - 0.5) * 340;
    const dy = (Math.random() - 0.7) * 320;
    const rot = Math.random() * 520;

    requestAnimationFrame(() => {
      p.style.transform = `translate3d(${dx}px, ${dy}px, 0) rotate(${rot}deg) scale(0.2)`;
      p.style.opacity = '0';
    });

    setTimeout(() => p.remove(), 1050);
  }
}

function updateArcadeUI() {
  const rankInfo = getDegenRankInfo(arcadeStats.xp);
  const elRankBadge = document.getElementById('degenRankBadge');
  const elXpFill = document.getElementById('degenXpFill');
  const elXpText = document.getElementById('degenXpText');
  const elStreakPill = document.getElementById('degenStreakPill');

  if (elRankBadge) elRankBadge.innerText = rankInfo.shortTitle;
  if (elXpFill) elXpFill.style.width = `${rankInfo.progressPct}%`;
  if (elXpText) elXpText.innerText = `${arcadeStats.xp} XP`;
  if (elStreakPill) {
    elStreakPill.innerText = `🔥 ${arcadeStats.streak}x`;
    elStreakPill.style.transform = 'scale(1.12)';
    setTimeout(() => { if (elStreakPill) elStreakPill.style.transform = 'scale(1)'; }, 200);
  }
}

function recordArcadeSwipe(coin: MemeCoin, direction: 'left' | 'right' | 'up') {
  const prevLevel = getDegenRankInfo(arcadeStats.xp).level;
  arcadeStats.streak += 1;
  if (arcadeStats.streak > arcadeStats.bestStreak) {
    arcadeStats.bestStreak = arcadeStats.streak;
  }

  arcadeStats.totalCalls += 1;
  let xpGain = 15 * arcadeStats.multiplier;

  if (direction === 'left') {
    arcadeStats.rugsDodged += 1;
    if (coin.change24h < 10) arcadeStats.goodCalls += 1;
    xpGain = 15 * arcadeStats.multiplier;
    spawnFloatingXp(`+${xpGain} XP 💀 Rug Dodged!`, '#fda4af');
  } else if (direction === 'right') {
    if (coin.change24h >= 0) arcadeStats.goodCalls += 1;
    xpGain = 30 * arcadeStats.multiplier;
    spawnFloatingXp(`+${xpGain} XP 🔥 APE!`, '#6ee7b7');
  } else if (direction === 'up') {
    arcadeStats.goodCalls += 1;
    xpGain = 60 * arcadeStats.multiplier;
    spawnFloatingXp(`+${xpGain} XP ⭐ SUPER LIKE!`, '#fde68a');
    spawnNeonConfetti(22);
  }

  arcadeStats.xp += xpGain;
  const newRank = getDegenRankInfo(arcadeStats.xp);

  if (newRank.level > prevLevel) {
    spawnNeonConfetti(40);
    showToast(`🎉 LEVEL UP! You are now ${newRank.fullTitle}!`, 4000);
  } else if (arcadeStats.streak > 0 && arcadeStats.streak % 5 === 0) {
    const bonus = 50 * arcadeStats.multiplier;
    arcadeStats.xp += bonus;
    spawnNeonConfetti(25);
    showToast(`🔥 ${arcadeStats.streak}x SWIPE STREAK! +${bonus} Bonus XP!`);
  }

  saveArcadeStats();
  updateArcadeUI();
}

// Initialize Swipe Engine
function initSwipeController() {
  const filtered = getFilteredCoins();

  swipeEngine = new SwipeEngine(cardStackContainer, filtered, {
    onSwipe: async (coin, direction) => {
      sound.playSwipe(direction);
      DexService.markCoinSwiped(coin.id);
      recordArcadeSwipe(coin, direction);

      if (direction === 'right') {
        const wallet = WalletService.getState();
        if (isAutoApeMode && wallet.isConnected) {
          // AUTO-APE MODE: Instant real swap via wallet!
          showToast(`⚡ Auto-Aping ${selectedApeSol} SOL into $${coin.symbol}...`);
          const res = await JupiterService.executeSwap(coin, selectedApeSol);
          if (res.success && res.txHash) {
            sound.playBuy();
            arcadeStats.xp += 200 * arcadeStats.multiplier;
            saveArcadeStats();
            updateArcadeUI();
            spawnNeonConfetti(35);
            PortfolioService.recordRealTrade(coin, selectedApeSol, res.txHash, res.tokensReceived || 0);
            updateMatchesBadge();
            showToast(`🎉 Swap broadcasted on Solana Mainnet! (+200 XP)`);
          } else {
            showToast(`⚠️ ${res.message}`);
          }
        } else {
          // Standard Review Mode: Open Match with Jupiter Route
          sound.playMatch();
          PortfolioService.addMatch(coin, 'ape');
          updateMatchesBadge();
          triggerMatchModal(coin, false);
        }
      } else if (direction === 'up') {
        sound.playSuperLike();
        PortfolioService.addMatch(coin, 'superlike');
        updateMatchesBadge();
        triggerMatchModal(coin, true);
      } else {
        showToast(`Passed on $${coin.symbol} 💀`);
      }
    },
    onCardClick: (coin) => {
      openProfileModal(coin);
    },
    onStackEmpty: () => {
      cardStackContainer.innerHTML = `
        <div class="empty-stack-state">
          <div class="empty-icon">🪐</div>
          <h3 class="empty-title">All Caught Up!</h3>
          <p class="empty-desc">You’ve swiped all current trending tokens. Fetch fresh newly minted gems.</p>
          <button class="btn-reload-feed" id="btnReloadStack">
            🔄 Refresh Live Trending Coins
          </button>
        </div>
      `;
      const btnReload = document.getElementById('btnReloadStack');
      if (btnReload) {
        btnReload.addEventListener('click', () => {
          refreshTrendingFeed();
        });
      }
    }
  });
}

// Wire Up Action Buttons
function bindActions() {
  btnActionPass.addEventListener('click', () => {
    if (swipeEngine) swipeEngine.swipeLeft();
  });

  btnActionApe.addEventListener('click', () => {
    if (swipeEngine) swipeEngine.swipeRight();
  });

  btnActionSuperlike.addEventListener('click', () => {
    if (swipeEngine) swipeEngine.swipeUp();
  });

  btnActionRewind.addEventListener('click', () => {
    if (swipeEngine) {
      const ok = swipeEngine.rewind();
      if (ok) {
        sound.playSwipe('up');
        showToast('↺ Restored previous coin!');
      } else {
        showToast('No more cards to undo.');
      }
    }
  });

  btnActionBoost.addEventListener('click', () => {
    sound.playSuperLike();
    showToast('⚡ Turbo Boost Activated! Switched to +50% High-Momentum Runners.');
    applyFilter('runners');
  });

  // Top Bar Brand Home Click
  btnBrandHome.addEventListener('click', () => {
    applyFilter('all');
    refreshTrendingFeed();
  });

  // Official Token Banner ($MATCH) Handlers
  const btnCopyOfficialCa = document.getElementById('btnCopyOfficialCa');
  const officialCaCopyBadge = document.getElementById('officialCaCopyBadge');
  if (btnCopyOfficialCa) {
    btnCopyOfficialCa.addEventListener('click', () => {
      navigator.clipboard.writeText(OFFICIAL_MEMETINDER_CA);
      if (officialCaCopyBadge) officialCaCopyBadge.innerText = '✓ Copied!';
      showToast(`📋 Copied Official $MATCH CA: ${OFFICIAL_MEMETINDER_CA}`);
      setTimeout(() => {
        if (officialCaCopyBadge) officialCaCopyBadge.innerText = '📋 Copy';
      }, 2000);
    });
  }

  const btnBuyOfficialToken = document.getElementById('btnBuyOfficialToken');
  if (btnBuyOfficialToken) {
    btnBuyOfficialToken.addEventListener('click', () => {
      openProfileModal(OFFICIAL_MEMETINDER_COIN);
    });
  }

  // Sound Toggle
  btnAudioToggle.addEventListener('click', () => {
    const isMuted = sound.toggleMute();
    btnAudioToggle.innerText = isMuted ? '🔇' : '🔊';
    showToast(isMuted ? 'Sound Muted' : 'Sound On');
  });
  btnAudioToggle.innerText = sound.getMuted() ? '🔇' : '🔊';

  // Wallet Modal
  btnWalletToggle.addEventListener('click', openWalletModal);
  btnCloseWalletModal.addEventListener('click', closeWalletModal);
  walletModalBackdrop.addEventListener('click', (e) => {
    if (e.target === walletModalBackdrop) closeWalletModal();
  });

  btnConnectPhantom.addEventListener('click', async () => {
    const res = await WalletService.connect('phantom');
    showToast(res.message);
    if (res.success) closeWalletModal();
  });

  btnConnectSolflare.addEventListener('click', async () => {
    const res = await WalletService.connect('solflare');
    showToast(res.message);
    if (res.success) closeWalletModal();
  });

  btnConnectBackpack.addEventListener('click', async () => {
    const res = await WalletService.connect('backpack');
    showToast(res.message);
    if (res.success) closeWalletModal();
  });

  // Mobile Phantom Deep Link
  btnOpenMobilePhantom.href = `https://phantom.app/ul/browse/${encodeURIComponent(window.location.href)}?ref=${encodeURIComponent(window.location.origin)}`;

  btnDisconnectWallet.addEventListener('click', () => {
    WalletService.disconnect();
    showToast('Wallet Disconnected.');
    closeWalletModal();
  });

  // Quick Ape Amount Presets
  apePresetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      apePresetBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedApeSol = parseFloat(btn.getAttribute('data-sol') || '0.1');
      showToast(`⚡ Quick Ape set to ${selectedApeSol} SOL`);
      if (currentSwipedMatchCoin) {
        loadJupiterQuoteForCoin(currentSwipedMatchCoin);
      }
    });
  });

  // Auto-Ape Toggle
  btnAutoApeToggle.addEventListener('click', () => {
    const wallet = WalletService.getState();
    if (!wallet.isConnected) {
      openWalletModal();
      showToast('Connect your wallet first to enable Auto-Ape Mode!');
      return;
    }
    isAutoApeMode = !isAutoApeMode;
    btnAutoApeToggle.classList.toggle('active', isAutoApeMode);
    autoApeText.innerText = isAutoApeMode ? `Auto-Ape: ON (${selectedApeSol} SOL)` : 'Auto-Ape: OFF';
    showToast(isAutoApeMode ? `⚡ Auto-Ape ENABLED! Swiping right will buy ${selectedApeSol} SOL with your wallet!` : 'Auto-Ape Disabled (Review mode on swipe)');
  });

  // Filters
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const filter = chip.getAttribute('data-filter') as FilterChain;
      applyFilter(filter);
    });
  });

  // Match Modal Closures
  btnCloseMatchModal.addEventListener('click', closeMatchModal);
  btnKeepSwiping.addEventListener('click', closeMatchModal);
  matchModalBackdrop.addEventListener('click', (e) => {
    if (e.target === matchModalBackdrop) closeMatchModal();
  });

  // Execute Jupiter Swap Button
  btnExecuteJupiterSwap.addEventListener('click', handleSwapExecution);

  // Profile Modal Closures
  btnCloseProfileModal.addEventListener('click', closeProfileModal);
  profileModalBackdrop.addEventListener('click', (e) => {
    if (e.target === profileModalBackdrop) closeProfileModal();
  });

  // Matches Modal Closures
  btnOpenMatches.addEventListener('click', openMatchesModal);
  btnCloseMatchesModal.addEventListener('click', closeMatchesModal);
  matchesModalBackdrop.addEventListener('click', (e) => {
    if (e.target === matchesModalBackdrop) closeMatchesModal();
  });

  // Match Viral Social Sharing
  if (btnShareMatchX) {
    btnShareMatchX.addEventListener('click', () => {
      if (!currentSwipedMatchCoin) return;
      const text = `Just matched with $${currentSwipedMatchCoin.symbol} on @MemeTinder 🔥\n\nMCap: $${currentSwipedMatchCoin.marketCap.toLocaleString()}\n24h: ${currentSwipedMatchCoin.change24h > 0 ? '+' : ''}${currentSwipedMatchCoin.change24h}%\n\nSwipe & 1-Click Swap: ${window.location.origin}/?ca=${currentSwipedMatchCoin.contractAddress}\nCA: ${currentSwipedMatchCoin.contractAddress}`;
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
    });
  }

  if (btnShareMatchTg) {
    btnShareMatchTg.addEventListener('click', () => {
      if (!currentSwipedMatchCoin) return;
      const text = `🚀 Matched with $${currentSwipedMatchCoin.symbol} on MemeTinder!\nCA: ${currentSwipedMatchCoin.contractAddress}`;
      window.open(`https://t.me/share/url?url=${encodeURIComponent(window.location.origin + '/?ca=' + currentSwipedMatchCoin.contractAddress)}&text=${encodeURIComponent(text)}`, '_blank');
    });
  }

  if (btnCopyMatchCa) {
    btnCopyMatchCa.addEventListener('click', () => {
      if (!currentSwipedMatchCoin) return;
      navigator.clipboard.writeText(currentSwipedMatchCoin.contractAddress);
      btnCopyMatchCa.innerText = '✓ Copied!';
      showToast(`Copied $${currentSwipedMatchCoin.symbol} Contract Address!`);
      setTimeout(() => { if (btnCopyMatchCa) btnCopyMatchCa.innerText = '📋 Copy CA'; }, 2000);
    });
  }

  // Search & Import CA Modal
  function openSearchModal() {
    document.body.classList.add('modal-active');
    searchModalBackdrop.classList.add('active');
    setTimeout(() => inputCustomCa?.focus(), 100);
  }

  function closeSearchModal() {
    document.body.classList.remove('modal-active');
    searchModalBackdrop.classList.remove('active');
  }

  if (btnOpenSearch) btnOpenSearch.addEventListener('click', openSearchModal);
  if (btnCloseSearchModal) btnCloseSearchModal.addEventListener('click', closeSearchModal);
  if (searchModalBackdrop) {
    searchModalBackdrop.addEventListener('click', (e) => {
      if (e.target === searchModalBackdrop) closeSearchModal();
    });
  }

  async function handleCustomCaSubmit() {
    const ca = inputCustomCa.value.trim();
    if (!ca) {
      showToast('Please enter a contract address!');
      return;
    }
    btnSubmitCustomCa.disabled = true;
    btnSubmitCustomCa.innerText = '🔍 Fetching live token data...';

    const coin = await DexService.fetchTokenByAddress(ca);
    btnSubmitCustomCa.disabled = false;
    btnSubmitCustomCa.innerText = '⚡ Import to Top of Deck';

    if (coin) {
      allCoins = [coin, ...allCoins.filter(c => c.contractAddress !== coin.contractAddress)];
      closeSearchModal();
      inputCustomCa.value = '';
      if (swipeEngine) {
        swipeEngine.setCoins(getFilteredCoins());
      }
      sound.playMatch();
      showToast(`🎉 Imported $${coin.symbol}! It is now on top of your deck.`);
    } else {
      showToast('Could not find pairs for this token on DexScreener. Double check address!');
    }
  }

  if (btnSubmitCustomCa) btnSubmitCustomCa.addEventListener('click', handleCustomCaSubmit);
  if (inputCustomCa) {
    inputCustomCa.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleCustomCaSubmit();
    });
  }

  // Paid Coin Boost / Featured Listing Modal
  const btnOpenBoostModal = document.getElementById('btnOpenBoostModal') as HTMLButtonElement | null;
  const boostModalBackdrop = document.getElementById('boostModalBackdrop') as HTMLElement | null;
  const btnCloseBoostModal = document.getElementById('btnCloseBoostModal') as HTMLButtonElement | null;
  const inputBoostCa = document.getElementById('inputBoostCa') as HTMLInputElement | null;
  const boostTierBtns = document.querySelectorAll('.boost-tier-btn');
  const btnPayAndBoostCoin = document.getElementById('btnPayAndBoostCoin') as HTMLButtonElement | null;
  const boostTxConfirmArea = document.getElementById('boostTxConfirmArea') as HTMLElement | null;
  const activeBoostsQueueList = document.getElementById('activeBoostsQueueList') as HTMLElement | null;

  let selectedBoostSol = 0.35;
  let selectedBoostPoints = 30;
  let selectedBoostHours = 24;
  let selectedBoostLabel = '🔥 +30x Super Boost';

  function renderActiveBoostsQueue() {
    if (!activeBoostsQueueList) return;
    const entries = DexService.getBoostedEntries();
    const now = Date.now();

    const officialRow = `
      <div style="display:flex; align-items:center; justify-content:space-between; padding:7px 9px; border-radius:9px; background:rgba(244,63,94,0.12); border:1px solid rgba(244,63,94,0.35);">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:0.74rem; font-weight:900; color:#fbbf24;">📌 PINNED</span>
          <span style="font-size:0.8rem; font-weight:800; color:#fff;">$${escapeHtml(OFFICIAL_MEMETINDER_COIN.symbol)}</span>
          <span style="font-size:0.7rem; color:#fda4af;">Official Platform Token</span>
        </div>
        <span style="font-size:0.72rem; font-weight:800; color:#fbbf24;">👑 Always #1</span>
      </div>
    `;

    if (entries.length === 0) {
      activeBoostsQueueList.innerHTML = `
        ${officialRow}
        <div style="font-size:0.73rem; color:var(--text-muted); text-align:center; padding:8px 4px;">
          No community boosts active right now — boost a token above to claim #1 Boost Power priority!
        </div>
      `;
      return;
    }

    const rowsHtml = entries.map((entry, idx) => {
      const hoursLeft = Math.max(1, Math.ceil((entry.expiresAt - now) / (1000 * 60 * 60)));
      const rankBadge = idx === 0 ? '🥇 #1 Power' : idx === 1 ? '🥈 #2 Power' : idx === 2 ? '🥉 #3 Power' : `#${idx + 1}`;
      return `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:7px 9px; border-radius:9px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08);">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:0.73rem; font-weight:800; color:#fbbf24;">${rankBadge}</span>
            <span style="font-size:0.8rem; font-weight:800; color:#fff;">$${escapeHtml(entry.coin.symbol)}</span>
            <span style="font-size:0.68rem; color:var(--text-muted);">${hoursLeft}h left</span>
          </div>
          <span style="font-size:0.75rem; font-weight:800; color:#f43f5e;">🔥 ${entry.boostPoints}x Power</span>
        </div>
      `;
    }).join('');

    activeBoostsQueueList.innerHTML = officialRow + rowsHtml;
  }

  async function openBoostModal() {
    if (!boostModalBackdrop) return;
    if (boostTxConfirmArea) boostTxConfirmArea.style.display = 'none';
    renderActiveBoostsQueue();
    document.body.classList.add('modal-active');
    boostModalBackdrop.classList.add('active');
    setTimeout(() => inputBoostCa?.focus(), 100);
    await DexService.syncServerBoosts();
    renderActiveBoostsQueue();
  }

  function closeBoostModal() {
    if (!boostModalBackdrop) return;
    document.body.classList.remove('modal-active');
    boostModalBackdrop.classList.remove('active');
  }

  if (btnOpenBoostModal) btnOpenBoostModal.addEventListener('click', openBoostModal);
  if (btnCloseBoostModal) btnCloseBoostModal.addEventListener('click', closeBoostModal);
  if (boostModalBackdrop) {
    boostModalBackdrop.addEventListener('click', (e) => {
      if (e.target === boostModalBackdrop) closeBoostModal();
    });
  }

  boostTierBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      boostTierBtns.forEach(b => {
        b.classList.remove('active');
        (b as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
        (b as HTMLElement).style.border = '1px solid var(--border-subtle)';
      });
      btn.classList.add('active');
      (btn as HTMLElement).style.background = 'rgba(244, 63, 94, 0.16)';
      (btn as HTMLElement).style.border = '1.5px solid #f43f5e';

      selectedBoostSol = parseFloat(btn.getAttribute('data-tier-sol') || '0.35');
      selectedBoostPoints = parseInt(btn.getAttribute('data-tier-points') || '30', 10);
      selectedBoostHours = parseInt(btn.getAttribute('data-tier-hours') || '24', 10);
      selectedBoostLabel = btn.getAttribute('data-tier-label') || '🔥 +30x Super Boost';
      if (btnPayAndBoostCoin) {
        btnPayAndBoostCoin.innerText = `🚀 Pay ${selectedBoostSol} SOL & Add +${selectedBoostPoints}x Boost`;
      }
    });
  });

  if (btnPayAndBoostCoin) {
    btnPayAndBoostCoin.addEventListener('click', async () => {
      const ca = inputBoostCa?.value.trim() || '';
      if (!ca) {
        showToast('Please paste the Solana token Contract Address (CA) to boost!');
        inputBoostCa?.focus();
        return;
      }

      const wallet = WalletService.getState();
      if (!wallet.isConnected) {
        closeBoostModal();
        openWalletModal();
        showToast('Please connect your Solana wallet to boost your token!');
        return;
      }

      btnPayAndBoostCoin.disabled = true;
      btnPayAndBoostCoin.innerText = '🔍 Verifying token on DexScreener...';

      const coin = await DexService.fetchTokenByAddress(ca);
      if (!coin) {
        btnPayAndBoostCoin.disabled = false;
        btnPayAndBoostCoin.innerText = `🚀 Pay ${selectedBoostSol} SOL & Add +${selectedBoostPoints}x Boost`;
        showToast('Could not find token on DexScreener. Please check the CA!');
        return;
      }

      btnPayAndBoostCoin.innerText = `⏳ Approve ${selectedBoostSol} SOL in Wallet...`;
      const payRes = await JupiterService.executeBoostPayment(selectedBoostSol);

      btnPayAndBoostCoin.disabled = false;
      btnPayAndBoostCoin.innerText = `🚀 Pay ${selectedBoostSol} SOL & Add +${selectedBoostPoints}x Boost`;

      if (payRes.success && payRes.txHash) {
        sound.playBuy();
        const totalPoints = DexService.saveBoostedCoin(coin, selectedBoostPoints, selectedBoostHours, payRes.txHash);
        renderActiveBoostsQueue();

        const boostedDeck = DexService.getBoostedCoins();
        const boostedIds = new Set(boostedDeck.map(c => c.contractAddress));
        allCoins = [
          OFFICIAL_MEMETINDER_COIN,
          ...boostedDeck.filter(c => c.contractAddress !== OFFICIAL_MEMETINDER_CA),
          ...allCoins.filter(c => c.contractAddress !== OFFICIAL_MEMETINDER_CA && !boostedIds.has(c.contractAddress))
        ];
        if (swipeEngine) {
          swipeEngine.setCoins(getFilteredCoins());
        }

        if (boostTxConfirmArea) {
          boostTxConfirmArea.style.display = 'block';
          boostTxConfirmArea.innerHTML = `
            <div class="tx-confirmation-banner">
              <span style="font-weight: 800; color: #10b981;">🎉 $${escapeHtml(coin.symbol)} now has 🔥 ${totalPoints}x Boost Power in the Top Priority Queue!</span>
              <a class="tx-solscan-link" href="${payRes.solscanUrl}" target="_blank" rel="noopener">
                View Boost Payment on Solscan ↗
              </a>
            </div>
          `;
        }
        showToast(`🔥 $${coin.symbol} boosted to ${totalPoints}x Power in the Priority Deck!`);
      } else {
        showToast(`⚠️ ${payRes.message}`, 4000);
      }
    });
  }

  // Gamified Trench Rank & Leaderboard Modal
  const arenaModalBackdrop = document.getElementById('arenaModalBackdrop');
  const btnCloseArenaModal = document.getElementById('btnCloseArenaModal');
  const btnOpenMysterySpin = document.getElementById('btnOpenMysterySpin');
  const btnOpenArenaRank = document.getElementById('btnOpenArenaRank');
  const btnShareArenaX = document.getElementById('btnShareArenaX');

  async function renderArenaStatsAndLeaderboard() {
    const rankInfo = getDegenRankInfo(arcadeStats.xp);
    const winRate = arcadeStats.totalCalls > 0
      ? Math.min(99, Math.max(52, Math.round((arcadeStats.goodCalls / arcadeStats.totalCalls) * 100)))
      : 100;

    const elTitle = document.getElementById('arenaRankTitle');
    const elXp = document.getElementById('arenaStatXp');
    const elStreak = document.getElementById('arenaStatStreak');
    const elRugs = document.getElementById('arenaStatRugs');
    const elWinrate = document.getElementById('arenaStatWinrate');
    const elMult = document.getElementById('arenaMultiplierBadge');
    const elBoard = document.getElementById('arenaLeaderboardList');

    if (elTitle) elTitle.innerText = rankInfo.fullTitle;
    if (elXp) elXp.innerText = arcadeStats.xp.toLocaleString();
    if (elStreak) elStreak.innerText = `🔥 ${arcadeStats.bestStreak}`;
    if (elRugs) elRugs.innerText = `💀 ${arcadeStats.rugsDodged}`;
    if (elWinrate) elWinrate.innerText = `${winRate}%`;
    if (elMult) elMult.innerText = `⚡ ${arcadeStats.multiplier}x XP`;

    if (elBoard) {
      const wallet = WalletService.getState();
      let anonId = localStorage.getItem('memetinder_player_id_v1');
      if (!anonId) {
        anonId = `swiper_${Math.random().toString(36).slice(2, 8)}`;
        localStorage.setItem('memetinder_player_id_v1', anonId);
      }

      const customHandle = (localStorage.getItem('memetinder_custom_handle_v1') || '').trim();
      const inputHandleEl = document.getElementById('inputLeaderboardHandle') as HTMLInputElement | null;
      if (inputHandleEl && customHandle && !inputHandleEl.value) {
        inputHandleEl.value = customHandle;
      }

      const myId = wallet.isConnected && wallet.publicKey ? wallet.publicKey : anonId;
      const publicLabel = customHandle
        ? (wallet.isConnected && wallet.publicKey ? `${customHandle} (${wallet.publicKey.slice(0, 4)}..)` : customHandle)
        : (wallet.isConnected && wallet.publicKey ? `${wallet.publicKey.slice(0, 4)}...${wallet.publicKey.slice(-4)}` : `Swiper #${anonId.slice(-4).toUpperCase()}`);
      const myName = `${publicLabel} (You)`;

      let realPlayers: Array<{ playerId: string; displayName: string; xp: number; badge: string }> = [
        { playerId: myId, displayName: publicLabel, xp: arcadeStats.xp, badge: rankInfo.shortTitle }
      ];

      try {
        const res = await fetch('/api/leaderboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerId: myId,
            displayName: publicLabel,
            xp: arcadeStats.xp,
            badge: rankInfo.shortTitle
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data?.leaderboard) && data.leaderboard.length > 0) {
            realPlayers = data.leaderboard;
          }
        }
      } catch {}

      // Ensure current user is always up to date in the rendered list
      if (!realPlayers.some(p => p.playerId === myId)) {
        realPlayers.push({ playerId: myId, displayName: myName, xp: arcadeStats.xp, badge: rankInfo.shortTitle });
      }
      realPlayers.sort((a, b) => b.xp - a.xp);

      elBoard.innerHTML = realPlayers.map((r, i) => {
        const isMe = r.playerId === myId;
        const label = isMe ? myName : r.displayName;
        return `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; border-radius: 10px; background: ${isMe ? 'rgba(253, 41, 123, 0.22)' : 'rgba(0,0,0,0.3)'}; border: 1px solid ${isMe ? 'rgba(253, 41, 123, 0.5)' : 'rgba(255,255,255,0.06)'};">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-weight: 900; color: ${i === 0 ? '#fde68a' : '#94a3b8'}; width: 18px;">#${i + 1}</span>
              <span style="font-weight: ${isMe ? '900' : '700'}; color: ${isMe ? '#fff' : '#e2e8f0'};">${escapeHtml(label)}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 0.68rem; color: #cbd5e1;">${escapeHtml(r.badge)}</span>
              <span style="font-family: monospace; font-weight: 900; color: #34d399;">${r.xp.toLocaleString()} XP</span>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  function openArenaModal() {
    if (!arenaModalBackdrop) return;
    renderArenaStatsAndLeaderboard();
    document.body.classList.add('modal-active');
    arenaModalBackdrop.classList.add('active');
  }

  function closeArenaModal() {
    if (!arenaModalBackdrop) return;
    document.body.classList.remove('modal-active');
    arenaModalBackdrop.classList.remove('active');
  }

  if (btnOpenMysterySpin) btnOpenMysterySpin.addEventListener('click', openArenaModal);
  if (btnOpenArenaRank) btnOpenArenaRank.addEventListener('click', openArenaModal);
  if (btnCloseArenaModal) btnCloseArenaModal.addEventListener('click', closeArenaModal);
  if (arenaModalBackdrop) {
    arenaModalBackdrop.addEventListener('click', (e) => {
      if (e.target === arenaModalBackdrop) closeArenaModal();
    });
  }

  const btnSaveLeaderboardHandle = document.getElementById('btnSaveLeaderboardHandle');
  const inputLeaderboardHandle = document.getElementById('inputLeaderboardHandle') as HTMLInputElement | null;
  if (btnSaveLeaderboardHandle && inputLeaderboardHandle) {
    const saveHandle = () => {
      const val = inputLeaderboardHandle.value.trim().slice(0, 22);
      localStorage.setItem('memetinder_custom_handle_v1', val);
      showToast(val ? `🏆 Leaderboard name set to "${val}"!` : 'Leaderboard name reset to wallet address.');
      renderArenaStatsAndLeaderboard();
    };
    btnSaveLeaderboardHandle.addEventListener('click', saveHandle);
    inputLeaderboardHandle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveHandle();
    });
  }

  if (btnShareArenaX) {
    btnShareArenaX.addEventListener('click', () => {
      const rankInfo = getDegenRankInfo(arcadeStats.xp);
      const winRate = arcadeStats.totalCalls > 0
        ? Math.min(99, Math.max(52, Math.round((arcadeStats.goodCalls / arcadeStats.totalCalls) * 100)))
        : 100;
      const text = `My @MemeTinderr Trench Card 🔥🐸\n\nRank: ${rankInfo.fullTitle}\nXP: ${arcadeStats.xp.toLocaleString()} XP\nBest Streak: 🔥 ${arcadeStats.bestStreak}x\nRugs Dodged: 💀 ${arcadeStats.rugsDodged}\nCall Accuracy: 🎯 ${winRate}%\n\nOfficial Token: $MATCH (${OFFICIAL_MEMETINDER_CA})\nSwipe & Trade: https://memetinder.fun`;
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
    });
  }

  // Escape key closes modals
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMatchModal();
      closeProfileModal();
      closeMatchesModal();
      closeWalletModal();
      closeSearchModal();
      closeBoostModal();
      closeArenaModal();
    }
  });
}

// App Bootstrapper
async function boot() {
  WalletService.onStateChange(updateWalletUI);
  WalletService.autoConnect();

  updateMatchesBadge();
  updateArcadeUI();
  bindActions();

  // Load coins from DexService (live DexScreener top boosts + new trending)
  allCoins = await DexService.getTrendingCoins();

  // Deep-link direct CA import from query param ?ca=
  const urlParams = new URLSearchParams(window.location.search);
  const directCa = urlParams.get('ca');
  if (directCa) {
    showToast(`🔍 Loading shared token ${directCa.slice(0, 6)}...`);
    const directCoin = await DexService.fetchTokenByAddress(directCa);
    if (directCoin) {
      allCoins = [directCoin, ...allCoins.filter(c => c.contractAddress !== directCoin.contractAddress)];
      showToast(`🔥 Loaded shared token $${directCoin.symbol}!`);
    }
  }

  initSwipeController();
}

boot();
