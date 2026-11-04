import { MemeCoin, FilterChain } from './types';
import { DexService } from './dexService';
import { SwipeEngine } from './swipeEngine';
import { SoundEngine } from './soundEngine';
import { PortfolioService } from './portfolioService';
import { WalletService, WalletState } from './walletService';
import { JupiterService, JupiterQuote } from './jupiterService';

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
const walletModalAddress = document.getElementById('walletModalAddress') as HTMLElement;
const walletModalSolBal = document.getElementById('walletModalSolBal') as HTMLElement;
const walletStatusTypeBadge = document.getElementById('walletStatusTypeBadge') as HTMLElement;
const btnConnectPhantom = document.getElementById('btnConnectPhantom') as HTMLButtonElement;
const btnSwitchToDemo = document.getElementById('btnSwitchToDemo') as HTMLButtonElement;
const btnFaucetDemoSol = document.getElementById('btnFaucetDemoSol') as HTMLButtonElement;
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
const btnKeepSwiping = document.getElementById('btnKeepSwiping') as HTMLButtonElement;

// Jupiter Swap DOM
const jupRouteLabel = document.getElementById('jupRouteLabel') as HTMLElement;
const jupInAmount = document.getElementById('jupInAmount') as HTMLElement;
const jupOutAmount = document.getElementById('jupOutAmount') as HTMLElement;
const btnExecuteJupiterSwap = document.getElementById('btnExecuteJupiterSwap') as HTMLButtonElement;
const btnSwapLabel = document.getElementById('btnSwapLabel') as HTMLElement;
const txConfirmationArea = document.getElementById('txConfirmationArea') as HTMLElement;

// Profile Modal
const profileModalBackdrop = document.getElementById('profileModalBackdrop') as HTMLElement;
const btnCloseProfileModal = document.getElementById('btnCloseProfileModal') as HTMLButtonElement;
const profileModalBody = document.getElementById('profileModalBody') as HTMLElement;

// Matches & Portfolio Modal
const matchesModalBackdrop = document.getElementById('matchesModalBackdrop') as HTMLElement;
const btnOpenMatches = document.getElementById('btnOpenMatches') as HTMLButtonElement;
const btnCloseMatchesModal = document.getElementById('btnCloseMatchesModal') as HTMLButtonElement;
const portfolioCashVal = document.getElementById('portfolioCashVal') as HTMLElement;
const portfolioNetWorthVal = document.getElementById('portfolioNetWorthVal') as HTMLElement;
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

// Update Wallet UI
function updateWalletUI(wallet: WalletState) {
  if (wallet.isConnected) {
    btnWalletToggle.classList.add('connected');
    if (wallet.type === 'phantom') {
      const short = wallet.publicKey ? `${wallet.publicKey.slice(0, 4)}...${wallet.publicKey.slice(-4)}` : 'Phantom';
      walletBtnLabel.innerHTML = `👻 <b>${wallet.solBalance.toFixed(2)} SOL</b> (${short})`;
      walletStatusTypeBadge.innerText = 'PHANTOM (MAINNET)';
      walletStatusTypeBadge.style.background = 'rgba(168, 85, 247, 0.2)';
      walletStatusTypeBadge.style.color = '#d8b4fe';
    } else {
      walletBtnLabel.innerHTML = `🧪 <b>${wallet.solBalance.toFixed(2)} SOL</b> (Demo)`;
      walletStatusTypeBadge.innerText = 'DEMO DEGEN (FREE)';
      walletStatusTypeBadge.style.background = 'rgba(16, 185, 129, 0.2)';
      walletStatusTypeBadge.style.color = '#34d399';
    }
    walletModalAddress.innerText = wallet.publicKey || 'Connected';
    walletModalSolBal.innerText = `${wallet.solBalance.toFixed(3)} SOL`;
  } else {
    btnWalletToggle.classList.remove('connected');
    walletBtnLabel.innerText = '🟣 Connect Wallet';
    walletModalAddress.innerText = 'Not Connected';
    walletModalSolBal.innerText = '0.000 SOL';
    walletStatusTypeBadge.innerText = 'DISCONNECTED';
    walletStatusTypeBadge.style.background = 'rgba(239, 68, 68, 0.2)';
    walletStatusTypeBadge.style.color = '#f87171';
  }
}

