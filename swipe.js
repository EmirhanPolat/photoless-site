/* =========================================================================
   PhotoLess site — light, dependency-free interactions.
   The centrepiece is the hero swipe deck: a real drag gesture that mirrors the
   app (right = Keep, left = Review to Delete) without ever showing a real photo.
   Everything degrades gracefully if JS is off or motion is reduced.
   ========================================================================= */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- year in footer --------------------------------------------------- */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---- header shadow on scroll ----------------------------------------- */
  var header = document.getElementById('header');
  if (header) {
    var onScroll = function () {
      header.classList.toggle('scrolled', window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---- mobile nav ------------------------------------------------------- */
  var toggle = document.getElementById('navToggle');
  var links = document.getElementById('navLinks');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    links.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        links.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ---- reveal on scroll ------------------------------------------------- */
  var reveals = document.querySelectorAll('.reveal');
  if (reveals.length && 'IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.14 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }

  /* =======================================================================
     Hero swipe deck
     ======================================================================= */
  var stage = document.getElementById('swipeStage');
  if (!stage) return;

  var APP_STORE_URL = 'https://apps.apple.com/search?term=PhotoLess';
  var SWIPES_BEFORE_DOWNLOAD_CARD = 3;

  // The PhotoLess character on each card — playful, branded, never an empty
  // tile. The gradient sits behind the art for warmth and caption legibility.
  var MEMORIES = [
    { img: 'assets/PhotoLess_cute.webp', g: 'linear-gradient(160deg,#f3ead2,#dceaf4)', t: 'Keep this one', s: 'The memories that matter' },
    { img: 'assets/PhotoLess_happy.webp', g: 'linear-gradient(160deg,#e1ede2,#f3e3e8)', t: 'Take another look', s: 'You can always undo' },
    { img: 'assets/PhotoLess_one_eye.webp', g: 'linear-gradient(160deg,#dceaf4,#ede8d0)', t: 'Clear the clutter', s: 'Set the extras aside' },
    { img: 'assets/PhotoLess_happy.webp', g: 'linear-gradient(160deg,#ede8d0,#e1ede2)', t: 'Nothing is gone yet', s: 'Review before you delete' }
  ];

  var hint = document.getElementById('swipeHint');
  var actDel = document.getElementById('actDel');
  var actKeep = document.getElementById('actKeep');
  var demoPhone = stage.closest('.demo-phone');

  var deck = [];      // live card DOM nodes, top of deck last
  var pointer = null; // active drag state
  var swipeCount = 0;
  var downloadShown = false;

  function buildCard(mem) {
    var card = document.createElement('div');
    card.className = 'card';
    card.setAttribute('role', 'group');
    card.setAttribute('aria-label', mem.t + '. Drag right to keep, or left to review before deleting.');

    var photo = document.createElement('div');
    photo.className = 'photo';
    photo.style.background = mem.g;
    var html = '';
    if (mem.img) {
      html += '<img class="shot" src="' + mem.img + '" alt="" draggable="false" />';
    } else {
      html += '<span class="card-brand brand-wordmark"><span class="brand-photo">Photo</span><span class="brand-less">Less</span></span>';
    }
    html += '<span class="caption">' + mem.t + '<small>' + mem.s + '</small></span>';
    photo.innerHTML = html;

    var keep = document.createElement('div');
    keep.className = 'stamp keep';
    keep.textContent = 'Keep';
    var del = document.createElement('div');
    del.className = 'stamp del';
    del.textContent = 'Review';

    var meta = document.createElement('div');
    meta.className = 'meta';
    meta.innerHTML = '<span>Swipe to review</span><span>Confirm first</span>';

    photo.appendChild(keep);
    photo.appendChild(del);
    card.appendChild(photo);
    card.appendChild(meta);
    card._keep = keep;
    card._del = del;
    return card;
  }

  // (Re)build a full deck. Cards are stacked with a slight scale/offset.
  function render() {
    deck.forEach(function (c) { c.remove(); });
    deck = [];
    var actions = stage.querySelector('.swipe-actions');
    MEMORIES.slice().reverse().forEach(function (mem) {
      var card = buildCard(mem);
      stage.insertBefore(card, actions);
      deck.push(card);
    });
    layout();
    attachTop();
  }

  // Visually stack the deck: top card flat, the ones behind scaled + nudged.
  function layout() {
    var n = deck.length;
    deck.forEach(function (card, i) {
      var depth = n - 1 - i; // 0 = top
      if (depth > 0) { card.style.display = 'none'; return; }
      card.style.display = '';
      card.style.zIndex = String(i);
      if (!card.classList.contains('dragging')) {
        card.style.transform = 'none';
      }
      card.style.opacity = '1';
    });
  }

  function topCard() { return deck[deck.length - 1] || null; }

  function attachTop() {
    var card = topCard();
    if (!card) return;
    card.addEventListener('pointerdown', onDown);
  }

  function onDown(e) {
    var card = topCard();
    if (!card || card !== e.currentTarget) return;
    card.setPointerCapture(e.pointerId);
    card.classList.add('dragging');
    pointer = { id: e.pointerId, x0: e.clientX, y0: e.clientY, card: card };
    if (hint) hint.style.opacity = '0';
    card.addEventListener('pointermove', onMove);
    card.addEventListener('pointerup', onUp);
    card.addEventListener('pointercancel', onUp);
  }

  function onMove(e) {
    if (!pointer || e.pointerId !== pointer.id) return;
    var dx = e.clientX - pointer.x0;
    var dy = e.clientY - pointer.y0;
    var rot = dx / 18;
    pointer.dx = dx;
    pointer.card.style.transform =
      'translate(' + dx + 'px,' + dy + 'px) rotate(' + rot + 'deg)';
    var t = Math.min(Math.abs(dx) / 120, 1);
    pointer.card._keep.style.opacity = dx > 0 ? String(t) : '0';
    pointer.card._del.style.opacity = dx < 0 ? String(t) : '0';
  }

  function onUp(e) {
    if (!pointer || e.pointerId !== pointer.id) return;
    var card = pointer.card;
    var dx = pointer.dx || 0;
    card.classList.remove('dragging');
    card.removeEventListener('pointermove', onMove);
    card.removeEventListener('pointerup', onUp);
    card.removeEventListener('pointercancel', onUp);
    if (Math.abs(dx) > 60) {
      fling(card, dx > 0 ? 1 : -1);
    } else {
      // snap back
      card._keep.style.opacity = '0';
      card._del.style.opacity = '0';
      layout();
    }
    pointer = null;
  }

  // Send the top card off-screen. After a few swipes, trade the demo for a
  // download card so the interaction has a clear next step.
  function fling(card, dir) {
    if (downloadShown) return;
    card.classList.add('gone');
    card._keep.style.opacity = dir > 0 ? '1' : '0';
    card._del.style.opacity = dir < 0 ? '1' : '0';
    // Force a reflow so the .gone transition commits with the current (drag)
    // transform as its start value. Without this, mobile Safari coalesces the
    // class add + new transform into one frame and skips the slide-off entirely
    // (the card just vanishes). Desktop browsers batch more leniently.
    void card.offsetWidth;
    var off = (window.innerWidth || 800) * 0.9 * dir;
    card.style.transform = 'translate(' + off + 'px,40px) rotate(' + (dir * 18) + 'deg)';
    window.setTimeout(function () {
      swipeCount += 1;
      if (swipeCount >= SWIPES_BEFORE_DOWNLOAD_CARD) {
        showDownloadCard();
        return;
      }

      card.classList.remove('gone');
      card._keep.style.opacity = '0';
      card._del.style.opacity = '0';
      // move to bottom of stack
      deck.splice(deck.indexOf(card), 1);
      deck.unshift(card);
      var actions = stage.querySelector('.swipe-actions');
      stage.insertBefore(card, actions);
      card.style.transform = 'translateY(18px) scale(0.85)';
      // force reflow so the new resting transform animates in
      void card.offsetWidth;
      layout();
      attachTop();
      // Always allow the slide-off to play (the CSS keeps .card transitions
      // alive even under reduced-motion), so recycle on the same timeline on
      // both — otherwise the card teleports and the next one just appears.
    }, 360);
  }

  function showDownloadCard() {
    downloadShown = true;
    deck.forEach(function (c) { c.remove(); });
    deck = [];
    if (demoPhone) demoPhone.classList.add('download-ready');
    if (hint) hint.textContent = 'Ready for a calmer photo library';

    var actions = stage.querySelector('.swipe-actions');
    var card = document.createElement('a');
    card.className = 'download-card';
    card.href = APP_STORE_URL;
    card.target = '_blank';
    card.rel = 'noopener';
    card.setAttribute('aria-label', 'Open PhotoLess on the App Store');
    card.innerHTML =
      '<span class="download-kicker">Try PhotoLess</span>' +
      '<span class="download-logo" aria-label="PhotoLess">' +
        '<img class="download-mark" src="assets/icon.png" alt="" draggable="false" />' +
        '<span class="brand-wordmark"><span class="brand-photo">Photo</span><span class="brand-less">Less</span></span>' +
      '</span>' +
      '<span class="download-title">Keep what matters.</span>' +
      '<span class="download-copy">Review safely, locally, and confirm before anything is deleted.</span>' +
      '<span class="download-button">View on the App Store</span>';

    stage.insertBefore(card, actions);
  }

  // Button-driven swipe (accessibility + people who don't drag).
  function tap(dir) {
    var card = topCard();
    if (card && !card.classList.contains('gone')) {
      if (hint) hint.style.opacity = '0';
      fling(card, dir);
    }
  }
  if (actKeep) actKeep.addEventListener('click', function () { tap(1); });
  if (actDel) actDel.addEventListener('click', function () { tap(-1); });

  render();
})();
