import { MemeCoin } from './types';

export interface SwipeCallbacks {
  onSwipe: (coin: MemeCoin, direction: 'left' | 'right' | 'up') => void;
  onCardClick: (coin: MemeCoin) => void;
  onStackEmpty: () => void;
}

export class SwipeEngine {
  private container: HTMLElement;
  private queue: MemeCoin[] = [];
  private history: MemeCoin[] = [];
  private callbacks: SwipeCallbacks;
  private isDragging = false;
  private startX = 0;
  private startY = 0;
  private currentX = 0;
  private currentY = 0;
  private activeCardEl: HTMLElement | null = null;
  private passStampEl: HTMLElement | null = null;
  private apeStampEl: HTMLElement | null = null;
  private superStampEl: HTMLElement | null = null;
  private isAnimating = false;

  constructor(container: HTMLElement, coins: MemeCoin[], callbacks: SwipeCallbacks) {
    this.container = container;
    this.queue = [...coins];
    this.callbacks = callbacks;
    this.renderStack();
    this.bindGlobalEvents();
  }

  public setCoins(coins: MemeCoin[]) {
    this.queue = [...coins];
    this.renderStack();
  }

  public getHistory(): MemeCoin[] {
    return this.history;
  }

  public getCurrentCoin(): MemeCoin | null {
    return this.queue.length > 0 ? this.queue[0] : null;
  }

  private renderStack() {
    this.container.innerHTML = '';
    this.activeCardEl = null;

    if (this.queue.length === 0) {
      this.callbacks.onStackEmpty();
      return;
    }

    // Render up to 3 cards for 3D stack effect (reversed order so card 0 is on top)
    const cardsToRender = this.queue.slice(0, 3);
    for (let i = cardsToRender.length - 1; i >= 0; i--) {
      const coin = cardsToRender[i];
      const cardEl = this.createCardElement(coin, i);
      this.container.appendChild(cardEl);
      if (i === 0) {
        this.activeCardEl = cardEl;
        this.passStampEl = cardEl.querySelector('.stamp-pass');
        this.apeStampEl = cardEl.querySelector('.stamp-ape');
        this.superStampEl = cardEl.querySelector('.stamp-super');
        this.attachPointerListeners(cardEl, coin);
      }
    }
  }