// Fetch & Update Jupiter Swap Quote for Match Modal
async function loadJupiterQuoteForCoin(coin: MemeCoin) {
  currentJupiterQuote = null;
  jupInAmount.innerText = `${selectedApeSol} SOL (~$${(selectedApeSol * 95.8).toFixed(2)})`;
  jupOutAmount.innerText = 'Fetching live Jupiter quote...';
  jupRouteLabel.innerText = '🪐 Jupiter Routing...';
  txConfirmationArea.style.display = 'none';
  btnExecuteJupiterSwap.disabled = false;
  btnSwapLabel.innerText = `🔥 1-Click Ape ${selectedApeSol} SOL Now`;

  const quote = await JupiterService.getQuote(coin.contractAddress, selectedApeSol);
  currentJupiterQuote = quote;

  if (quote) {
    const formattedTokens = quote.outAmountTokens > 1000 
      ? quote.outAmountTokens.toLocaleString(undefined, { maximumFractionDigits: 0 })
      : quote.outAmountTokens.toFixed(2);
    jupOutAmount.innerText = `~${formattedTokens} $${coin.symbol}`;
    jupRouteLabel.innerText = `🪐 ${quote.routeLabel}`;
  } else {
    // Realistic fallback estimation based on live coin price
    const estTokens = (selectedApeSol * 95.8) / (coin.priceUsd || 0.001);
    const formattedTokens = estTokens > 1000 
      ? estTokens.toLocaleString(undefined, { maximumFractionDigits: 0 })
      : estTokens.toFixed(2);
    jupOutAmount.innerText = `~${formattedTokens} $${coin.symbol}`;
    jupRouteLabel.innerText = '🪐 Jupiter ➔ Raydium CPMM';
  }
}

// Open Match Modal with Jupiter Swap
async function triggerMatchModal(coin: MemeCoin, isSuperLike = false) {
  currentSwipedMatchCoin = coin;
  matchSubtitleText.innerText = isSuperLike 
    ? `⭐ SUPER LIKE! 1-Click Swap $${coin.symbol} via Jupiter.`
    : `You matched with $${coin.symbol}! Ape in directly on Solana.`;
  
  matchCoinAvatar.src = coin.avatar;
  btnOpenDexChart.href = coin.dexScreenerUrl;

  document.body.classList.add('modal-active');
  matchModalBackdrop.classList.add('active');

  loadJupiterQuoteForCoin(coin);
}

function closeMatchModal() {
  document.body.classList.remove('modal-active');
  matchModalBackdrop.classList.remove('active');
}

// Execute 1-Click Swap
async function handleSwapExecution() {
  if (!currentSwipedMatchCoin) return;
  const coin = currentSwipedMatchCoin;

  btnExecuteJupiterSwap.disabled = true;
  btnSwapLabel.innerText = '⏳ Routing Swap via Jupiter...';

  const res = await JupiterService.executeSwap(coin, selectedApeSol, currentJupiterQuote);

  if (res.success) {
    sound.playBuy();
    updateMatchesBadge();
    btnSwapLabel.innerText = '✓ Swap Confirmed!';
    
    // Show Solscan transaction link
    txConfirmationArea.style.display = 'block';
    txConfirmationArea.innerHTML = `
      <div class="tx-confirmation-banner">
        <span style="font-weight: 800; color: #10b981;">🚀 1-Click Swap Confirmed on Solana!</span>
        <span style="color: #cbd5e1;">Aped ${selectedApeSol} SOL into <b>${res.tokensReceived ? (res.tokensReceived > 1000 ? res.tokensReceived.toLocaleString(undefined, { maximumFractionDigits: 0 }) : res.tokensReceived.toFixed(2)) : ''} $${coin.symbol}</b></span>
        <a class="tx-solscan-link" href="${res.solscanUrl}" target="_blank" rel="noopener">
          View on Solscan ↗
        </a>
      </div>
    `;
    showToast(`⚡ Aped ${selectedApeSol} SOL into $${coin.symbol}!`);
  } else {
    btnExecuteJupiterSwap.disabled = false;
    btnSwapLabel.innerText = `🔥 1-Click Ape ${selectedApeSol} SOL Now`;
    showToast(`⚠️ ${res.message}`);
  }
}

