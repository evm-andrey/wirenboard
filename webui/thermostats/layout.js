/* Responsive layout and keyboard activation of native SVG bindings. No MQTT. */
(function () {
  var watched = null;
  var resizeObserver = null;
  var queued = false;
  function layout() {
    queued = false;
    var svg = document.getElementById('wb-thermostat-dashboard');
    var active = window.location.hash.indexOf('/svg/view/dashboard4') !== -1 && !!svg;
    document.documentElement.classList.toggle('room-thermostat-dashboard', active);
    if (!active) { return; }
    if (watched !== svg) {
      if (resizeObserver) { resizeObserver.disconnect(); }
      watched = svg;
      resizeObserver = new ResizeObserver(schedule);
      resizeObserver.observe(svg.parentElement);
      svg.addEventListener('keydown', function (event) {
        if ((event.key === 'Enter' || event.key === ' ') && event.target.getAttribute('role') === 'button') {
          event.preventDefault();
          event.target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }
      });
    }
    var width = svg.parentElement.getBoundingClientRect().width;
    var cols = width < 720 ? 1 : width < 1120 ? 2 : 3;
    var viewWidth = cols * 356 + 12;
    var height = 138 + Math.ceil(5 / cols) * 430;
    var box = '0 0 ' + viewWidth + ' ' + height;
    if (svg.getAttribute('viewBox') !== box) { svg.setAttribute('viewBox', box); }
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', String(height));
    svg.style.width = '100%';
    svg.style.height = 'auto';
    svg.style.maxHeight = 'none';
    svg.style.display = 'block';
    var cards = svg.querySelectorAll('[data-thermostat-card]');
    for (var i = 0; i < cards.length; i++) {
      cards[i].setAttribute('transform', 'translate(' + (12 + (i % cols) * 356) + ',' + (138 + Math.floor(i / cols) * 430) + ')');
    }
    svg.querySelector('#thermostat-hero').setAttribute('width', String(viewWidth - 24));
  }
  function schedule() {
    if (queued) { return; }
    queued = true;
    requestAnimationFrame(layout);
  }
  function start() {
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('hashchange', schedule);
    layout();
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', start); }
  else { start(); }
})();
