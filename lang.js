/* =========================================================================
   Language routing.

   English is served from the root; every other language lives under /<code>/.
   A first-time visitor whose browser asks for a language we speak is sent to
   that version once; after that, whatever they last picked in the switcher
   wins — an explicit choice is never overridden by detection.

   Loaded in <head> so the swap happens before the page paints.
   ========================================================================= */
(function () {
  'use strict';

  var SUPPORTED = ['en', 'tr', 'de', 'es', 'fr', 'it', 'pt', 'ru', 'ar', 'hi', 'zh', 'ja'];
  var KEY = 'pl_lang';
  var AUTO_KEY = 'pl_lang_auto'; // one auto-redirect per tab, so we can't loop

  function store(k, v, session) {
    try { (session ? sessionStorage : localStorage).setItem(k, v); } catch (e) { /* private mode */ }
  }
  function read(k, session) {
    try { return (session ? sessionStorage : localStorage).getItem(k); } catch (e) { return null; }
  }

  // '/tr/privacy.html' -> { lang: 'tr', page: 'privacy.html' }
  function parsePath(p) {
    var m = p.match(/^\/([a-z]{2})(?:\/(.*))?$/);
    if (m && SUPPORTED.indexOf(m[1]) > -1 && m[1] !== 'en') {
      return { lang: m[1], page: m[2] || '' };
    }
    return { lang: 'en', page: p.replace(/^\//, '') };
  }

  function urlFor(lang, page) {
    return (lang === 'en' ? '/' : '/' + lang + '/') + (page || '');
  }

  // First browser language we actually speak. 'pt-BR' matches 'pt'.
  function detect() {
    var list = navigator.languages || [navigator.language || ''];
    for (var i = 0; i < list.length; i++) {
      var code = String(list[i]).toLowerCase().split('-')[0];
      if (SUPPORTED.indexOf(code) > -1) return code;
    }
    return null;
  }

  var current = parsePath(location.pathname);
  var param = (location.search.match(/[?&]lang=([a-z]{2})\b/) || [])[1];

  if (param && SUPPORTED.indexOf(param) > -1) {
    // ?lang=xx is an explicit choice: remember it, then land on the clean URL.
    store(KEY, param);
    location.replace(urlFor(param, current.page) + location.hash);
    return;
  }

  var chosen = read(KEY);
  if (chosen && SUPPORTED.indexOf(chosen) > -1) {
    if (chosen !== current.lang) {
      location.replace(urlFor(chosen, current.page) + location.hash);
    }
  } else if (!read(AUTO_KEY, true)) {
    store(AUTO_KEY, '1', true);
    var guess = detect();
    if (guess && guess !== current.lang) {
      location.replace(urlFor(guess, current.page) + location.hash);
    }
  }

  /* ---- switcher --------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    var select = document.getElementById('langSelect');
    if (!select) return;
    select.addEventListener('change', function () {
      var opt = select.options[select.selectedIndex];
      if (!opt) return;
      store(KEY, opt.value);
      location.href = opt.getAttribute('data-href');
    });
  });
})();