// Open Token Profile Modal with Interactive Chart
function openProfileModal(coin: MemeCoin) {
  const isPos = coin.change24h >= 0;
  const changeColor = isPos ? '#10b981' : '#ef4444';
  const changeSign = isPos ? '+' : '';

  // Generate SVG area chart from sparkline
  const spark = coin.sparkline;
  const minVal = Math.min(...spark);
  const maxVal = Math.max(...spark);
  const range = (maxVal - minVal) || 1;
  const svgWidth = 400;
  const svgHeight = 130;

  const points = spark.map((val, idx) => {
    const x = (idx / (spark.length - 1)) * svgWidth;
    const y = svgHeight - ((val - minVal) / range) * (svgHeight - 20) - 10;
    return `${x},${y}`;
  });

  const polylineStr = points.join(' ');
  const areaStr = `0,${svgHeight} ${polylineStr} ${svgWidth},${svgHeight}`;

  profileModalBody.innerHTML = `
    <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 16px;">
      <img src="${coin.avatar}" style="width: 64px; height: 64px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.15); object-fit: cover;" alt="${coin.name}" onerror="this.src='https://assets.coingecko.com/coins/images/29850/large/pepe-token.png'" />
      <div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <h2 style="font-family: var(--font-display); font-size: 1.6rem; font-weight: 800;">${coin.name}</h2>
          <span style="color: var(--text-muted); font-weight: 700;">$${coin.symbol}</span>
          ${coin.verified ? '<span class="verified-check">✓</span>' : ''}
        </div>
        <div style="display: flex; align-items: baseline; gap: 8px; margin-top: 2px;">
          <span style="font-size: 1.3rem; font-weight: 800;">$${coin.priceUsd < 0.01 ? coin.priceUsd.toFixed(6) : coin.priceUsd.toFixed(2)}</span>
          <span style="color: ${changeColor}; font-weight: 800; font-size: 0.88rem;">${changeSign}${coin.change24h}% (24h)</span>
        </div>
      </div>
    </div>

    <!-- Chart -->
    <div style="background: rgba(0,0,0,0.3); border-radius: 16px; padding: 12px; border: 1px solid var(--border-subtle); margin-bottom: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 0.78rem; color: var(--text-muted);">
        <span>Price Performance (Live Momentum)</span>
        <span style="color: ${changeColor}; font-weight: 700;">● Live DEX</span>
      </div>
      <svg viewBox="0 0 ${svgWidth} ${svgHeight}" style="width: 100%; height: 110px; overflow: visible;">
        <defs>
          <linearGradient id="chartGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="${changeColor}" stop-opacity="0.35" />
            <stop offset="100%" stop-color="${changeColor}" stop-opacity="0.0" />
          </linearGradient>
        </defs>
        <polygon points="${areaStr}" fill="url(#chartGrad)" />
        <polyline points="${polylineStr}" fill="none" stroke="${changeColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>

    <!-- Tokenomics Grid -->
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 16px;">
      <div class="stat-pill" style="align-items: flex-start; padding: 10px;">
        <span class="stat-label">Market Cap</span>
        <span class="stat-val">$${coin.marketCap > 1000000 ? (coin.marketCap / 1e6).toFixed(2) + 'M' : coin.marketCap.toLocaleString()}</span>
      </div>
      <div class="stat-pill" style="align-items: flex-start; padding: 10px;">
        <span class="stat-label">24h Volume</span>
        <span class="stat-val">$${coin.volume24h > 1000000 ? (coin.volume24h / 1e6).toFixed(2) + 'M' : coin.volume24h.toLocaleString()}</span>
      </div>
      <div class="stat-pill" style="align-items: flex-start; padding: 10px;">
        <span class="stat-label">Liquidity</span>
        <span class="stat-val">$${coin.liquidityUsd.toLocaleString()}</span>
      </div>
      <div class="stat-pill" style="align-items: flex-start; padding: 10px;">
        <span class="stat-label">Holders / Txns</span>
        <span class="stat-val">${coin.holdersCount.toLocaleString()}</span>
      </div>
    </div>

    <!-- Safety Radar -->
    <div style="background: rgba(255,255,255,0.04); border-radius: 16px; padding: 14px; border: 1px solid var(--border-subtle); margin-bottom: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <span style="font-weight: 800; font-size: 0.9rem;">🛡️ Safety Radar Score</span>
        <span style="color: #34d399; font-weight: 900; font-size: 1.05rem;">${coin.safetyScore.score}/100</span>
      </div>
      <div style="display: flex; flex-direction: column; gap: 6px; font-size: 0.8rem; color: #cbd5e1;">
        <div>${coin.safetyScore.isMintRevoked ? '✅' : '❌'} Mint Authority Revoked</div>
        <div>${coin.safetyScore.isFreezeRevoked ? '✅' : '❌'} Freeze Authority Revoked</div>
        <div>${coin.safetyScore.isLpBurned ? '✅' : '⚠️'} Liquidity Burned / Locked</div>
        <div>👥 Top 10 Holders Concentration: <b>${coin.safetyScore.top10HoldersPercent}%</b></div>
      </div>
    </div>

    <!-- Contract Address Box -->
    <div style="background: rgba(0,0,0,0.4); border-radius: 14px; padding: 12px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; border: 1px solid var(--border-subtle);">
      <div style="display: flex; flex-direction: column; gap: 2px; overflow: hidden; margin-right: 8px;">
        <span style="font-size: 0.68rem; color: var(--text-subtle); text-transform: uppercase;">Contract Address (CA)</span>
        <span style="font-family: monospace; font-size: 0.78rem; color: #93c5fd; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${coin.contractAddress}</span>
      </div>
      <button id="btnCopyCA" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15); color: white; padding: 6px 12px; border-radius: 8px; font-size: 0.78rem; font-weight: 700; cursor: pointer; white-space: nowrap;">
        📋 Copy
      </button>
    </div>

    <!-- Action Bar -->
    <div style="display: flex; gap: 10px;">
      <a href="${coin.dexScreenerUrl}" target="_blank" rel="noopener" style="flex: 1; text-align: center; background: rgba(255,255,255,0.08); border: 1px solid var(--border-subtle); color: white; padding: 12px; border-radius: 999px; text-decoration: none; font-weight: 700; font-size: 0.9rem;">
        📈 DexScreener Live
      </a>
      <button id="btnProfileApeIn" style="flex: 1; background: var(--color-green); border: none; color: #04101e; padding: 12px; border-radius: 999px; font-weight: 800; font-size: 0.9rem; cursor: pointer;">
        🔥 1-Click Ape (${selectedApeSol} SOL)
      </button>
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

  const btnProfileApe = document.getElementById('btnProfileApeIn');
  if (btnProfileApe) {
    btnProfileApe.addEventListener('click', async () => {
      btnProfileApe.innerText = '⏳ Swapping...';
      const res = await JupiterService.executeSwap(coin, selectedApeSol);
      if (res.success) {
        sound.playBuy();
        updateMatchesBadge();
        showToast(res.message);
        closeProfileModal();
      } else {
        btnProfileApe.innerText = `🔥 1-Click Ape (${selectedApeSol} SOL)`;
        showToast(`⚠️ ${res.message}`);
      }
    });
  }

  document.body.classList.add('modal-active');
  profileModalBackdrop.classList.add('active');
}

function closeProfileModal() {
  document.body.classList.remove('modal-active');
  profileModalBackdrop.classList.remove('active');
}

// Open Matches / Bag Modal
function openMatchesModal() {
  const matches = PortfolioService.getMatches();
  const portfolio = PortfolioService.getPortfolio();

  const coinMap = new Map<string, MemeCoin>();
  allCoins.forEach(c => coinMap.set(c.id, c));
  const calc = PortfolioService.calculateTotalValue(coinMap);

  portfolioCashVal.innerText = `$${portfolio.cashUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  portfolioNetWorthVal.innerText = `$${calc.totalValueUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  portfolioNetWorthVal.style.color = calc.pnlUsd >= 0 ? '#34d399' : '#f87171';

  if (matches.length === 0) {
    matchesListContainer.innerHTML = `
      <div style="text-align: center; padding: 36px 12px; color: var(--text-muted);">
        <div style="font-size: 2.5rem; margin-bottom: 8px;">💔</div>
        <p style="font-weight: 700;">No matches in your bag yet.</p>
        <p style="font-size: 0.8rem; margin-top: 4px;">Swipe right (🔥) or Super Like (⭐) to 1-Click Ape into coins!</p>
      </div>
    `;
  } else {
    matchesListContainer.innerHTML = matches.map(m => {
      const isPos = m.coin.change24h >= 0;
      return `
        <div class="match-item-row" data-match-id="${m.coin.id}">
          <div class="match-item-left">
            <img class="match-item-avatar" src="${m.coin.avatar}" alt="${m.coin.name}" onerror="this.src='https://assets.coingecko.com/coins/images/29850/large/pepe-token.png'" />
            <div class="match-item-info">
              <span class="match-item-name">${m.coin.name} <span style="color: var(--text-muted); font-size: 0.8rem;">$${m.coin.symbol}</span></span>
              <span class="match-item-sub">
                ${m.action === 'superlike' ? '⭐ Super Liked' : '🔥 Aped In'} · $${m.coin.priceUsd < 0.01 ? m.coin.priceUsd.toFixed(6) : m.coin.priceUsd.toFixed(2)}
              </span>
            </div>
          </div>
          <div class="match-item-right">
            <span style="font-weight: 800; font-size: 0.85rem; color: ${isPos ? '#34d399' : '#f87171'};">
              ${isPos ? '+' : ''}${m.coin.change24h}%
            </span>
            <a href="${m.coin.dexScreenerUrl}" target="_blank" rel="noopener" style="text-decoration: none; font-size: 0.85rem; padding: 4px 8px; background: rgba(255,255,255,0.08); border-radius: 8px; color: white;" title="View on DexScreener">
              📈
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

      if (direction === 'right') {
        if (isAutoApeMode) {
          // AUTO-APE MODE: Instant buy in background!
          sound.playBuy();
          const res = await JupiterService.executeSwap(coin, selectedApeSol);
          if (res.success) {
            updateMatchesBadge();
            showToast(`⚡ Auto-Aped ${selectedApeSol} SOL into $${coin.symbol}!`);
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
    const res = await WalletService.connectPhantom();
    showToast(res.message);
    if (res.success) closeWalletModal();
  });

  btnSwitchToDemo.addEventListener('click', () => {
    WalletService.connectDemo();
    showToast('🧪 Switched to Demo Degen Wallet (5.0 SOL)');
    closeWalletModal();
  });

  btnFaucetDemoSol.addEventListener('click', () => {
    WalletService.resetDemoBalance(5.0);
    showToast('🚰 Faucet: Demo wallet refilled with 5.0 SOL!');
  });

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
    isAutoApeMode = !isAutoApeMode;
    btnAutoApeToggle.classList.toggle('active', isAutoApeMode);
    autoApeText.innerText = isAutoApeMode ? `Auto-Ape: ON (${selectedApeSol} SOL)` : 'Auto-Ape: OFF';
    showToast(isAutoApeMode ? `⚡ Auto-Ape ENABLED! Swiping right will buy ${selectedApeSol} SOL!` : 'Auto-Ape Disabled (Review mode on swipe)');
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

  // Escape key closes modals
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMatchModal();
      closeProfileModal();
      closeMatchesModal();
      closeWalletModal();
    }
  });
}

// App Bootstrapper
async function boot() {
  WalletService.onStateChange(updateWalletUI);
  WalletService.init();

  updateMatchesBadge();
  bindActions();

  // Load coins from DexService (live DexScreener top boosts + new trending)
  allCoins = await DexService.getTrendingCoins();
  initSwipeController();
}

boot();