  private createCardElement(coin: MemeCoin, stackIndex: number): HTMLElement {
    const card = document.createElement('div');
    card.className = `tinder-card stack-index-${stackIndex}`;
    card.dataset.coinId = coin.id;

    // Chain badge colors
    const chainLabels: Record<string, string> = {
      solana: '🟣 Solana',
      ethereum: '🔷 Ethereum',
      base: '🔵 Base',
      pumpfun: '💊 Pump.fun'
    };

    const isPositive = coin.change24h >= 0;
    const changeClass = isPositive ? 'positive' : 'negative';
    const changeSign = isPositive ? '+' : '';

    // Safety Pill
    const safetyBadge = coin.safetyScore.score >= 95 
      ? '<span class="safety-pill safe">🛡️ Safu 99%</span>'
      : '<span class="safety-pill warn">⚠️ Degen Meta</span>';

    card.innerHTML = `
      <!-- Stamps -->
      <div class="card-stamp stamp-pass">PASS 💀</div>
      <div class="card-stamp stamp-ape">APE IN 🔥</div>
      <div class="card-stamp stamp-super">SUPER LIKE 🚀</div>

      <!-- Card Image / Avatar Banner -->
      <div class="card-media-wrapper">
        <img class="card-avatar-img" src="${coin.avatar}" alt="${coin.name}" loading="lazy" onerror="this.src='https://assets.coingecko.com/coins/images/29850/large/pepe-token.png'" />
        <div class="card-gradient-overlay"></div>
        <div class="card-chain-pill ${coin.chain}">${chainLabels[coin.chain] || coin.chain}</div>
        <div class="card-hype-badge">🔥 ${coin.hypeScore}% Hype</div>
      </div>

      <!-- Card Content Info -->
      <div class="card-info">
        <div class="card-headline">
          <div class="coin-title-group">
            <h2 class="coin-name">${coin.name}</h2>
            <span class="coin-symbol">$${coin.symbol}</span>
            ${coin.verified ? '<span class="verified-check" title="Verified Meme Legend">✓</span>' : ''}
          </div>
          <div class="coin-price-box">
            <span class="coin-price">$${coin.priceUsd < 0.01 ? coin.priceUsd.toFixed(6) : coin.priceUsd.toFixed(2)}</span>
            <span class="coin-change ${changeClass}">${changeSign}${coin.change24h}%</span>
          </div>
        </div>

        <p class="coin-tagline">“${coin.tagline}”</p>

        <!-- Stats Grid -->
        <div class="card-stats-grid">
          <div class="stat-pill">
            <span class="stat-label">Market Cap</span>
            <span class="stat-val">$${(coin.marketCap / 1e6).toFixed(1)}M</span>
          </div>
          <div class="stat-pill">
            <span class="stat-label">24h Vol</span>
            <span class="stat-val">$${(coin.volume24h / 1e6).toFixed(1)}M</span>
          </div>
          <div class="stat-pill">
            <span class="stat-label">Liquidity</span>
            <span class="stat-val">$${(coin.liquidityUsd / 1e6).toFixed(1)}M</span>
          </div>
        </div>

        <!-- Trait Pills -->
        <div class="card-traits-row">
          ${safetyBadge}
          <span class="trait-pill">${coin.devStatus}</span>
          ${coin.traits.slice(0, 2).map(t => `<span class="trait-pill">${t}</span>`).join('')}
        </div>

        <div class="card-tap-hint">
          <span>👆 Tap card for full tokenomics & chart</span>
        </div>
      </div>
    `;

    return card;
  }

  private attachPointerListeners(cardEl: HTMLElement, coin: MemeCoin) {
    let startTimestamp = 0;

    const onPointerDown = (e: PointerEvent) => {
      if (this.isAnimating) return;
      this.isDragging = true;
      startTimestamp = Date.now();
      this.startX = e.clientX;
      this.startY = e.clientY;
      this.currentX = 0;
      this.currentY = 0;
      cardEl.setPointerCapture(e.pointerId);
      cardEl.style.transition = 'none';
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!this.isDragging) return;
      this.currentX = e.clientX - this.startX;
      this.currentY = e.clientY - this.startY;

      const rotation = this.currentX * 0.07;
      cardEl.style.transform = `translate3d(${this.currentX}px, ${this.currentY}px, 0) rotate(${rotation}deg)`;

      // Stamp Opacities
      const threshold = 60;
      if (this.currentY < -60 && Math.abs(this.currentX) < 70) {
        // Dragging up (Super Like)
        const superOpacity = Math.min(1, Math.abs(this.currentY) / 100);
        if (this.superStampEl) this.superStampEl.style.opacity = String(superOpacity);
        if (this.apeStampEl) this.apeStampEl.style.opacity = '0';
        if (this.passStampEl) this.passStampEl.style.opacity = '0';
      } else if (this.currentX > 0) {
        // Dragging right (Ape in)
        const apeOpacity = Math.min(1, this.currentX / threshold);
        if (this.apeStampEl) this.apeStampEl.style.opacity = String(apeOpacity);
        if (this.passStampEl) this.passStampEl.style.opacity = '0';
        if (this.superStampEl) this.superStampEl.style.opacity = '0';
      } else {
        // Dragging left (Pass)
        const passOpacity = Math.min(1, Math.abs(this.currentX) / threshold);
        if (this.passStampEl) this.passStampEl.style.opacity = String(passOpacity);
        if (this.apeStampEl) this.apeStampEl.style.opacity = '0';
        if (this.superStampEl) this.superStampEl.style.opacity = '0';
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!this.isDragging) return;
      this.isDragging = false;
      cardEl.releasePointerCapture(e.pointerId);

      const dragDistance = Math.hypot(this.currentX, this.currentY);
      const elapsed = Date.now() - startTimestamp;

      // Check if tap/click
      if (dragDistance < 8 && elapsed < 250) {
        this.resetCardPosition(cardEl);
        this.callbacks.onCardClick(coin);
        return;
      }

      // Check swipe threshold (100px or fast flick)
      const isFastFlick = elapsed < 250 && dragDistance > 50;
      if (this.currentY < -90 || (isFastFlick && this.currentY < -40 && Math.abs(this.currentX) < 50)) {
        this.completeSwipe('up');
      } else if (this.currentX > 90 || (isFastFlick && this.currentX > 40)) {
        this.completeSwipe('right');
      } else if (this.currentX < -90 || (isFastFlick && this.currentX < -40)) {
        this.completeSwipe('left');
      } else {
        this.resetCardPosition(cardEl);
      }
    };

