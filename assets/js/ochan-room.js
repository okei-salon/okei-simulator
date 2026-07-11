/* OUKEI HUB Ochan Room — main video lifecycle */

(function () {
  function initOchanRoomMainVideo() {
    var page = document.getElementById('ochanRoomPage');
    var stage = document.getElementById('ochanRoomStage');
    var video = document.getElementById('ochanRoomMainVideo');
    if (!page || !video) return;

    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    var initialized = false;

    function isRoomVisible() {
      return !page.classList.contains('hidden');
    }

    function shouldPlay() {
      return isRoomVisible() && !document.hidden && !reducedMotion.matches && !video.classList.contains('isUnavailable');
    }

    function syncPlayback() {
      if (!shouldPlay()) {
        if (!video.paused) video.pause();
        return;
      }
      var playPromise = video.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(function () {});
      }
    }

    function markUnavailable() {
      video.classList.add('isUnavailable');
      if (stage) stage.classList.add('isVideoUnavailable');
      video.pause();
    }

    if (!initialized) {
      initialized = true;
      video.addEventListener('error', markUnavailable);
      reducedMotion.addEventListener('change', syncPlayback);
      document.addEventListener('visibilitychange', syncPlayback);
      new MutationObserver(syncPlayback).observe(page, {
        attributes: true,
        attributeFilter: ['class']
      });
    }

    syncPlayback();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOchanRoomMainVideo);
  } else {
    initOchanRoomMainVideo();
  }
})();
