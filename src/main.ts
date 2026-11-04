import { MemeCoin, FilterChain } from './types';
import { DexService } from './dexService';
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
  let baselineJupTokens: number | null = null;
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

  const btnProfileQuickApe = document.getElementById('btnProfileQuickApe');
  if (btnProfileQuickApe) {
    btnProfileQuickApe.addEventListener('click', () => {
      closeProfileModal();
      PortfolioService.addMatch(coin, 'ape');
      updateMatchesBadge();
      triggerMatchModal(coin, false);
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

  // Real-time live polling loop (DexScreener pair feed + live Jupiter AMM reserve quote)
  const runLiveTick = async () => {
    const [dexData, jupQuote] = await Promise.all([
      DexService.fetchLiveMetrics(coin.contractAddress),
      JupiterService.getQuote(coin.contractAddress, 0.1)
    ]);

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

    // Incorporate live on-chain AMM pool movement from Jupiter quote
    if (jupQuote && jupQuote.outAmountTokens > 0) {
      if (!baselineJupTokens) {
        baselineJupTokens = jupQuote.outAmountTokens;
      } else {
        const poolRatio = baselineJupTokens / jupQuote.outAmountTokens;
        if (poolRatio > 0.5 && poolRatio < 2.0) {
          nextPrice = baselineDexPrice * poolRatio;
          nextMcap = baselineDexMcap * poolRatio;
        }
      }
    }

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

// Open Matches / Bag Modal
function openMatchesModal() {
  const matches = PortfolioService.getMatches();

  if (matches.length === 0) {
    matchesListContainer.innerHTML = `
      <div style="text-align: center; padding: 36px 12px; color: var(--text-muted);">
        <div style="font-size: 2.5rem; margin-bottom: 8px;">💔</div>
        <p style="font-weight: 700;">No matches in your bag yet.</p>
        <p style="font-size: 0.8rem; margin-top: 4px;">Swipe right (🔥) or Super Like (⭐) to match and trade tokens!</p>
      </div>
    `;
  } else {
    matchesListContainer.innerHTML = matches.map(m => {
      const isPos = m.coin.change24h >= 0;
      const jupBuyUrl = JupiterService.getJupiterDirectUrl(m.coin.contractAddress);
      const jupSellUrl = `https://jup.ag/swap/${m.coin.contractAddress}-SOL`;
      const tweetText = `Holding $${m.coin.symbol} from @MemeTinder 🔥\nPrice: $${m.coin.priceUsd.toFixed(6)}\nCA: ${m.coin.contractAddress}\nSwap here: ${window.location.origin}/?ca=${m.coin.contractAddress}`;
      const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;

      return `
        <div class="match-item-row" data-match-id="${m.coin.id}">
          <div class="match-item-left">
            <img class="match-item-avatar" src="${m.coin.avatar}" alt="${m.coin.name}" onerror="this.src='https://assets.coingecko.com/coins/images/29850/large/pepe-token.png'" />
            <div class="match-item-info">
              <span class="match-item-name">${escapeHtml(m.coin.name)} <span style="color: var(--text-muted); font-size: 0.8rem;">$${escapeHtml(m.coin.symbol)}</span></span>
              <span class="match-item-sub">
                ${m.action === 'superlike' ? '⭐ Super Liked' : '🔥 Matched'} · $${m.coin.priceUsd < 0.01 ? m.coin.priceUsd.toFixed(6) : m.coin.priceUsd.toFixed(2)}
                ${m.solSpent ? ` · <b style="color: #34d399;">${m.solSpent} SOL</b>` : ''}
              </span>
            </div>
          </div>
          <div class="match-item-right" style="display: flex; align-items: center; gap: 6px;">
            <span style="font-weight: 800; font-size: 0.85rem; color: ${isPos ? '#34d399' : '#f87171'};">
              ${isPos ? '+' : ''}${m.coin.change24h}%
            </span>
            <a href="${jupBuyUrl}" target="_blank" rel="noopener" class="bag-action-btn buy" title="Buy more on Jupiter">
              🪐 Buy
            </a>
            <a href="${jupSellUrl}" target="_blank" rel="noopener" class="bag-action-btn sell" title="Sell / Take Profit back to SOL on Jupiter">
              💰 Sell
            </a>
            <a href="${twitterShareUrl}" target="_blank" rel="noopener" class="bag-action-btn share" title="Share bag on X (Twitter)">
              🐦
            </a>
          </div>
        </div>
      `;
    }).join('');

    // Clicking row opens profile modal
    matchesListContainer.querySelectorAll('.match-item-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).tagName === 'A') return;
        const coinId = (row as HTMLElement).dataset.matchId;
        const coin = allCoins.find(c => c.id === coinId);
        if (coin) {
          closeMatchesModal();
          openProfileModal(coin);
        }
      });
    });
  }

  document.body.classList.add('modal-active');
  matchesModalBackdrop.classList.add('active');
}

function closeMatchesModal() {
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

// Initialize Swipe Engine
function initSwipeController() {
  const filtered = getFilteredCoins();

  swipeEngine = new SwipeEngine(cardStackContainer, filtered, {
    onSwipe: async (coin, direction) => {
      sound.playSwipe(direction);
      DexService.markCoinSwiped(coin.id);

      if (direction === 'right') {
        const wallet = WalletService.getState();
        if (isAutoApeMode && wallet.isConnected) {
          // AUTO-APE MODE: Instant real swap via wallet!
          showToast(`⚡ Auto-Aping ${selectedApeSol} SOL into $${coin.symbol}...`);
          const res = await JupiterService.executeSwap(coin, selectedApeSol);
          if (res.success) {
            sound.playBuy();
            updateMatchesBadge();
            showToast(`🎉 Swap broadcasted on Solana Mainnet!`);
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

  let selectedBoostSol = 0.35;
  let selectedBoostLabel = '🔥 24h Super Match';

  function openBoostModal() {
    if (!boostModalBackdrop) return;
    if (boostTxConfirmArea) boostTxConfirmArea.style.display = 'none';
    document.body.classList.add('modal-active');
    boostModalBackdrop.classList.add('active');
    setTimeout(() => inputBoostCa?.focus(), 100);
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
      selectedBoostLabel = btn.getAttribute('data-tier-label') || '🔥 24h Super Match';
      if (btnPayAndBoostCoin) {
        btnPayAndBoostCoin.innerText = `🚀 Pay ${selectedBoostSol} SOL & Boost Token Now`;
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
        btnPayAndBoostCoin.innerText = `🚀 Pay ${selectedBoostSol} SOL & Boost Token Now`;
        showToast('Could not find token on DexScreener. Please check the CA!');
        return;
      }

      btnPayAndBoostCoin.innerText = `⏳ Approve ${selectedBoostSol} SOL in Wallet...`;
      const payRes = await JupiterService.executeBoostPayment(selectedBoostSol);

      btnPayAndBoostCoin.disabled = false;
      btnPayAndBoostCoin.innerText = `🚀 Pay ${selectedBoostSol} SOL & Boost Token Now`;

      if (payRes.success && payRes.txHash) {
        sound.playBuy();
        coin.tagline = `${selectedBoostLabel} • Featured on MemeTinder`;
        coin.traits = [selectedBoostLabel, '👑 Sponsored Gem', ...coin.traits.slice(0, 1)];
        coin.hypeScore = 100;
        coin.verified = true;

        DexService.saveBoostedCoin(coin);
        allCoins = [coin, ...allCoins.filter(c => c.contractAddress !== coin.contractAddress)];
        if (swipeEngine) {
          swipeEngine.setCoins(getFilteredCoins());
        }

        if (boostTxConfirmArea) {
          boostTxConfirmArea.style.display = 'block';
          boostTxConfirmArea.innerHTML = `
            <div class="tx-confirmation-banner">
              <span style="font-weight: 800; color: #10b981;">🎉 $${escapeHtml(coin.symbol)} is now BOOSTED to #1 on the Deck!</span>
              <a class="tx-solscan-link" href="${payRes.solscanUrl}" target="_blank" rel="noopener">
                View Boost Payment on Solscan ↗
              </a>
            </div>
          `;
        }
        showToast(`👑 $${coin.symbol} is now Boosted & Featured at the top of the deck!`);
      } else {
        showToast(`⚠️ ${payRes.message}`, 4000);
      }
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
    }
  });
}

// App Bootstrapper
async function boot() {
  WalletService.onStateChange(updateWalletUI);
  WalletService.autoConnect();

  updateMatchesBadge();
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