    cardEl.addEventListener('pointerdown', onPointerDown);
    cardEl.addEventListener('pointermove', onPointerMove);
    cardEl.addEventListener('pointerup', onPointerUp);
    cardEl.addEventListener('pointercancel', onPointerUp);
  }

  private resetCardPosition(cardEl: HTMLElement) {
    cardEl.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    cardEl.style.transform = 'translate3d(0, 0, 0) rotate(0deg)';
    if (this.passStampEl) this.passStampEl.style.opacity = '0';
    if (this.apeStampEl) this.apeStampEl.style.opacity = '0';
    if (this.superStampEl) this.superStampEl.style.opacity = '0';
  }

  public completeSwipe(direction: 'left' | 'right' | 'up') {
    if (!this.activeCardEl || this.isAnimating || this.queue.length === 0) return;

    this.isAnimating = true;
    const cardEl = this.activeCardEl;
    const swipedCoin = this.queue[0];

    // Highlight winning stamp
    if (direction === 'right' && this.apeStampEl) this.apeStampEl.style.opacity = '1';
    if (direction === 'left' && this.passStampEl) this.passStampEl.style.opacity = '1';
    if (direction === 'up' && this.superStampEl) this.superStampEl.style.opacity = '1';

    cardEl.style.transition = 'transform 0.42s ease-out, opacity 0.38s ease-out';

    if (direction === 'right') {
      cardEl.style.transform = 'translate3d(140vw, 40px, 0) rotate(35deg)';
    } else if (direction === 'left') {
      cardEl.style.transform = 'translate3d(-140vw, 40px, 0) rotate(-35deg)';
    } else {
      cardEl.style.transform = 'translate3d(0, -140vh, 0) rotate(0deg)';
    }
    cardEl.style.opacity = '0';

    setTimeout(() => {
      this.history.push(swipedCoin);
      this.queue.shift();
      this.isAnimating = false;
      this.callbacks.onSwipe(swipedCoin, direction);
      this.renderStack();
    }, 380);
  }

  public rewind(): boolean {
    if (this.history.length === 0 || this.isAnimating) return false;
    const last = this.history.pop()!;
    this.queue.unshift(last);
    this.renderStack();
    return true;
  }

  public swipeLeft() {
    this.completeSwipe('left');
  }

  public swipeRight() {
    this.completeSwipe('right');
  }

  public swipeUp() {
    this.completeSwipe('up');
  }

  private bindGlobalEvents() {
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      // Don't trigger if modal is open or typing in input
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (document.body.classList.contains('modal-active')) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.swipeLeft();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        this.swipeRight();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.swipeUp();
      } else if (e.key === ' ' && this.queue.length > 0) {
        e.preventDefault();
        this.callbacks.onCardClick(this.queue[0]);
      }
    });
  }
}
