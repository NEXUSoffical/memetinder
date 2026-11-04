import { MemeCoin, FilterChain } from './types';
import { DexService } from './dexService';
import { SwipeEngine } from './swipeEngine';
import { SoundEngine } from './soundEngine';
import { PortfolioService } from './portfolioService';

// Initialize Sound Engine
const sound = new SoundEngine();

// App State
let allCoins: MemeCoin[] = [];
let activeFilter: FilterChain = 'all';
let currentSwipedMatchCoin: MemeCoin | null = null;
let swipeEngine: SwipeEngine | null = null;

// DOM Elements
const cardStackContainer = document.getElementById('cardStackContainer') as HTMLElement;
const matchesCountBadge = document.getElementById('matchesCountBadge') as HTMLElement;
const btnAudioToggle = document.getElementById('btnAudioToggle') as HTMLButtonElement;
const btnBrandHome = document.getElementById('btnBrandHome') as HTMLElement;
const btnRefreshFeed = document.getElementById('btnRefreshFeed') as HTMLButtonElement;

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
const matchDialogueText = document.getElementById('matchDialogueText') as HTMLElement;
const btnSimulateBuyMatch = document.getElementById('btnSimulateBuyMatch') as HTMLButtonElement;
const btnOpenDexChart = document.getElementById('btnOpenDexChart') as HTMLAnchorElement;
const btnKeepSwiping = document.getElementById('btnKeepSwiping') as HTMLButtonElement;

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

// Funny Match Dialogue Quotes
const MATCH_QUOTES = [
  "You and this token both believe a 100x run is programmed.",
  "Whales just entered the liquidity pool. Early momentum confirmed.",
  "High velocity breakout volume! Dev is building and community is raiding.",
  "Community takeover approved. Zero taxes, 100% pure degen conviction.",
  "Trending on DexScreener top boosts! Fasten your seatbelts.",
  "Top 10 holders own less than 15%. This is as decentralized as memes get."
];

// Open Match Modal
function triggerMatchModal(coin: MemeCoin, isSuperLike = false) {
  currentSwipedMatchCoin = coin;
  matchSubtitleText.innerText = isSuperLike 
    ? `⭐ SUPER LIKE! You and $${coin.symbol} are shooting for the moon!`
    : `You and $${coin.symbol} are ready to send it!`;
  
  matchCoinAvatar.src = coin.avatar;
  const randomQuote = MATCH_QUOTES[Math.floor(Math.random() * MATCH_QUOTES.length)];
  matchDialogueText.innerText = `"${randomQuote}"`;

  btnOpenDexChart.href = coin.dexScreenerUrl;
  btnSimulateBuyMatch.innerHTML = `<span>💸 Ape In $200 (Paper Bag)</span>`;

  document.body.classList.add('modal-active');
  matchModalBackdrop.classList.add('active');
}

function closeMatchModal() {
  document.body.classList.remove('modal-active');
  matchModalBackdrop.classList.remove('active');
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
        🔥 Ape In ($200)
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
    btnProfileApe.addEventListener('click', () => {
      sound.playBuy();
      const res = PortfolioService.buyPaper(coin, 200);
      PortfolioService.addMatch(coin, 'ape');
      updateMatchesBadge();
      showToast(res.message);
      closeProfileModal();
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
        <p style="font-size: 0.8rem; margin-top: 4px;">Swipe right (🔥) or Super Like (⭐) to add coins to your watch bag!</p>
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
    onSwipe: (coin, direction) => {
      sound.playSwipe(direction);

      if (direction === 'right') {
        sound.playMatch();
        PortfolioService.addMatch(coin, 'ape');
        updateMatchesBadge();
        triggerMatchModal(coin, false);
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

  btnRefreshFeed.addEventListener('click', () => {
    refreshTrendingFeed();
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

  // Filters
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const filter = chip.getAttribute('data-filter') as FilterChain;
      applyFilter(filter);
    });
  });

  // Modal Closures
  btnCloseMatchModal.addEventListener('click', closeMatchModal);
  btnKeepSwiping.addEventListener('click', closeMatchModal);
  matchModalBackdrop.addEventListener('click', (e) => {
    if (e.target === matchModalBackdrop) closeMatchModal();
  });

  btnCloseProfileModal.addEventListener('click', closeProfileModal);
  profileModalBackdrop.addEventListener('click', (e) => {
    if (e.target === profileModalBackdrop) closeProfileModal();
  });

  btnOpenMatches.addEventListener('click', openMatchesModal);
  btnCloseMatchesModal.addEventListener('click', closeMatchesModal);
  matchesModalBackdrop.addEventListener('click', (e) => {
    if (e.target === matchesModalBackdrop) closeMatchesModal();
  });

  // Simulate buy from Match Modal
  btnSimulateBuyMatch.addEventListener('click', () => {
    if (!currentSwipedMatchCoin) return;
    sound.playBuy();
    const res = PortfolioService.buyPaper(currentSwipedMatchCoin, 200);
    showToast(res.message);
    closeMatchModal();
  });

  // Escape key closes modals
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMatchModal();
      closeProfileModal();
      closeMatchesModal();
    }
  });
}

// App Bootstrapper
async function boot() {
  updateMatchesBadge();
  bindActions();

  // Load coins from DexService (live DexScreener top boosts + new trending)
  allCoins = await DexService.getTrendingCoins();
  initSwipeController();
}

boot();
