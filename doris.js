/*
 * Doris's birthday keepsake
 *
 * The page has no first-party server. Favorites and saved wishes stay in the
 * visitor's current browser. External fonts and music providers may receive
 * normal connection data when those services load.
 */

(() => {
  'use strict';

  /* ------------------------------------------------------------------------
     Content for the birthday wish jar
     --------------------------------------------------------------------- */

  const birthdayWishes = [
    'May this year bring you more laughter, music, and days that feel wonderfully yours.',
    'May you keep finding new reasons to smile in every season ahead.',
    'May your courage and hard work open doors to the opportunities you deserve.',
    'May the care you give to others return to you in a hundred thoughtful ways.',
    'May your next year hold joyful adventures, good company, and memories worth keeping.',
    'May you always feel celebrated for the person you are, not just what you do.',
    'May our friendship keep growing into the kind of sisterhood that makes life lighter.',
    'May the year ahead be gentle with you and generous with good surprises.',
    'May twenty-two be the year your quiet prayers are met with loud, beautiful answers.',
    'May every year after this one find you braver, softer, and more sure of who you are.'
  ];

  /* ------------------------------------------------------------------------
     Persistent state keys
     --------------------------------------------------------------------- */

  const STORAGE_KEYS = Object.freeze({
    photoFavorites: 'doris-birthday-photo-favorites-v1',
    wishFavorites: 'doris-birthday-wish-favorites-v1',
    unlocked: 'doris-birthday-unlocked-v1',
  });

  const BIRTHDAY = new Date('2026-10-24T21:00:00.000Z');
  const REPLY_EMAIL = 'lor.adia.17@gmail.com';
  // To receive Doris's reactions and visit reports by email, paste a free Web3Forms access key
  // between the quotes (see README.txt, "SEE HOW SHE RESPONDS"). Leave empty to switch reporting off.
  const REPORTING = { accessKey: '' };
  const SHARE_KEY = 'doris-share-v1';
  const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ------------------------------------------------------------------------
     Selectors and small helpers
     --------------------------------------------------------------------- */

  const one = (selector, parent = document) => parent.querySelector(selector);
  const many = (selector, parent = document) => [...parent.querySelectorAll(selector)];

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function safeRead(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (error) {
      console.info('Saved birthday details are unavailable in this browser.', error);
      return fallback;
    }
  }

  function readStringArray(key) {
    const value = safeRead(key, []);
    if (!Array.isArray(value)) return [];
    return value.filter((item) => typeof item === 'string');
  }

  function safeWrite(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.info('This browser could not save the birthday detail.', error);
      return false;
    }
  }

  function safeRemove(key) {
    try {
      window.localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.info('This browser could not remove the saved detail.', error);
      return false;
    }
  }

  function announce(message) {
    const live = one('#screen-reader-status');
    if (live) live.textContent = message;
  }

  function toast(message, duration = 3200) {
    const region = one('#toast-region');
    if (!region) return;

    const item = document.createElement('div');
    item.className = 'toast-message';
    item.setAttribute('role', 'status');
    item.textContent = message;
    region.append(item);

    window.setTimeout(() => {
      item.classList.add('is-leaving');
      window.setTimeout(() => item.remove(), 250);
    }, duration);
  }

  function setPressed(button, pressed) {
    if (!button) return;
    button.setAttribute('aria-pressed', String(Boolean(pressed)));
  }

  function scrollToTarget(selector) {
    const target = one(selector);
    if (!target) return false;
    target.scrollIntoView({
      behavior: REDUCED_MOTION.matches ? 'auto' : 'smooth',
      block: 'start'
    });
    return true;
  }

  function focusWithoutScroll(element) {
    if (!element) return;
    if (!element.hasAttribute('tabindex')) element.setAttribute('tabindex', '-1');
    element.focus({ preventScroll: true });
  }

  function trapTabKey(event, dialog) {
    if (event.key !== 'Tab') return;
    const focusable = many('button:not([disabled]), a[href], textarea, [tabindex="0"]', dialog)
      .filter((element) => element.getClientRects().length > 0);
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /* ------------------------------------------------------------------------
     Live page state
     --------------------------------------------------------------------- */

  const state = {
    menuOpen: false,
    savedPhotoIds: new Set(readStringArray(STORAGE_KEYS.photoFavorites)),
    savedWishMessages: new Set(readStringArray(STORAGE_KEYS.wishFavorites)),
    galleryFilter: 'all',
    currentPhotoIndex: 0,
    photoDialogOpener: null,
    slideshowTimer: null,
    currentWish: birthdayWishes[0],
    lastWishIndex: 0,
    wishDeck: [],
    welcomeWasOpened: false,
    welcomeCountdownTimer: null,
    startIntroSong: null,
    speechIsActive: false,
    pointerStartX: null,
    confettiParticles: [],
    confettiFrame: null,
    toastTimers: new Set(),
    track: null,
    bump: null,
    reaction: '',
    audio: null,
    noise: null,
    sendNote: null,
    reportReady: null,
    chimesOn: true
  };

  /* ------------------------------------------------------------------------
     Welcome cover and the reveal moment
     --------------------------------------------------------------------- */

  function openBirthdaySurprise() {
    const cover = one('#welcome-screen');
    if (!cover || state.welcomeWasOpened) return;

    cover.classList.add('is-opening');
    state.welcomeWasOpened = true;
    state.releaseDock?.();
    state.track?.('Unlocked the page');
    announce('Welcome to Doris’s birthday keepsake.');

    window.clearInterval(state.welcomeCountdownTimer);
    window.setTimeout(() => {
      cover.hidden = true;
      one('#surprise-fab')?.classList.remove('is-gated');
      one('#home')?.focus({ preventScroll: true });
      triggerCelebration({ count: 28, origin: 'top' });
    }, REDUCED_MOTION.matches ? 50 : 820);
  }

  function restoreWelcomeCoverIfNeeded() {
    const cover = one('#welcome-screen');
    if (!cover) return;

    if (state.welcomeWasOpened) {
      state.welcomeWasOpened = true;
      cover.hidden = true;
      return;
    }

    cover.hidden = false;
  }

  function beginWelcomeCountdown() {
    const form = one('#welcome-gate-form');
    const countdown = one('#welcome-countdown');
    const value = one('#welcome-countdown-value');
    const progress = one('#welcome-countdown-progress');
    const progressBar = progress?.parentElement;
    if (!form || !countdown || !value || !progress || !progressBar) return;

    form.hidden = true;
    countdown.hidden = false;
    countdown.focus({ preventScroll: true });
    value.textContent = '5';
    progress.style.width = '100%';
    progressBar.setAttribute('aria-valuenow', '5');

    const duration = 5_000;
    const deadline = Date.now() + duration;
    const updateCountdown = () => {
      const remaining = Math.max(0, deadline - Date.now());
      const secondsLeft = Math.ceil(remaining / 1000);
      value.textContent = String(secondsLeft);
      progress.style.width = `${(remaining / duration) * 100}%`;
      progressBar.setAttribute('aria-valuenow', String(secondsLeft));

      if (remaining <= 0) {
        window.clearInterval(state.welcomeCountdownTimer);
        state.welcomeCountdownTimer = null;
        openBirthdaySurprise();
      }
    };

    updateCountdown();
  state.welcomeCountdownTimer = window.setInterval(updateCountdown, 1000);
  }

  function bindWelcomeControls() {
    const form = one('#welcome-gate-form');
    const input = one('#welcome-passcode');
    const error = one('#welcome-passcode-error');
    const playMusic = one('#welcome-play-music');
    const musicStatus = one('#welcome-song-status');

    input?.focus({ preventScroll: true });
    input?.addEventListener('input', () => {
      input.setAttribute('aria-invalid', 'false');
      if (error) error.textContent = '';
    });

    playMusic?.addEventListener('click', () => {
      state.startIntroSong?.();
      if (musicStatus) musicStatus.textContent = 'Trying to play Unaweza. If it stays silent, tap Play song again or use the chapter music player after the story opens.';
    });

    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!input || state.welcomeWasOpened) return;

      if (input.value.trim() !== '2510') {
        input.setAttribute('aria-invalid', 'true');
        input.value = '';
        error.textContent = 'That code didn’t open the surprise. Try the four-digit passcode again.';
        input.focus();
        return;
      }

      input.setAttribute('aria-invalid', 'false');
      error.textContent = '';
      one('#unlock-surprise')?.setAttribute('disabled', '');
      state.startIntroSong?.();
      if (musicStatus) musicStatus.textContent = 'Your intro song is starting as the countdown begins.';
      beginWelcomeCountdown();
    });
  }

  /* ------------------------------------------------------------------------
     Countdown and birthday-day messages
     --------------------------------------------------------------------- */

  function updateBirthdayClock() {
    const units = one('#clock-units');
    const after = one('#clock-after');
    const label = one('#clock-label');
    if (!units || !after || !label) return;

    const now = Date.now();
    const distance = BIRTHDAY.getTime() - now;

    if (distance <= 0) {
      units.hidden = true;
      after.hidden = false;
      label.textContent = 'The day we have been waiting for';
      return;
    }

    units.hidden = false;
    after.hidden = true;

    const days = Math.floor(distance / 86_400_000);
    const hours = Math.floor((distance % 86_400_000) / 3_600_000);
    const minutes = Math.floor((distance % 3_600_000) / 60_000);

    one('#countdown-days').textContent = String(days).padStart(2, '0');
    one('#countdown-hours').textContent = String(hours).padStart(2, '0');
    one('#countdown-minutes').textContent = String(minutes).padStart(2, '0');
    label.textContent = 'Until your birthday begins';
  }

  function startBirthdayClock() {
    updateBirthdayClock();
    window.setInterval(updateBirthdayClock, 30_000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) updateBirthdayClock();
    });
  }

  function getBirthdayPhase() {
    const now = Date.now();
    const birthdayEnd = BIRTHDAY.getTime() + 86_400_000;

    if (now < BIRTHDAY.getTime()) return 'before';
    if (now < birthdayEnd) return 'during';
    return 'after';
  }

  function personalizeBirthdayGreeting() {
    const phase = getBirthdayPhase();
    const greeting = one('.hero-section__overline');
    if (!greeting) return;

    const greetings = {
      before: 'Twenty-two is almost here',
      during: 'It is your day, Doris. Twenty-two begins today!',
      after: 'The birthday joy can stay all year'
    };

    greeting.textContent = greetings[phase];
  }

  /* ------------------------------------------------------------------------
     Mobile navigation and page wayfinding
     --------------------------------------------------------------------- */

  function setMenuOpen(open) {
    const button = one('#menu-toggle');
    const navigation = one('#primary-navigation');
    if (!button || !navigation) return;

    state.menuOpen = Boolean(open);
    button.setAttribute('aria-expanded', String(state.menuOpen));
    button.setAttribute('aria-label', state.menuOpen ? 'Close navigation menu' : 'Open navigation menu');
    navigation.classList.toggle('is-open', state.menuOpen);
  }

  function bindNavigation() {
    one('#menu-toggle')?.addEventListener('click', () => setMenuOpen(!state.menuOpen));

    many('#primary-navigation a').forEach((link) => {
      link.addEventListener('click', () => setMenuOpen(false));
    });

    document.addEventListener('click', (event) => {
      const navigation = one('#primary-navigation');
      const trigger = one('#menu-toggle');
      if (!state.menuOpen || !navigation || !trigger) return;
      if (navigation.contains(event.target) || trigger.contains(event.target)) return;
      setMenuOpen(false);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && state.menuOpen) setMenuOpen(false);
    });

    many('[data-scroll-to]').forEach((button) => {
      button.addEventListener('click', () => scrollToTarget(button.dataset.scrollTo));
    });
  }

  function updateHeaderOnScroll() {
    const header = one('#site-header');
    if (!header) return;
    header.classList.toggle('is-scrolled', window.scrollY > 50);
  }

  function updateReadingProgress() {
    const bar = one('#reading-progress');
    if (!bar) return;

    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollable <= 0 ? 0 : clamp(window.scrollY / scrollable, 0, 1);
    bar.style.width = `${progress * 100}%`;
    bar.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
  }

  function setupScrollEffects() {
    updateHeaderOnScroll();
    updateReadingProgress();

    let animationFrame = 0;
    window.addEventListener('scroll', () => {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(() => {
        updateHeaderOnScroll();
        updateReadingProgress();
        animationFrame = 0;
      });
    }, { passive: true });

    window.addEventListener('resize', updateReadingProgress, { passive: true });
    setupRevealObserver();
    setupActiveSectionObserver();
  }

  function setupRevealObserver() {
    const targets = many('.section-marker, .section-heading, .birthday-letter, .video-frame');
    if (REDUCED_MOTION.matches || !('IntersectionObserver' in window)) {
      targets.forEach((target) => target.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries, currentObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        currentObserver.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -35px 0px' });

    targets.forEach((target) => {
      target.classList.add('reveal-on-scroll');
      observer.observe(target);
    });
  }

  function setupActiveSectionObserver() {
    if (!('IntersectionObserver' in window)) return;
    const navigationLinks = many('#primary-navigation a[href^="#"]');
    const sections = navigationLinks
      .map((link) => one(link.getAttribute('href')))
      .filter(Boolean);

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navigationLinks.forEach((link) => {
          const active = link.getAttribute('href') === `#${entry.target.id}`;
          link.classList.toggle('is-current', active);
          if (active) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-20% 0px -65% 0px' });

    sections.forEach((section) => observer.observe(section));
  }

  /* ------------------------------------------------------------------------
     Accessible speech playback for the birthday letter
     --------------------------------------------------------------------- */

  function speechIsAvailable() {
    return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  }

  function setSpeechButtonActive(active) {
    const button = one('#letter-read-aloud');
    const label = one('.letter-read-aloud__label');
    if (!button || !label) return;

    state.speechIsActive = active;
    setPressed(button, active);
    label.textContent = active ? 'Stop reading the letter' : 'Read this letter aloud';
  }

  function stopLetterSpeech() {
    if (!speechIsAvailable()) return;
    window.speechSynthesis.cancel();
    setSpeechButtonActive(false);
    const status = one('#speech-status');
    if (status) status.textContent = 'The reading has stopped.';
  }

  function startLetterSpeech() {
    const letter = one('.birthday-letter__body');
    const status = one('#speech-status');
    if (!letter || !speechIsAvailable()) {
      if (status) status.textContent = 'This browser does not offer a voice reading feature.';
      toast('Voice reading is not available in this browser.');
      return;
    }

    const utterance = new SpeechSynthesisUtterance(letter.innerText);
    utterance.rate = 0.92;
    utterance.pitch = 1;
    utterance.lang = 'en-US';
    utterance.onstart = () => {
      setSpeechButtonActive(true);
      if (status) status.textContent = 'The letter is being read aloud.';
    };
    utterance.onend = () => {
      setSpeechButtonActive(false);
      if (status) status.textContent = 'The reading has finished.';
    };
    utterance.onerror = () => {
      setSpeechButtonActive(false);
      if (status) status.textContent = 'The voice reading could not finish.';
    };

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  function bindLetterSpeech() {
    one('#letter-read-aloud')?.addEventListener('click', () => {
      if (state.speechIsActive) stopLetterSpeech();
      else startLetterSpeech();
    });

    window.addEventListener('pagehide', stopLetterSpeech);
  }

  /* ------------------------------------------------------------------------
     Photo gallery: filtering, saved moments, and slideshow
     --------------------------------------------------------------------- */

  function galleryTiles() {
    return many('.photo-tile');
  }

  function photoId(tile) {
    return tile?.dataset.image || '';
  }

  function isPhotoFavorite(tile) {
    return state.savedPhotoIds.has(photoId(tile));
  }

  function updatePhotoFavoriteButton(tile) {
    const button = one('.photo-tile__favorite', tile);
    const favorite = isPhotoFavorite(tile);
    setPressed(button, favorite);
    if (button) button.setAttribute('aria-label', favorite ? 'Remove photo from favorites' : 'Save photo to favorites');
  }

  function applyGalleryFilter(filterName) {
    state.galleryFilter = filterName;
    const tiles = galleryTiles();
    let visibleCount = 0;

    tiles.forEach((tile) => {
      let visible = true;
      if (filterName === 'portrait' || filterName === 'landscape') {
        visible = tile.dataset.photoKind === filterName;
      }
      if (filterName === 'favorites') visible = isPhotoFavorite(tile);
      tile.classList.toggle('is-hidden', !visible);
      if (visible) visibleCount += 1;
    });

    many('[data-gallery-filter]').forEach((button) => {
      const active = button.dataset.galleryFilter === filterName;
      button.classList.toggle('is-active', active);
      setPressed(button, active);
    });

    const empty = one('#gallery-empty');
    if (empty) empty.hidden = visibleCount > 0;
    announce(`${visibleCount} ${visibleCount === 1 ? 'photo' : 'photos'} shown.`);
  }

  function togglePhotoFavorite(tile) {
    const id = photoId(tile);
    if (!id) return;

    if (state.savedPhotoIds.has(id)) {
      state.savedPhotoIds.delete(id);
      toast('Photo removed from your saved album.');
    } else {
      state.savedPhotoIds.add(id);
      toast('Photo saved to your little favorites album.');
    }

    safeWrite(STORAGE_KEYS.photoFavorites, [...state.savedPhotoIds]);
    updatePhotoFavoriteButton(tile);

    if (state.galleryFilter === 'favorites') applyGalleryFilter('favorites');
    updateLightboxFavoriteButton();
  }

  function restorePhotoFavoriteButtons() {
    galleryTiles().forEach(updatePhotoFavoriteButton);
  }

  function bindGalleryFilters() {
    many('[data-gallery-filter]').forEach((button) => {
      button.addEventListener('click', () => applyGalleryFilter(button.dataset.galleryFilter));
    });

    galleryTiles().forEach((tile) => {
      one('.photo-tile__favorite', tile)?.addEventListener('click', (event) => {
        event.stopPropagation();
        togglePhotoFavorite(tile);
      });
    });

    restorePhotoFavoriteButtons();
  }

  /* Photo viewer setup continues with focus and keyboard management. */

  function visibleGalleryTiles() {
    return galleryTiles().filter((tile) => !tile.classList.contains('is-hidden'));
  }

  function populateLightbox(tile) {
    const image = one('#lightbox-image');
    const caption = one('#lightbox-caption');
    const counter = one('#lightbox-counter');
    if (!tile || !image || !caption || !counter) return;

    const visible = visibleGalleryTiles();
    const index = visible.indexOf(tile);
    state.currentPhotoIndex = Math.max(0, index);
    image.src = tile.dataset.image;
    image.alt = one('img', tile)?.alt || 'Doris in a birthday photograph';
    caption.textContent = tile.dataset.caption || 'A moment worth keeping';
    counter.textContent = `${String(index + 1).padStart(2, '0')} / ${String(visible.length).padStart(2, '0')}`;
    updateLightboxFavoriteButton();
  }

  function openPhotoViewer(tile, opener) {
    const dialog = one('#photo-lightbox');
    if (!dialog || !tile) return;

    stopSlideshow();
    state.photoDialogOpener = opener || document.activeElement;
    populateLightbox(tile);

    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');

    focusWithoutScroll(one('#lightbox-close'));
  }

  function closePhotoViewer() {
    const dialog = one('#photo-lightbox');
    if (!dialog) return;

    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
    state.photoDialogOpener?.focus?.({ preventScroll: true });
    state.photoDialogOpener = null;
  }

  function moveLightbox(direction) {
    const visible = visibleGalleryTiles();
    if (!visible.length) return;

    const next = (state.currentPhotoIndex + direction + visible.length) % visible.length;
    populateLightbox(visible[next]);
  }

  function updateLightboxFavoriteButton() {
    const visible = visibleGalleryTiles();
    const tile = visible[state.currentPhotoIndex];
    const button = one('#lightbox-favorite');
    const favorite = Boolean(tile && isPhotoFavorite(tile));
    setPressed(button, favorite);
    if (button) button.innerHTML = favorite ? '<span aria-hidden="true">♥</span> Saved to favorites' : '<span aria-hidden="true">♡</span> Save this photo';
  }

  function bindPhotoViewer() {
    galleryTiles().forEach((tile) => {
      const opener = one('.photo-tile__open', tile);
      opener?.addEventListener('click', () => openPhotoViewer(tile, opener));
    });

    one('#lightbox-close')?.addEventListener('click', closePhotoViewer);
    one('#lightbox-previous')?.addEventListener('click', () => moveLightbox(-1));
    one('#lightbox-next')?.addEventListener('click', () => moveLightbox(1));

    one('#lightbox-favorite')?.addEventListener('click', () => {
      const visible = visibleGalleryTiles();
      const tile = visible[state.currentPhotoIndex];
      if (tile) togglePhotoFavorite(tile);
    });

    const dialog = one('#photo-lightbox');
    dialog?.addEventListener('click', (event) => {
      if (event.target === dialog) closePhotoViewer();
    });

    dialog?.addEventListener('keydown', (event) => {
      trapTabKey(event, dialog);
      if (event.key === 'ArrowLeft') moveLightbox(-1);
      if (event.key === 'ArrowRight') moveLightbox(1);
    });

    bindLightboxSwipe(dialog);
  }

  function bindLightboxSwipe(dialog) {
    if (!dialog) return;

    dialog.addEventListener('touchstart', (event) => {
      state.pointerStartX = event.changedTouches[0]?.clientX ?? null;
    }, { passive: true });

    dialog.addEventListener('touchend', (event) => {
      if (state.pointerStartX === null) return;
      const endX = event.changedTouches[0]?.clientX ?? state.pointerStartX;
      const delta = endX - state.pointerStartX;
      state.pointerStartX = null;
      if (Math.abs(delta) < 45) return;
      moveLightbox(delta > 0 ? -1 : 1);
    }, { passive: true });
  }

  function startSlideshow() {
    const visible = visibleGalleryTiles();
    if (!visible.length) return;

    const first = visible[0];
    openPhotoViewer(first, one('#slideshow-toggle'));
    setPressed(one('#slideshow-toggle'), true);
    one('#slideshow-toggle').innerHTML = '<span aria-hidden="true">Ⅱ</span> Pause slideshow';

    state.slideshowTimer = window.setInterval(() => {
      if (!one('#photo-lightbox')?.open) {
        stopSlideshow();
        return;
      }
      moveLightbox(1);
    }, 4000);
  }

  function stopSlideshow() {
    if (state.slideshowTimer) window.clearInterval(state.slideshowTimer);
    state.slideshowTimer = null;
    const button = one('#slideshow-toggle');
    setPressed(button, false);
    if (button) button.innerHTML = '<span aria-hidden="true">▶</span> Start slideshow';
  }

  function bindSlideshow() {
    one('#slideshow-toggle')?.addEventListener('click', () => {
      if (state.slideshowTimer) {
        stopSlideshow();
        toast('Slideshow paused.');
      } else {
        startSlideshow();
      }
    });

    one('#photo-lightbox')?.addEventListener('close', stopSlideshow);
  }

  /* ------------------------------------------------------------------------
     Wish jar: a shuffled deck, favorites, and sharing
     --------------------------------------------------------------------- */

  function shuffle(values) {
    const shuffled = [...values];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled;
  }

  function refillWishDeck() {
    state.wishDeck = shuffle(birthdayWishes);
    if (state.wishDeck.length > 1 && state.wishDeck.at(-1) === state.currentWish) {
      state.wishDeck.unshift(state.wishDeck.pop());
    }
  }

  function drawWish() {
    if (!state.wishDeck.length) refillWishDeck();
    const nextWish = state.wishDeck.pop();
    if (!nextWish) return;

    state.currentWish = nextWish;
    state.lastWishIndex = birthdayWishes.indexOf(nextWish);
    const message = one('#current-wish-message');
    const card = one('#wish-reveal-card');
    if (message) message.textContent = nextWish;

    card?.classList.remove('is-celebrating');
    window.requestAnimationFrame(() => card?.classList.add('is-celebrating'));
    updateCurrentWishSavedState();
    triggerCelebration({ count: 12, origin: 'center' });
    announce(`A birthday wish for Doris: ${nextWish}`);
  }

  function updateCurrentWishSavedState() {
    const button = one('#save-current-wish');
    const saved = state.savedWishMessages.has(state.currentWish);
    setPressed(button, saved);
    if (button) button.innerHTML = saved ? '<span aria-hidden="true">♥</span> Wish saved' : '<span aria-hidden="true">♡</span> Save this wish';
  }

  function toggleCurrentWishSaved() {
    if (state.savedWishMessages.has(state.currentWish)) {
      state.savedWishMessages.delete(state.currentWish);
      toast('Wish removed from your saved messages.');
    } else {
      state.savedWishMessages.add(state.currentWish);
      toast('This wish is saved for you.');
    }

    safeWrite(STORAGE_KEYS.wishFavorites, [...state.savedWishMessages]);
    updateCurrentWishSavedState();
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (error) {
        console.info('Clipboard access was declined.', error);
      }
    }

    return copyTextWithSelection(text);
  }

  function copyTextWithSelection(text) {
    const helper = document.createElement('textarea');
    helper.value = text;
    helper.setAttribute('readonly', '');
    helper.style.position = 'fixed';
    helper.style.opacity = '0';
    document.body.append(helper);
    helper.select();

    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch (error) {
      console.info('The browser could not copy the message.', error);
    }

    helper.remove();
    return copied;
  }

  async function shareText(title, text) {
    const hasShareableWebAddress = location.protocol === 'http:' || location.protocol === 'https:';
    if (!hasShareableWebAddress) {
      const copied = await copyText(`${text}\n\nTo share the full page, upload the website folder to a web host first.`);
      toast(copied ? 'Copied a note. Host the website folder before sharing its page link.' : 'Host the website folder before sharing its page link.');
      return copied;
    }

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url: location.href });
        return true;
      } catch (error) {
        if (error.name !== 'AbortError') console.info('Sharing was unavailable.', error);
        return false;
      }
    }

    const copied = await copyText(`${text}\n\n${location.href}`);
    toast(copied ? 'Copied so you can share it wherever you like.' : 'Sharing is not available in this browser.');
    return copied;
  }

  function bindWishJar() {
    one('#draw-wish')?.addEventListener('click', drawWish);
    one('#save-current-wish')?.addEventListener('click', toggleCurrentWishSaved);
    one('#share-current-wish')?.addEventListener('click', () => {
      shareText('A birthday wish for Doris', state.currentWish);
    });
    one('#current-wish-message')?.addEventListener('dblclick', () => copyText(state.currentWish));
    refillWishDeck();
    updateCurrentWishSavedState();
  }

  /* ------------------------------------------------------------------------
     Video controls and gentle playback behavior
     --------------------------------------------------------------------- */

  function bindVideoControls() {
    const video = one('#birthday-video');
    const playButton = one('#video-play-button');
    if (!video || !playButton) return;

    playButton.addEventListener('click', async () => {
      if (video.paused) {
        try {
          await video.play();
          video.focus({ preventScroll: true });
        } catch (error) {
          toast('Tap the video player to start playback.');
          console.info('Video playback did not start.', error);
        }
      } else {
        video.pause();
        video.focus({ preventScroll: true });
      }
    });

    video.addEventListener('play', () => {
      playButton.innerHTML = '<span aria-hidden="true">Ⅱ</span> Pause your video memory';
    });

    video.addEventListener('pause', () => {
      playButton.innerHTML = '<span aria-hidden="true">▶</span> Play your video memory';
    });

    video.addEventListener('ended', () => {
      playButton.innerHTML = '<span aria-hidden="true">↻</span> Watch that moment again';
      announce('The video memory has finished.');
    });
  }

  /* ------------------------------------------------------------------------
     Sharing the page and creating a local calendar reminder
     --------------------------------------------------------------------- */

  async function shareBirthdayPage() {
    const message = 'Happy birthday, Doris! A little birthday keepsake made with love.';
    await shareText('For Doris — a birthday keepsake', message);
  }

  function createCalendarFile() {
    const calendar = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Birthday Keepsake//Doris//EN',
      'BEGIN:VEVENT',
      'UID:doris-birthday-20261025@birthday-keepsake.local',
      'DTSTAMP:20261021T000000Z',
      'DTSTART;VALUE=DATE:20261025',
      'DTEND;VALUE=DATE:20261026',
      'SUMMARY:Celebrate Doris turning 22',
      'DESCRIPTION:Happy 22nd birthday to Doris, a dear friend and sister at heart.',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([calendar], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'doris-birthday.ics';
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Birthday reminder downloaded.');
  }

  function bindSharing() {
    one('#share-birthday')?.addEventListener('click', shareBirthdayPage);
    one('#return-to-start')?.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: REDUCED_MOTION.matches ? 'auto' : 'smooth' });
      window.setTimeout(() => focusWithoutScroll(one('#hero-title')), 450);
    });
    one('#add-calendar-reminder')?.addEventListener('click', createCalendarFile);
  }

  function bindReplyForm() {
    const form = one('#reply-form');
    const message = one('#reply-message');
    const status = one('#reply-status');
    if (!form || !message || !status) return;
    const privacy = one('#reply-privacy');
    if (REPORTING.accessKey && privacy) privacy.textContent = 'Pressing Send delivers your reaction and note straight to Benjamin.';

    many('.reaction').forEach((button) => button.addEventListener('click', () => {
      state.reaction = button.dataset.r;
      many('.reaction').forEach((other) => other.setAttribute('aria-pressed', String(other === button)));
      state.track?.(`Chose the reaction “${state.reaction}”`);
    }));
    const compose = () => `${state.reaction ? `Reaction: ${state.reaction}\n\n` : ''}${message.value.trim()}`.trim();

    one('#reply-copy')?.addEventListener('click', async () => {
      const text = compose();
      if (!text) { status.textContent = 'Pick a reaction or write your note first, then copy it.'; return; }
      const copied = await copyText(`To: ${REPLY_EMAIL}\n\n${text}`);
      status.textContent = copied ? `Copied. Paste it into an email to ${REPLY_EMAIL}.` : `Could not copy. Please email your note to ${REPLY_EMAIL}.`;
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const text = compose();
      if (!text) { status.textContent = 'Pick a reaction or write a few words first.'; return; }
      if (state.reportReady?.()) {
        status.textContent = 'Sending…';
        const ok = await state.sendNote(`Hi Benjamin! Doris says:\n\n${text}`);
        status.textContent = ok ? 'Sent to Benjamin ✦ Thank you!' : 'Could not send just now. Try “Copy my note instead”.';
        if (ok) { triggerCelebration({ count: 70, origin: 'center' }); state.track?.('Sent you a note and reaction'); }
        return;
      }
      if (!REPLY_EMAIL) { status.textContent = 'The reply email address has not been set up yet.'; return; }
      const body = `Hi Benjamin! Here is my note after visiting my birthday page:\n\n${text}`;
      status.textContent = `Your email app is opening. If nothing happens, tap “Copy my note instead” and send it to ${REPLY_EMAIL}.`;
      window.location.href = `mailto:${encodeURIComponent(REPLY_EMAIL)}?subject=${encodeURIComponent('A note from Doris')}&body=${encodeURIComponent(body)}`;
    });
  }

  /* ------------------------------------------------------------------------
     Confetti uses a small canvas and stops when the page is not visible
     --------------------------------------------------------------------- */

  function resizeCelebrationCanvas() {
    const canvas = one('#celebration-canvas');
    if (!canvas) return null;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * ratio);
    canvas.height = Math.floor(window.innerHeight * ratio);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    const context = canvas.getContext('2d');
    context?.setTransform(ratio, 0, 0, ratio, 0, 0);
    return context;
  }

  function makeConfettiParticle(x, y, palette) {
    return {
      x,
      y,
      vx: (Math.random() - 0.5) * 7,
      vy: -2 - Math.random() * 5,
      gravity: 0.08 + Math.random() * 0.09,
      rotation: Math.random() * Math.PI,
      rotationSpeed: (Math.random() - 0.5) * 0.16,
      size: 3 + Math.random() * 5,
      life: 1,
      decay: 0.008 + Math.random() * 0.006,
      color: palette[Math.floor(Math.random() * palette.length)],
      shape: Math.random() > 0.55 ? 'circle' : 'ribbon'
    };
  }

  function triggerCelebration(options = {}) {
    if (REDUCED_MOTION.matches || document.hidden) return;
    const context = resizeCelebrationCanvas();
    if (!context) return;

    const palette = ['#edc474', '#eea08b', '#fff4dc', '#c89cc2', '#f7c9b1'];
    const count = clamp(options.count || 18, 0, 60);
    const startX = window.innerWidth / 2;
    const startY = options.origin === 'top' ? window.innerHeight * 0.18 : window.innerHeight * 0.55;

    for (let index = 0; index < count; index += 1) {
      state.confettiParticles.push(makeConfettiParticle(startX, startY, palette));
    }

    if (!state.confettiFrame) animateCelebration();
  }

  function drawConfettiParticle(context, particle) {
    context.save();
    context.globalAlpha = Math.max(0, particle.life);
    context.fillStyle = particle.color;
    context.translate(particle.x, particle.y);
    context.rotate(particle.rotation);

    if (particle.shape === 'circle') {
      context.beginPath();
      context.arc(0, 0, particle.size * 0.55, 0, Math.PI * 2);
      context.fill();
    } else {
      context.fillRect(-particle.size * 0.5, -particle.size * 0.2, particle.size, particle.size * 0.4);
    }

    context.restore();
  }

  function animateCelebration() {
    const canvas = one('#celebration-canvas');
    const context = canvas?.getContext('2d');
    if (!canvas || !context || document.hidden) {
      state.confettiParticles = [];
      state.confettiFrame = null;
      return;
    }

    context.clearRect(0, 0, window.innerWidth, window.innerHeight);
    state.confettiParticles.forEach((particle) => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += particle.gravity;
      particle.rotation += particle.rotationSpeed;
      particle.life -= particle.decay;
      drawConfettiParticle(context, particle);
    });

    state.confettiParticles = state.confettiParticles.filter((particle) => particle.life > 0 && particle.y < window.innerHeight + 30);

    if (state.confettiParticles.length) {
      state.confettiFrame = window.requestAnimationFrame(animateCelebration);
    } else {
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);
      state.confettiFrame = null;
    }
  }

  function bindCelebrationCanvas() {
    window.addEventListener('resize', () => {
      if (state.confettiParticles.length) resizeCelebrationCanvas();
    }, { passive: true });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && state.confettiFrame) {
        window.cancelAnimationFrame(state.confettiFrame);
        state.confettiFrame = null;
        state.confettiParticles = [];
      }
    });
  }

  /* ------------------------------------------------------------------------
     Cross-page keyboard support and preference changes
     --------------------------------------------------------------------- */

  function bindGlobalKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
      const dialog = one('#photo-lightbox');
      if (dialog?.open) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;

      if (event.key === 'g' && !isTypingTarget(event.target)) scrollToTarget('#gallery');
      if (event.key === 'l' && !isTypingTarget(event.target)) scrollToTarget('#letter');
      if (event.key === 'w' && !isTypingTarget(event.target)) scrollToTarget('#wish-jar');
    });
  }

  function isTypingTarget(target) {
    if (!(target instanceof HTMLElement)) return false;
    return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
  }

  function bindReducedMotionChanges() {
    REDUCED_MOTION.addEventListener?.('change', (event) => {
      if (event.matches && state.confettiFrame) {
        window.cancelAnimationFrame(state.confettiFrame);
        state.confettiFrame = null;
        state.confettiParticles = [];
      }
    });
  }

  /* ------------------------------------------------------------------------
     Initial content, restored state, and startup wiring
     --------------------------------------------------------------------- */

  function bindChapterSoundtrack() {
    const mount = one('#spotify-player');
    const currentLabel = one('#soundtrack-current');
    const status = one('#soundtrack-status');
    const playButton = one('#soundtrack-play');
    const toggleButton = one('#soundtrack-toggle');
    const dock = one('#soundtrack-dock');
    if (!mount || !currentLabel || !status || !playButton) return;

    // All songs are by Paul Clement. To swap one, replace the id after "spotify:track:".
    const SONGS = [
      { uri: 'spotify:track:0My1tfZBaoh8Wpk7X13eZs', title: 'Unaweza' },
      { uri: 'spotify:track:5CaGvOQgG4bXFKudQkSp96', title: 'Nafasi' },
      { uri: 'spotify:track:29xIQdObak8ALIgzz2FqTJ', title: 'Mwokozi' },
      { uri: 'spotify:track:10TjgdG0JSzmaVr6OyTEhx', title: 'Safari' },
    ];
    const idOf = (index) => SONGS[index].uri.split(':').pop();
    if (!one('#welcome-screen')?.hidden) dock.classList.add('is-gated');

    let controller = null;
    let embedReady = false; // the embedded Spotify player has finished loading
    let wanted = false;     // the visitor asked for music
    let started = false;    // the current song has begun
    let playing = false;
    let advancing = false;
    let usingFallback = false;
    let tidied = false;
    let songIndex = 0;
    let fallbackTimer = 0;
    let trackedSong = -1;

    const say = (text, href, label) => {
      status.textContent = text;
      if (!href) return;
      const link = document.createElement('a');
      link.href = href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = label;
      status.append(' ', link);
    };

    const expand = () => {
      dock.classList.remove('is-collapsed');
      dock.classList.add('is-expanded');
      if (toggleButton) toggleButton.textContent = 'Hide player';
    };

    // Play only once the embed has fired "ready"; commands sent earlier are silently dropped.
    const begin = () => {
      if (!wanted || !embedReady || !controller) return;
      if (started) controller.resume(); else controller.play();
    };

    const loadSong = (index) => {
      songIndex = index % SONGS.length;
      embedReady = false;
      started = false;
      currentLabel.textContent = `Next: ${SONGS[songIndex].title}`;
      controller.loadUri(SONGS[songIndex].uri); // "ready" fires again, then begin() plays it
    };

    const start = () => {
      wanted = true;
      if (usingFallback) return;
      if (!embedReady) { say('Getting the music ready…'); return; }
      begin();
    };

    const nudge = () => {
      if (playing) return;
      dock.classList.add('needs-tap');
      expand();
      if (!usingFallback) say('Tap the ▶ in the Spotify player to start your song.', `https://open.spotify.com/track/${idOf(songIndex)}`, 'Or open it in Spotify ↗');
    };
    state.startIntroSong = () => { start(); window.setTimeout(nudge, 3500); };
    state.releaseDock = () => dock.classList.remove('is-gated');

    const tidySoon = () => {
      if (tidied) return;
      tidied = true;
      window.setTimeout(() => {
        if (playing && window.matchMedia('(max-width: 620px)').matches) {
          dock.classList.remove('is-expanded', 'needs-tap');
          dock.classList.add('is-collapsed');
          if (toggleButton) toggleButton.textContent = 'Show player';
        }
      }, 4000);
    };

    // Plan B: a plain Spotify player the visitor taps. Works even if Spotify's script is blocked.
    const useFallback = () => {
      if (embedReady || usingFallback) return;
      usingFallback = true;
      const frame = document.createElement('iframe');
      frame.src = `https://open.spotify.com/embed/track/${idOf(0)}?utm_source=generator&theme=0`;
      frame.title = 'Spotify player';
      frame.width = '100%';
      frame.height = '80';
      frame.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
      mount.replaceChildren(frame);
      playButton.hidden = true;
      dock.classList.add('needs-tap');
      if (one('#welcome-screen')?.hidden) expand();
      say('Tap the ▶ in the Spotify player to hear the song.', `https://open.spotify.com/track/${idOf(0)}`, 'Or open it in Spotify ↗');
      window.setTimeout(() => {
        if (window.matchMedia('(max-width: 620px)').matches) {
          dock.classList.remove('is-expanded', 'needs-tap');
          dock.classList.add('is-collapsed');
          if (toggleButton) toggleButton.textContent = 'Show player';
        }
      }, 20000);
    };

    window.onSpotifyIframeApiReady = (IFrameAPI) => {
      if (usingFallback) return;
      const slot = document.createElement('div');
      mount.replaceChildren(slot);
      IFrameAPI.createController(slot, { width: '100%', height: 80, uri: SONGS[0].uri }, (embed) => {
        controller = embed;
        controller.addListener('ready', () => {
          embedReady = true;
          window.clearTimeout(fallbackTimer);
          begin();
        });
        controller.addListener('playback_update', (event) => {
          const data = event.data || {};
          playing = !data.isPaused;
          playButton.textContent = playing ? 'Pause' : (started ? 'Play' : 'Start music');
          if (playing) {
            started = true;
            wanted = true;
            if (trackedSong !== songIndex) { trackedSong = songIndex; state.track?.(`Music playing: ${SONGS[songIndex].title}`); }
            currentLabel.textContent = `Now playing: ${SONGS[songIndex].title}`;
            dock.classList.remove('needs-tap');
            tidySoon();
            if (data.duration && data.duration <= 31000) {
              say('Spotify is only playing a 30-second preview. For full songs, log in to Spotify (Premium) in this browser.', 'https://accounts.spotify.com/login', 'Log in ↗');
            } else if (data.duration) {
              say(`Playing ${SONGS[songIndex].title} by Paul Clement on Spotify.`);
            }
          }
          const ended = data.isPaused && data.duration && data.position >= data.duration - 500;
          if (started && ended && !advancing) {
            advancing = true;
            window.setTimeout(() => { loadSong(songIndex + 1); advancing = false; }, 400);
          }
        });
      });
    };

    const api = document.createElement('script');
    api.src = 'https://open.spotify.com/embed/iframe-api/v1';
    api.async = true;
    api.onerror = useFallback;
    document.head.append(api);
    fallbackTimer = window.setTimeout(useFallback, 7000);

    // If the browser blocked autoplay, the next tap anywhere asks the player to start.
    ['pointerdown', 'touchend', 'keydown'].forEach((type) => {
      window.addEventListener(type, () => { if (wanted && embedReady && !playing) begin(); }, { passive: true });
    });

    playButton.addEventListener('click', () => {
      if (playing) { wanted = false; controller.pause(); } else start();
    });

    toggleButton?.addEventListener('click', () => {
      const collapsed = dock.classList.toggle('is-collapsed');
      dock.classList.toggle('is-expanded', !collapsed);
      toggleButton.textContent = collapsed ? 'Show player' : 'Hide player';
    });
    const sync = () => {
      const mobile = window.matchMedia('(max-width: 620px)').matches;
      if (toggleButton) toggleButton.hidden = !mobile;
      if (!mobile) { dock.classList.remove('is-collapsed', 'is-expanded'); return; }
      if (!dock.classList.contains('is-expanded')) dock.classList.add('is-collapsed');
      if (toggleButton) toggleButton.textContent = dock.classList.contains('is-collapsed') ? 'Show player' : 'Hide player';
    };
    sync();
    window.addEventListener('resize', sync, { passive: true });
  }

  function bindLifeNumbers() {
    const els = many('[data-n]');
    if (!els.length) return;
    const born = Date.UTC(2004, 9, 24, 21, 0, 0); // 25 Oct 2004, 00:00 East Africa Time
    const tick = () => {
      const sec = (Date.now() - born) / 1000;
      const values = { days: sec / 86400, hours: sec / 3600, beats: (sec / 60) * 72, seconds: sec };
      els.forEach((el) => { el.textContent = Math.floor(values[el.dataset.n] || 0).toLocaleString('en-US'); });
    };
    tick();
    window.setInterval(tick, 1000);
  }

  function bindLanterns() {
    const sky = one('#lantern-sky');
    const input = one('#lantern-text');
    const send = one('#lantern-send');
    if (!sky || !input || !send) return;
    const release = (text) => {
      const lantern = document.createElement('div');
      lantern.className = 'lantern';
      lantern.textContent = text;
      lantern.style.setProperty('--x', `${6 + Math.random() * 78}%`);
      lantern.style.setProperty('--dx', `${(Math.random() - 0.5) * 5}rem`);
      sky.append(lantern);
      window.setTimeout(() => lantern.remove(), 11500);
    };
    const go = () => { release(input.value.trim() || 'a wish'); input.value = ''; input.focus(); };
    send.addEventListener('click', go);
    input.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); go(); } });
    new IntersectionObserver((entries, observer) => {
      if (!entries[0].isIntersecting) return;
      observer.disconnect();
      ['Heri ya kuzaliwa', 'Mungu akubariki', '22 ✦'].forEach((text, i) => window.setTimeout(() => release(text), i * 900));
    }, { threshold: 0.4 }).observe(sky);
  }

  function bindWheel() {
    const disc = one('#wheel-disc');
    const spin = one('#wheel-spin');
    const out = one('#wheel-result');
    if (!disc || !spin || !out) return;
    const prizes = [
      ['🎙️', 'A long voice note from Benjamin, just for you'],
      ['🙏', 'A prayer written just for you'],
      ['🎵', 'A song dedicated to you'],
      ['💛', 'One very loud “I’m proud of you!”'],
      ['🤗', 'A hug, valid forever'],
      ['✨', 'A blessing from this whole page: Mungu akubariki, Doris'],
    ];
    prizes.forEach(([glyph], i) => {
      const mark = document.createElement('span');
      mark.textContent = glyph;
      mark.style.setProperty('--a', `${30 + i * 60}deg`);
      disc.append(mark);
    });
    let rotation = 0;
    let busy = false;
    spin.addEventListener('click', () => {
      if (busy) return;
      busy = true;
      const pick = Math.floor(Math.random() * prizes.length);
      const jitter = (Math.random() - 0.5) * 36;
      rotation += 1800 + ((360 - (pick * 60 + 30) - (rotation % 360)) + 720) % 360 + jitter;
      disc.style.transform = `rotate(${rotation}deg)`;
      out.textContent = 'Spinning…';
      window.setTimeout(() => {
        out.textContent = `${prizes[pick][0]} ${prizes[pick][1]}`;
        busy = false;
        triggerCelebration({ count: 50, origin: 'center' });
      }, REDUCED_MOTION.matches ? 100 : 4700);
    });
  }

  function bindFireflies() {
    if (REDUCED_MOTION.matches) return;
    const hero = one('.hero-section');
    if (!hero) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'fireflies';
    canvas.setAttribute('aria-hidden', 'true');
    hero.prepend(canvas);
    const g = canvas.getContext('2d');
    let w = 0;
    let h = 0;
    let raf = 0;
    const dots = Array.from({ length: 34 }, () => ({ x: Math.random(), y: Math.random(), r: 1.5 + Math.random() * 2.5, vx: (Math.random() - 0.5) * 0.00018, vy: -0.00006 - Math.random() * 0.00014, p: Math.random() * 6 }));
    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = hero.clientWidth; h = hero.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const draw = (t) => {
      g.clearRect(0, 0, w, h);
      dots.forEach((d) => {
        d.x += d.vx * 16; d.y += d.vy * 16;
        if (d.y < -0.05) { d.y = 1.05; d.x = Math.random(); }
        const alpha = 0.35 + 0.35 * Math.sin(t / 700 + d.p);
        const radius = d.r * 5;
        const glow = g.createRadialGradient(d.x * w, d.y * h, 0, d.x * w, d.y * h, radius);
        glow.addColorStop(0, `rgba(255,214,130,${alpha})`);
        glow.addColorStop(1, 'rgba(255,214,130,0)');
        g.fillStyle = glow;
        g.beginPath(); g.arc(d.x * w, d.y * h, radius, 0, 6.283); g.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    size();
    window.addEventListener('resize', size, { passive: true });
    new IntersectionObserver(([entry]) => { cancelAnimationFrame(raf); if (entry.isIntersecting) raf = requestAnimationFrame(draw); }).observe(hero);
  }

  function bindReveal() {
    if (REDUCED_MOTION.matches || !('IntersectionObserver' in window)) return;
    const items = many('.section-shell > *:not(.secret-star):not(.ticket)');
    document.documentElement.classList.add('js-reveal');
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add('is-in'); observer.unobserve(entry.target); }
    }), { threshold: 0.06 });
    items.forEach((item) => { item.classList.add('reveal'); observer.observe(item); });
  }

  function bindTilt() {
    if (REDUCED_MOTION.matches) return;
    many('.photo-tile').forEach((tile) => {
      tile.addEventListener('pointermove', (event) => {
        if (event.pointerType !== 'mouse') return;
        const box = tile.getBoundingClientRect();
        const x = (event.clientX - box.left) / box.width - 0.5;
        const y = (event.clientY - box.top) / box.height - 0.5;
        tile.style.transform = `perspective(700px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg) scale(1.03)`;
      });
      tile.addEventListener('pointerleave', () => { tile.style.transform = ''; });
    });
  }

  function bindChimes() {
    let audio = null;
    const sounds = { '.secret-star': [784, 988, 1319], '.candle': [330], '.flip-card': [660], '.envelope': [523, 659], '#lantern-send': [523, 659, 784], '#wheel-spin': [392, 494, 587, 784], '.memory-card': [600], '#cake-relight': [440, 554] };
    const note = (freq, at) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      const t = audio.currentTime + at;
      osc.type = 'sine'; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.05, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      osc.connect(gain).connect(audio.destination);
      osc.start(t); osc.stop(t + 0.55);
    };
    one('#chime-toggle')?.addEventListener('click', (event) => {
      state.chimesOn = state.chimesOn === false;
      event.currentTarget.setAttribute('aria-pressed', String(state.chimesOn));
      event.currentTarget.textContent = state.chimesOn ? '♪ on' : '♪ off';
      event.currentTarget.setAttribute('aria-label', `${event.currentTarget.textContent}. Tap sounds switch`);
    });
    document.addEventListener('click', (event) => {
      if (state.chimesOn === false) return;
      const hit = Object.keys(sounds).find((selector) => event.target.closest(selector));
      if (!hit) return;
      try {
        audio = audio || new (window.AudioContext || window.webkitAudioContext)();
        if (audio.state === 'suspended') audio.resume();
        sounds[hit].forEach((freq, i) => note(freq, i * 0.11));
      } catch { /* sound is optional */ }
    });
  }

  /* ------------------------------------------------------------------------
     Doris's qualities: studio (music, choir, kelele), mirror, boss, house, surprises
     --------------------------------------------------------------------- */

  const audioCtx = () => {
    state.audio = state.audio || new (window.AudioContext || window.webkitAudioContext)();
    if (state.audio.state === 'suspended') state.audio.resume();
    return state.audio;
  };

  const noiseBuffer = (ctx) => {
    if (!state.noise) {
      const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      state.noise = buffer;
    }
    return state.noise;
  };

  function bindStudio() {
    const voices = many('.voice');
    const pads = many('.pad');
    const kelele = one('#kelele-btn');
    const status = one('#studio-status');
    const bars = many('#kelele-meter i');
    if (!voices.length || !kelele || !status) return;

    // ---- choir: four sustained voices that make one chord
    const live = new Map();
    const startVoice = (button) => {
      const ctx = audioCtx();
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = Number(button.dataset.hz);
      lfo.frequency.value = 5 + Math.random();
      depth.gain.value = 7;
      lfo.connect(depth).connect(osc.detune);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.07, t + 0.7);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t); lfo.start(t);
      live.set(button, { osc, lfo, gain });
    };
    const stopVoice = (button) => {
      const voice = live.get(button);
      if (!voice) return;
      const t = audioCtx().currentTime;
      voice.gain.gain.cancelScheduledValues(t);
      voice.gain.gain.setValueAtTime(Math.max(voice.gain.gain.value, 0.0001), t);
      voice.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      voice.osc.stop(t + 0.55); voice.lfo.stop(t + 0.55);
      live.delete(button);
    };
    voices.forEach((button) => button.addEventListener('click', () => {
      const on = button.getAttribute('aria-pressed') !== 'true';
      button.setAttribute('aria-pressed', String(on));
      if (on) startVoice(button); else stopVoice(button);
      const count = voices.filter((v) => v.getAttribute('aria-pressed') === 'true').length;
      one('.choir')?.classList.toggle('is-amen', count === voices.length);
      status.textContent = count === voices.length ? 'Amen ✦ a full choir, and one of those voices is yours.' : `${count} of ${voices.length} voices singing`;
      if (count === voices.length) { triggerCelebration({ count: 60, origin: 'center' }); state.track?.('Choir: sang all four voices together'); }
      state.bump?.('Choir voices tapped');
    }));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) voices.forEach((button) => { stopVoice(button); button.setAttribute('aria-pressed', 'false'); });
    });

    // ---- beat pads
    const burst = (ctx, t, type, freq, dur, vol) => {
      const src = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      src.buffer = noiseBuffer(ctx);
      filter.type = type; filter.frequency.value = freq;
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start(t); src.stop(t + dur + 0.02);
    };
    const tone = (ctx, t, type, from, to, dur, vol) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(from, t);
      osc.frequency.exponentialRampToValueAtTime(to, t + dur * 0.6);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t); osc.stop(t + dur + 0.02);
    };
    const sounds = {
      kick: (c, t) => tone(c, t, 'sine', 150, 40, 0.28, 0.6),
      snare: (c, t) => { burst(c, t, 'highpass', 1800, 0.18, 0.3); tone(c, t, 'triangle', 200, 120, 0.12, 0.2); },
      hat: (c, t) => burst(c, t, 'highpass', 7000, 0.05, 0.22),
      clap: (c, t) => { [0, 0.015, 0.03].forEach((d) => burst(c, t + d, 'bandpass', 1500, 0.08, 0.3)); },
      bass: (c, t) => tone(c, t, 'sawtooth', 62, 50, 0.45, 0.25),
      stab: (c, t) => { [261.63, 329.63, 392].forEach((f) => tone(c, t, 'triangle', f, f, 0.35, 0.09)); },
      tom: (c, t) => tone(c, t, 'sine', 120, 70, 0.3, 0.5),
      whoop: (c, t) => tone(c, t, 'sine', 400, 1000, 0.3, 0.16),
    };
    pads.forEach((pad) => pad.addEventListener('click', () => {
      const ctx = audioCtx();
      sounds[pad.dataset.pad]?.(ctx, ctx.currentTime);
      pad.classList.add('is-hit');
      window.setTimeout(() => pad.classList.remove('is-hit'), 140);
      state.bump?.('Beat pads tapped');
    }));

    // ---- kelele: hold to get louder (volume is capped: loud, never painful)
    let level = 0;
    let holding = false;
    let maxed = false;
    let timer = 0;
    let fall = 0;
    let src = null;
    let gain = null;
    const paint = () => bars.forEach((bar, i) => bar.classList.toggle('on', i < Math.round((level / 100) * bars.length)));
    const begin = () => {
      if (holding) return;
      holding = true;
      window.clearInterval(fall);
      const ctx = audioCtx();
      src = ctx.createBufferSource();
      src.buffer = noiseBuffer(ctx); src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass'; filter.frequency.value = 900; filter.Q.value = 0.6;
      gain = ctx.createGain(); gain.gain.value = 0.0001;
      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start();
      kelele.classList.add('is-loud');
      timer = window.setInterval(() => {
        level = Math.min(100, level + 4);
        gain.gain.value = Math.min(0.12, 0.01 + (level / 100) * 0.11);
        paint();
        if (level >= 100 && !maxed) {
          maxed = true;
          status.textContent = 'KELELE MAX! And still the nicest person in the room ✦';
          triggerCelebration({ count: 80, origin: 'center' });
          state.track?.('Kelele: reached maximum volume');
        }
      }, 120);
      state.bump?.('Kelele holds');
    };
    const end = () => {
      if (!holding) return;
      holding = false;
      window.clearInterval(timer);
      try { src?.stop(); } catch { /* already stopped */ }
      src = null;
      kelele.classList.remove('is-loud');
      fall = window.setInterval(() => { level = Math.max(0, level - 6); paint(); if (level === 0) { window.clearInterval(fall); maxed = false; } }, 100);
    };
    kelele.addEventListener('pointerdown', (event) => { event.preventDefault(); kelele.setPointerCapture?.(event.pointerId); begin(); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => kelele.addEventListener(type, end));
    kelele.addEventListener('keydown', (event) => { if (event.code === 'Space' || event.key === 'Enter') { event.preventDefault(); if (!event.repeat) begin(); } });
    kelele.addEventListener('keyup', (event) => { if (event.code === 'Space' || event.key === 'Enter') end(); });
  }

  function bindMirror() {
    const mirror = one('#mirror-btn');
    const text = one('#mirror-text');
    if (!mirror || !text) return;
    const lines = {
      pretty: ['Glowing is just what you do. Umependeza!', 'Pretty in the way that makes a room feel warmer. Mrembo!', 'Your style says it all before you say a word.', 'A soft heart, a strong presence, and a smile that proves it.'],
      smart: ['Sharp mind, steady plans. Mwerevu!', 'You don’t just dream, you do the maths and then you do it.', 'The kind of smart that turns ideas into customers.', 'Learning fast and moving faster.'],
    };
    let mode = 'both';
    let count = 0;
    const show = () => {
      const pool = mode === 'both' ? lines[count % 2 ? 'smart' : 'pretty'] : lines[mode];
      text.textContent = pool[Math.floor(count / (mode === 'both' ? 2 : 1)) % pool.length];
      mirror.classList.remove('flash'); void mirror.offsetWidth; mirror.classList.add('flash');
      count += 1;
    };
    mirror.addEventListener('click', () => { show(); state.bump?.('Mirror taps'); });
    many('.mirror-tab').forEach((tab) => tab.addEventListener('click', () => {
      mode = tab.dataset.mode; count = 0;
      many('.mirror-tab').forEach((other) => other.setAttribute('aria-pressed', String(other === tab)));
      show();
    }));

    const riddles = [
      ['What gets bigger the more you take away from it?', 'A hole'],
      ['I speak without a mouth and hear without ears. I come alive with the wind. What am I?', 'An echo'],
      ['What has keys but can’t open a single lock?', 'A piano'],
    ];
    const question = one('#riddle-q');
    const answer = one('#riddle-a');
    let index = 0;
    const render = () => { question.textContent = riddles[index][0]; answer.hidden = true; };
    one('#riddle-reveal')?.addEventListener('click', () => {
      answer.textContent = `Answer: ${riddles[index][1]}. Smart as always ✦`;
      answer.hidden = false;
      state.bump?.('Riddles revealed');
    });
    one('#riddle-next')?.addEventListener('click', () => { index = (index + 1) % riddles.length; render(); });
    if (question && answer) render();
  }

  function bindBoss() {
    const board = one('#board');
    const status = one('#boss-status');
    const stats = one('#boss-stats');
    const reset = one('#boss-reset');
    if (!board || !status || !stats || !reset) return;
    const rivals = [['Competitor A', 100], ['Competitor B', 84], ['Competitor C', 66], ['Competitor D', 48], ['Competitor E', 30]];
    const labels = { customers: 'Customers', reviews: 'Reviews', brand: 'Brand', team: 'Team' };
    let score = 0;
    let won = false;
    let tally = { customers: 0, reviews: 0, brand: 0, team: 0 };
    const render = () => {
      const rows = [...rivals.map(([name, s]) => ({ name, s, me: false })), { name: 'Doris & Co.', s: score, me: true }].sort((a, b) => b.s - a.s);
      board.replaceChildren(...rows.map((row, i) => {
        const item = document.createElement('li');
        if (row.me) item.className = 'is-me';
        item.innerHTML = '<span class="rank"></span><span class="name"></span><span class="bar"><i></i></span>';
        item.querySelector('.rank').textContent = `#${i + 1}`;
        item.querySelector('.name').textContent = row.name;
        item.querySelector('i').style.width = `${Math.min(100, (row.s / 140) * 100)}%`;
        return item;
      }));
      stats.textContent = Object.keys(labels).map((key) => `${labels[key]} ${tally[key]}`).join(' · ');
      return rows.findIndex((row) => row.me) + 1;
    };
    many('.boss-btn').forEach((button) => button.addEventListener('click', () => {
      score = Math.min(140, score + 10 + Math.floor(Math.random() * 11));
      tally[button.dataset.stat] += 1;
      state.bump?.('Boss moves');
      const rank = render();
      if (rank === 1 && !won) {
        won = true;
        status.textContent = '#1 in the sector ✦ Mungu abariki kazi ya mikono yako.';
        reset.hidden = false;
        triggerCelebration({ count: 100, origin: 'center' });
        state.track?.('Boss: reached #1 in the sector');
      } else if (rank !== 1) {
        status.textContent = `You are #${rank} in the sector. Keep going!`;
      }
    }));
    reset.addEventListener('click', () => { score = 0; won = false; tally = { customers: 0, reviews: 0, brand: 0, team: 0 }; reset.hidden = true; status.textContent = 'Pick a move and climb the board.'; render(); });
    render();
  }

  function bindHouse() {
    const windows = many('.window');
    const line = one('#house-line');
    const house = one('.house');
    if (!windows.length || !line || !house) return;
    const notes = [
      'For the family that raised you: may their prayers keep following you.',
      'For the siblings, cousins and friends who feel like family: may your table always be full.',
      'May your home be loud with laughter, and never with quarrels.',
      'May there always be enough, and a little extra to share.',
      'May every room hold a prayer and a song.',
      'For the family you will one day build: may it be full of love, and loud in the very best way.',
    ];
    windows.forEach((win, i) => win.addEventListener('click', () => {
      win.classList.add('is-lit');
      win.setAttribute('aria-pressed', 'true');
      line.textContent = notes[i];
      const lit = windows.filter((w) => w.classList.contains('is-lit')).length;
      state.bump?.('House windows tapped');
      if (lit === windows.length) {
        house.classList.add('is-glowing');
        line.textContent = `${notes[i]} Mungu aibariki familia yako ✦`;
        triggerCelebration({ count: 80, origin: 'center' });
        state.track?.('House of Blessings: lit every window');
      }
    }));

    const text = one('#capsule-text');
    const seal = one('#capsule-seal');
    const note = one('#capsule-status');
    if (!text || !seal || !note) return;
    const KEY = 'doris-capsule-v1';
    const OPENS = Date.UTC(2027, 9, 24, 21, 0, 0); // 25 Oct 2027, 00:00 East Africa Time
    const render = () => {
      const saved = safeRead(KEY, null);
      if (!saved || !saved.text) { note.textContent = 'Only you can read this. It stays in this browser.'; return; }
      text.disabled = true; seal.hidden = true;
      if (Date.now() >= OPENS) { text.value = saved.text; note.textContent = 'Your note from a year ago is open. Read it slowly ✦'; }
      else { text.value = ''; text.placeholder = 'Sealed ✦'; note.textContent = 'Sealed ✦ Come back on 25 October 2027 to open it.'; }
    };
    seal.addEventListener('click', () => {
      const value = text.value.trim();
      if (!value) { note.textContent = 'Write a few words first.'; return; }
      safeWrite(KEY, { text: value, sealedAt: Date.now() });
      render();
      triggerCelebration({ count: 60, origin: 'center' });
      state.track?.('Sealed a time capsule for next year (private, not shared)');
    });
    render();
  }

  function bindSurpriseFab() {
    const fab = one('#surprise-fab');
    const toast = one('#star-toast');
    if (!fab || !toast) return;
    const lines = [
      'Fun fact: 2004 was a very good year. It gave the world you.',
      'Someone is proud of you, quietly and loudly at the same time.',
      'Be loud. Be kind. Be unstoppable. Kelele safi!',
      'Your next big win is closer than it looks.',
      'Every choir needs one voice that carries. That’s you.',
    ];
    const jumps = ['#studio', '#mirror', '#boss', '#house', '#wheel', '#lanterns', '#make-a-wish', '#open-when', '#memory-game'];
    let timer = 0;
    let last = -1;
    const say = (message) => {
      toast.textContent = message; toast.hidden = false;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => { toast.hidden = true; }, 4500);
    };
    const hearts = () => {
      for (let i = 0; i < 18; i += 1) {
        const heart = document.createElement('span');
        heart.className = 'heart-fall';
        heart.textContent = '♡';
        heart.setAttribute('aria-hidden', 'true');
        heart.style.left = `${Math.random() * 100}vw`;
        heart.style.animationDelay = `${Math.random() * 1.2}s`;
        document.body.append(heart);
        window.setTimeout(() => heart.remove(), 4200);
      }
    };
    const actions = [
      () => say(lines[Math.floor(Math.random() * lines.length)]),
      () => { triggerCelebration({ count: 90, origin: 'center' }); say('Surprise! Confetti, no reason needed ✦'); },
      () => { hearts(); say('Hearts for the loudest, kindest girl in the room ♡'); },
      () => {
        const target = jumps[Math.floor(Math.random() * jumps.length)];
        say('Surprise! Teleporting you…');
        window.setTimeout(() => one(target)?.scrollIntoView({ behavior: REDUCED_MOTION.matches ? 'auto' : 'smooth', block: 'start' }), 700);
      },
    ];
    const surprise = () => {
      let pick = Math.floor(Math.random() * actions.length);
      if (pick === last) pick = (pick + 1) % actions.length;
      last = pick;
      actions[pick]();
      state.bump?.('Surprise me presses');
    };
    fab.addEventListener('click', surprise);
    one('#words-surprise')?.addEventListener('click', surprise);
  }

  /* ------------------------------------------------------------------------
     Seeing how she responds: a short, disclosed summary goes to Benjamin
     --------------------------------------------------------------------- */

  function bindReporting() {
    const log = [];
    const tallies = {};
    const seen = new Set();
    const started = Date.now();
    const device = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) ? 'phone or tablet' : 'computer';
    let maxScroll = 0;
    let lastSent = 0;
    let dirty = false;
    let firstTimer = 0;

    const sharing = () => safeRead(SHARE_KEY, true) !== false;
    const stamp = (t) => new Date(t).toLocaleTimeString('en-GB', { timeZone: 'Africa/Dar_es_Salaam' });
    const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();

    state.track = (what) => {
      if (seen.has(what)) return;
      seen.add(what);
      log.push({ t: Date.now(), what });
      dirty = true;
      if (!firstTimer && sharing()) firstTimer = window.setTimeout(() => flush('she just opened it', 0), 20000);
    };
    state.bump = (what) => { tallies[what] = (tallies[what] || 0) + 1; dirty = true; };
    state.reportReady = () => Boolean(REPORTING.accessKey);

    const report = (headline) => {
      const total = Math.round((Date.now() - started) / 1000);
      const lines = [headline, `Time on the page: ${Math.floor(total / 60)} min ${total % 60} s · scrolled ${maxScroll}% · on a ${device}`];
      const tallyLine = Object.entries(tallies).map(([k, v]) => `${k}: ${v}`).join(' · ');
      if (tallyLine) lines.push(`Counts: ${tallyLine}`);
      lines.push('', ...(log.length ? log.map((e) => `${stamp(e.t)}  ${e.what}`) : ['(nothing yet)']));
      return lines.join('\n');
    };
    const send = async (subject, message, keepalive = false) => {
      if (!REPORTING.accessKey) return false;
      const body = new FormData();
      body.append('access_key', REPORTING.accessKey);
      body.append('subject', subject);
      body.append('from_name', 'Doris’s birthday site');
      body.append('message', message);
      try { return (await fetch('https://api.web3forms.com/submit', { method: 'POST', body, keepalive })).ok; } catch { return false; }
    };
    state.sendNote = (note) => send('Doris sent you a reaction ♡', note);

    function flush(why, minGap = 15000, keepalive = false) {
      if (!REPORTING.accessKey || !sharing() || !dirty || Date.now() - lastSent < minGap) return;
      dirty = false; lastSent = Date.now();
      send(`Doris’s visit: ${why}`, report(`Doris is on your birthday site (${why}).`), keepalive);
    }
    window.setInterval(() => flush('still exploring', 90000), 30000);
    document.addEventListener('visibilitychange', () => { if (document.hidden) flush('she left or switched apps', 5000, true); });
    window.addEventListener('pagehide', () => flush('she left', 5000, true));
    window.addEventListener('scroll', () => {
      const root = document.documentElement;
      maxScroll = Math.max(maxScroll, Math.min(100, Math.round(((window.scrollY + window.innerHeight) / root.scrollHeight) * 100)));
    }, { passive: true });

    // cover notice + switch (shown only when reporting is really connected)
    const notice = one('#welcome-share');
    const toggle = one('#share-toggle');
    if (notice && toggle && REPORTING.accessKey) {
      notice.hidden = false;
      const paint = () => { toggle.textContent = sharing() ? 'Sharing is on · tap to turn off' : 'Sharing is off · tap to turn on'; toggle.setAttribute('aria-pressed', String(sharing())); };
      toggle.addEventListener('click', () => { safeWrite(SHARE_KEY, !sharing()); paint(); });
      paint();
    }

    // what she opens (watched from outside, so each feature stays simple)
    document.addEventListener('click', (event) => {
      const t = event.target;
      let m;
      if ((m = t.closest('.secret-star'))) state.track(`Found hidden star ${m.dataset.star} of 5`);
      else if ((m = t.closest('.envelope'))) { if (m.classList.contains('is-open')) state.track(`Opened the letter “${text(m.querySelector('.envelope__title'))}”`); }
      else if ((m = t.closest('.flip-card'))) { if (m.classList.contains('is-flipped')) state.track(`Flipped the card “${text(m.querySelector('.flip-card__front span'))}”`); }
      else if (t.closest('.candle')) window.setTimeout(() => { if (many('.candle.is-lit').length === 0) state.track('Blew out every candle and made a wish'); }, 50);
      else if (t.closest('#lantern-send')) state.bump('Wish lanterns released');
      else if (t.closest('#wheel-spin')) window.setTimeout(() => state.track(`Wheel prize: ${text(one('#wheel-result'))}`), 4900);
      else if ((m = t.closest('.photo-tile__open'))) state.track(`Opened photo ${(m.getAttribute('aria-label') || '').slice(0, 2)}`);
      else if (t.closest('.memory-card')) window.setTimeout(() => { if (/found every memory/.test(text(one('#memory-status')))) state.track(`Memory game: ${text(one('#memory-status'))}`); }, 60);
    });
    document.addEventListener('play', (event) => { if (event.target.matches?.('video')) state.track('Played the birthday video'); }, true);

    // Benjamin's own check page: open the site address followed by #benjamin
    const panel = one('#benjamin-panel');
    if (panel && /benjamin/i.test(`${window.location.hash}${window.location.search}`)) {
      panel.hidden = false;
      const out = one('#benjamin-out');
      one('#benjamin-test')?.addEventListener('click', async () => {
        if (!REPORTING.accessKey) { out.textContent = 'No access key yet. Paste it into REPORTING in doris.js (see README.txt).'; return; }
        out.textContent = 'Sending…';
        const ok = await send('Test from your birthday site', 'This is a test. If you can read this, you will receive Doris’s reactions and visit reports.');
        out.textContent = ok ? 'Test sent. Check your inbox (and spam folder).' : 'Could not send. Check the access key and your internet connection.';
      });
      one('#benjamin-preview')?.addEventListener('click', () => { out.textContent = report('Preview of what you would receive:'); });
    }
  }

  function bindKeepIt() {
    const canvas = one('#ticket-canvas');
    const shareBtn = one('#ticket-share');
    const saveBtn = one('#ticket-save');
    const installBtn = one('#install-btn');
    const status = one('#keep-status');
    const help = one('#install-help');
    if (!canvas || !shareBtn || !saveBtn || !installBtn || !status) return;

    const photo = new Image();
    let photoOk = false;

    // Draws the 9:16 ticket picture at any size (designed on a 540 x 960 grid).
    const draw = (cv, withPhoto) => {
      const g = cv.getContext('2d');
      const k = cv.width / 540;
      g.setTransform(k, 0, 0, k, 0, 0);
      const serif = '"Playfair Display", Georgia, serif';
      const sans = '"DM Sans", Arial, sans-serif';
      const mix = (a, b, t) => Math.round(a + (b - a) * t);
      const bgAt = (y) => `rgb(${mix(58, 29, y / 960)},${mix(33, 18, y / 960)},${mix(70, 40, y / 960)})`;
      const bg = g.createLinearGradient(0, 0, 0, 960);
      bg.addColorStop(0, '#3a2146'); bg.addColorStop(1, '#1d1228');
      g.fillStyle = bg; g.fillRect(0, 0, 540, 960);

      let seed = 7;
      const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      for (let i = 0; i < 70; i += 1) {
        g.fillStyle = `rgba(255,214,130,${0.15 + rnd() * 0.5})`;
        g.beginPath(); g.arc(rnd() * 540, rnd() * 960, 0.8 + rnd() * 2.2, 0, 6.283); g.fill();
      }
      g.textAlign = 'center';
      g.fillStyle = '#edc474'; g.font = `italic 30px ${serif}`;
      g.fillText('✦ Heri ya kuzaliwa ✦', 270, 96);

      // portrait circle
      g.save();
      g.beginPath(); g.arc(270, 235, 96, 0, 6.283); g.clip();
      if (withPhoto && photoOk) {
        const side = photo.naturalWidth * 0.5;
        const sx = photo.naturalWidth * 0.53 - side / 2;
        const sy = photo.naturalHeight * 0.4 - side / 2;
        g.drawImage(photo, sx, sy, side, side, 174, 139, 192, 192);
      } else {
        g.fillStyle = '#51334e'; g.fillRect(174, 139, 192, 192);
        g.fillStyle = '#fff4dc'; g.font = `bold 100px ${serif}`; g.textBaseline = 'middle'; g.fillText('D', 270, 240); g.textBaseline = 'alphabetic';
      }
      g.restore();
      g.strokeStyle = '#edc474'; g.lineWidth = 4;
      g.beginPath(); g.arc(270, 235, 99, 0, 6.283); g.stroke();

      // ticket
      g.save();
      g.translate(270, 560); g.rotate(-0.035);
      const x0 = -225; const y0 = -150; const w = 450; const h = 300;
      const card = g.createLinearGradient(x0, y0, x0 + w, y0 + h);
      card.addColorStop(0, '#fff4dc'); card.addColorStop(1, '#f7d9a8');
      g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 30; g.shadowOffsetY = 12;
      g.fillStyle = card;
      g.beginPath(); g.roundRect(x0, y0, w, h, 18); g.fill();
      g.shadowColor = 'transparent';
      const cut = x0 + 330;
      g.strokeStyle = 'rgba(184,103,107,.7)'; g.lineWidth = 2; g.setLineDash([6, 6]);
      g.beginPath(); g.moveTo(cut, y0 + 14); g.lineTo(cut, y0 + h - 14); g.stroke(); g.setLineDash([]);
      g.fillStyle = '#2a1a35';
      g.beginPath(); g.arc(cut, y0, 12, 0, 6.283); g.fill();
      g.beginPath(); g.arc(cut, y0 + h, 12, 0, 6.283); g.fill();
      g.textAlign = 'left';
      g.fillStyle = '#b8676b'; g.font = `700 12px ${sans}`;
      g.fillText('ADMIT ONE · BIRTHDAY EXPERIENCE', x0 + 24, y0 + 40);
      g.fillStyle = '#281a31'; g.font = `400 66px ${serif}`;
      g.fillText('Doris', x0 + 24, y0 + 112);
      const fields = [['DATE', '25 · 10 · 2026'], ['AGE', '22'], ['SEAT', 'Wherever you are'], ['DRESS CODE', 'Joy']];
      fields.forEach(([label, value], i) => {
        const fx = x0 + 24 + (i % 2) * 150; const fy = y0 + 160 + Math.floor(i / 2) * 62;
        g.fillStyle = 'rgba(40,26,49,.6)'; g.font = `700 10px ${sans}`; g.fillText(label, fx, fy);
        g.fillStyle = '#281a31'; g.font = `italic 19px ${serif}`; g.fillText(value, fx, fy + 24);
      });
      for (let i = 0; i < 22; i += 1) { g.fillStyle = '#281a31'; g.fillRect(cut + 22 + i * 4, y0 + 90, i % 3 === 0 ? 1 : 2, 100); }
      g.textAlign = 'center'; g.fillStyle = '#281a31'; g.font = `700 13px ${sans}`;
      g.fillText('No. 22', cut + 60, y0 + 222);
      g.restore();

      g.textAlign = 'center';
      g.fillStyle = '#edc474'; g.font = `italic 58px ${serif}`;
      g.fillText('Twenty-two', 270, 800);
      g.fillStyle = '#fff4dc'; g.font = `600 17px ${sans}`;
      g.fillText('25 · 10 · 2026', 270, 842);
      g.fillStyle = 'rgba(255,244,220,.65)'; g.font = `italic 18px ${serif}`;
      g.fillText('Loud, never a troublemaker ✦', 270, 905);
    };

    const preview = () => draw(canvas, true);
    const ready = () => { photoOk = photo.naturalWidth > 0; preview(); };
    photo.onload = ready;
    photo.onerror = ready;
    photo.src = 'd10.jpeg';
    preview();
    (document.fonts?.ready || Promise.resolve()).then(preview);

    const makeBlob = () => new Promise((resolve) => {
      const attempt = (withPhoto) => {
        const big = document.createElement('canvas');
        big.width = 1080; big.height = 1920;
        draw(big, withPhoto);
        try { big.toBlob((blob) => resolve(blob), 'image/png'); }
        catch { if (withPhoto) attempt(false); else resolve(null); } // a local file can block the photo
      };
      attempt(true);
    });

    const save = (blob) => {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'doris-birthday-ticket.png';
      document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(link.href), 4000);
      status.textContent = 'Saved to your phone. Open WhatsApp, tap Status, and choose the picture ✦';
    };

    shareBtn.addEventListener('click', async () => {
      status.textContent = 'Making your ticket…';
      const blob = await makeBlob();
      if (!blob) { status.textContent = 'Could not make the picture here. Try opening the site from its web address.'; return; }
      const file = new File([blob], 'doris-birthday-ticket.png', { type: 'image/png' });
      state.track?.('Shared or saved her birthday ticket');
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'My birthday ticket', text: 'Heri ya kuzaliwa to me! Twenty-two today ✦' });
          status.textContent = 'Shared ✦ Happy birthday, Doris!';
          return;
        } catch (error) { if (error?.name === 'AbortError') { status.textContent = ''; return; } }
      }
      save(blob);
    });
    saveBtn.addEventListener('click', async () => {
      status.textContent = 'Making your ticket…';
      const blob = await makeBlob();
      if (blob) { state.track?.('Shared or saved her birthday ticket'); save(blob); } else status.textContent = 'Could not make the picture here. Try opening the site from its web address.';
    });

    // ---- add to home screen
    let deferred = null;
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); deferred = event; });
    window.addEventListener('appinstalled', () => { installBtn.hidden = true; status.textContent = 'Added to your home screen ✦'; state.track?.('Added the site to her home screen'); });
    if (standalone) { installBtn.hidden = true; status.textContent = 'This is already on your home screen ✦'; }
    installBtn.addEventListener('click', async () => {
      if (deferred) { deferred.prompt(); await deferred.userChoice; deferred = null; return; }
      help.hidden = false;
      help.textContent = iOS
        ? 'On iPhone: open this page in Safari, tap the Share icon (the square with an arrow), then choose “Add to Home Screen”.'
        : 'On Android: open the browser menu (the three dots) and choose “Add to Home screen” or “Install app”.';
    });
  }

  function bindEnvelopes() {
    many('.envelope').forEach((envelope) => envelope.addEventListener('click', () => {
      envelope.setAttribute('aria-expanded', String(envelope.classList.toggle('is-open')));
    }));
  }

  function bindMemoryGame() {
    const grid = one('#memory-grid');
    const status = one('#memory-status');
    const again = one('#memory-again');
    if (!grid || !status || !again) return;
    const photos = ['d9', 'd3', 'd4', 'd10', 'd8', 'd2'];
    let first = null;
    let locked = false;
    let matched = 0;
    let moves = 0;
    const hide = (card) => { card.classList.remove('is-up'); card.setAttribute('aria-label', 'Hidden memory card'); };

    const build = () => {
      grid.replaceChildren();
      first = null; locked = false; matched = 0; moves = 0;
      status.textContent = 'Find all six pairs.';
      again.hidden = true;
      [...photos, ...photos].sort(() => Math.random() - 0.5).forEach((name) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'memory-card';
        card.dataset.name = name;
        card.setAttribute('aria-label', 'Hidden memory card');
        card.innerHTML = `<span class="memory-card__back" aria-hidden="true">✦</span><img src="${name}.jpeg" alt="" loading="lazy">`;
        grid.append(card);
      });
    };

    grid.addEventListener('click', (event) => {
      const card = event.target.closest('.memory-card');
      if (!card || locked || card.classList.contains('is-up')) return;
      card.classList.add('is-up');
      card.setAttribute('aria-label', 'Memory photo');
      if (!first) { first = card; return; }
      moves += 1;
      if (first.dataset.name === card.dataset.name) {
        first.classList.add('is-matched'); card.classList.add('is-matched');
        first = null; matched += 1;
        if (matched === photos.length) {
          status.textContent = `You found every memory in ${moves} moves!`;
          again.hidden = false;
          triggerCelebration({ count: 70, origin: 'center' });
        } else status.textContent = `${matched} of ${photos.length} pairs found`;
      } else {
        locked = true;
        const a = first; first = null;
        window.setTimeout(() => { hide(a); hide(card); locked = false; }, 900);
      }
    });
    again.addEventListener('click', build);
    build();
  }

  function bindSurpriseHunt() {
    const stars = many('.secret-star');
    const chip = one('#star-chip');
    const toast = one('#star-toast');
    const secret = one('#secret-chapter');
    if (!stars.length || !chip || !toast) return;
    const KEY = 'doris-birthday-stars-v1';
    const lines = [
      'Star 1 of 5 ✦ You are loved far more than you know.',
      'Star 2 of 5 ✦ Heri ya kuzaliwa! Mungu akubariki sana.',
      'Star 3 of 5 ✦ Fun fact: the world got a lot brighter in 2004.',
      'Star 4 of 5 ✦ Somewhere, someone is praying for you right now. It might be me.',
      'Star 5 of 5 ✦ You found them all! Your secret chapter is open.',
    ];
    const saved = safeRead(KEY, []);
    const found = new Set(Array.isArray(saved) ? saved : []);
    let timer = 0;
    const show = (text) => {
      toast.textContent = text; toast.hidden = false;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => { toast.hidden = true; }, 4500);
    };
    const render = () => {
      chip.textContent = found.size >= stars.length ? '✦ All stars found!' : `✦ ${found.size}/${stars.length} hidden stars`;
      stars.forEach((star) => star.classList.toggle('is-found', found.has(star.dataset.star)));
      if (found.size >= stars.length && secret) secret.hidden = false;
    };
    stars.forEach((star) => star.addEventListener('click', () => {
      const id = star.dataset.star;
      const isNew = !found.has(id);
      found.add(id);
      safeWrite(KEY, [...found]);
      render();
      show(lines[Number(id) - 1] || lines[0]);
      if (isNew) triggerCelebration({ count: 30, origin: 'center' });
      if (isNew && found.size >= stars.length && secret) {
        triggerCelebration({ count: 90, origin: 'center' });
        window.setTimeout(() => secret.scrollIntoView({ behavior: REDUCED_MOTION.matches ? 'auto' : 'smooth', block: 'center' }), 1800);
      }
    }));
    if (found.size === 0) {
      window.addEventListener('scroll', () => show('Psst… five tiny stars are hiding on this page ✦ Can you find them all?'), { once: true, passive: true });
    }
    render();
  }

  function bindCake() {
    const candles = many('.candle');
    const status = one('#cake-status');
    const wish = one('#cake-wish');
    const relight = one('#cake-relight');
    if (!candles.length || !status || !wish || !relight) return;

    const update = () => {
      const lit = candles.filter((candle) => candle.classList.contains('is-lit')).length;
      if (lit === 0) {
        status.textContent = 'All the candles are out. Your wish is on its way.';
        wish.hidden = false;
        relight.hidden = false;
        triggerCelebration({ count: 60, origin: 'center' });
      } else {
        status.textContent = `${lit} ${lit === 1 ? 'candle' : 'candles'} still glowing`;
      }
    };

    candles.forEach((candle) => candle.addEventListener('click', () => {
      if (!candle.classList.contains('is-lit')) return;
      candle.classList.remove('is-lit');
      candle.setAttribute('aria-pressed', 'true');
      update();
    }));

    relight.addEventListener('click', () => {
      candles.forEach((candle) => { candle.classList.add('is-lit'); candle.setAttribute('aria-pressed', 'false'); });
      wish.hidden = true;
      relight.hidden = true;
      update();
    });
  }

  function bindFlipCards() {
    many('.flip-card').forEach((card) => card.addEventListener('click', () => {
      card.setAttribute('aria-pressed', String(card.classList.toggle('is-flipped')));
    }));
  }

  function bindSparkleTrail() {
    if (REDUCED_MOTION.matches) return;
    const glyphs = ['✦', '✧', '✳', '♡'];
    let last = 0;
    const spawn = (x, y) => {
      const now = performance.now();
      if (now - last < 70) return;
      last = now;
      const spark = document.createElement('span');
      spark.className = 'sparkle-trail';
      spark.setAttribute('aria-hidden', 'true');
      spark.textContent = glyphs[Math.floor(Math.random() * glyphs.length)];
      spark.style.left = `${x}px`;
      spark.style.top = `${y}px`;
      document.body.append(spark);
      window.setTimeout(() => spark.remove(), 800);
    };
    window.addEventListener('pointermove', (event) => { if (event.pointerType === 'mouse') spawn(event.clientX, event.clientY); }, { passive: true });
    window.addEventListener('touchmove', (event) => { const touch = event.touches[0]; if (touch) spawn(touch.clientX, touch.clientY); }, { passive: true });
  }

  function bindGlobalActions() {
    bindChapterSoundtrack();
    bindWelcomeControls();
    bindNavigation();
    bindGalleryFilters();
    bindPhotoViewer();
    bindSlideshow();
    bindWishJar();
    bindLetterSpeech();
    bindVideoControls();
    bindSharing();
    bindReplyForm();
    bindCelebrationCanvas();
    bindReducedMotionChanges();
    bindGlobalKeyboardShortcuts();
    bindCake();
    bindEnvelopes();
    bindMemoryGame();
    bindSurpriseHunt();
    bindLifeNumbers();
    bindLanterns();
    bindWheel();
    bindFireflies();
    bindReveal();
    bindTilt();
    bindChimes();
    bindStudio();
    bindMirror();
    bindBoss();
    bindHouse();
    bindSurpriseFab();
    bindReporting();
    bindKeepIt();
    bindFlipCards();
    bindSparkleTrail();
  }

  function startExperience() {
    restoreWelcomeCoverIfNeeded();
    startBirthdayClock();
    personalizeBirthdayGreeting();
    setupScrollEffects();
    bindGlobalActions();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startExperience, { once: true });
  } else {
    startExperience();
  }
})();