/* Presentation only: never reads MQTT or publishes device commands. */
(function () {
  var observer = null;
  var queued = false;
  function decorate() {
    queued = false;
    var active = window.location.hash.indexOf('dashboard_lighting') !== -1;
    var heading = document.querySelector('.page-title');
    if (!active && (!window.location.hash || window.location.hash === '#!/' || window.location.hash === '#!/home')) {
      active = !!document.getElementById('widget_light_overview') || (!!heading && heading.textContent.indexOf('Свет по комнатам') !== -1);
    }
    document.documentElement.classList.toggle('room-light-dashboard', active);
    if (!active) { return; }
    var cards = document.querySelectorAll('article[id^="widget_light_"]');
    for (var i = 0; i < cards.length; i++) {
      var state = cards[i].querySelector('.deviceCell-text');
      var text = state ? state.textContent : '';
      var status = text.indexOf('нет данных') !== -1 ? 'unknown' : text.indexOf('Включено') === 0 ? 'on' : 'off';
      cards[i].setAttribute('data-light-status', status);
    }
  }
  function schedule() {
    if (queued) { return; }
    queued = true;
    window.requestAnimationFrame(decorate);
  }
  function start() {
    observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener('hashchange', schedule);
    decorate();
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', start); }
  else { start(); }
})();
