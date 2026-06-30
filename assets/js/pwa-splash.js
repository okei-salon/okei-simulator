/* OUKEI HUB PWA Splash — Ver1.7.7 */
(function () {
  var html = document.documentElement;
  if (!html.classList.contains('pwa-splash-active')) return;

  var splash = document.getElementById('pwaSplash');
  if (!splash) {
    html.classList.remove('pwa-splash-active');
    return;
  }

  splash.removeAttribute('hidden');
  splash.setAttribute('aria-hidden', 'false');

  var SHOW_MS = 2000;
  var FADE_MS = 280;
  var dismissed = false;

  function dismiss(immediate) {
    if (dismissed) return;
    dismissed = true;

    try {
      sessionStorage.setItem('oukei_pwa_splash_done', '1');
    } catch (e) {}

    if (immediate) {
      html.classList.remove('pwa-splash-active');
      splash.remove();
      return;
    }

    splash.classList.add('isLeaving');
    window.setTimeout(function () {
      html.classList.remove('pwa-splash-active');
      splash.remove();
    }, FADE_MS);
  }

  window.addEventListener('pageshow', function (e) {
    if (e.persisted) dismiss(true);
  });

  requestAnimationFrame(function () {
    window.setTimeout(function () {
      dismiss(false);
    }, SHOW_MS);
  });
})();
