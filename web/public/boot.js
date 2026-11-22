/* Runs before the page paints. Inside the mobile app only: start dark so there is no light flash before the launch screen. */
(function () {
  try {
    var w = window;
    if (w.androidBridge || (w.webkit && w.webkit.messageHandlers && w.webkit.messageHandlers.bridge)) {
      document.documentElement.classList.add('boot-dark', 'booting');
    }
  } catch (e) { /* not the app */ }
})();
