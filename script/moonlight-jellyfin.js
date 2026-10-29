// Moonlight for Jellyfin: behaviour CSS cannot do. Loaded by the JavaScript Injector plugin; plain ES2017 for the LG TV's Chromium 94.
(function () {
  'use strict';
  if (window.__moonlightTheme) return;
  window.__moonlightTheme = true;

  var root = document.documentElement;
  // The theme CSS switches its fallbacks off only when this class is present, so devices without the script keep the CSS-only behaviour.
  function markRoot() { if (!root.classList.contains('ml-js')) root.classList.add('ml-js'); }
  markRoot();
  new MutationObserver(markRoot).observe(root, { attributes: true, attributeFilter: ['class'] });

  function isTv() { return root.classList.contains('layout-tv'); }
  function isDesktop() { return root.classList.contains('layout-desktop'); }

  // 1. "More from Season", Cast & Crew and Guest Stars: a real toggle that stays open until it is closed.
  function setSeasonOpen(section, open) {
    section.classList.toggle('ml-open', open);
    var label = section.querySelector('.ml-season-toggle-label');
    var title = section.getAttribute('data-ml-title');
    if (label) label.textContent = title ? (open ? 'Hide ' : 'Show ') + title : (open ? 'Hide episodes' : 'Browse every episode');
    var btn = section.querySelector('.ml-season-toggle');
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function enhanceSeason(section, peopleTitle) {
    if (section.querySelector('.ml-season-toggle')) return;
    var scroller = section.querySelector('.emby-scroller');
    if (!scroller) return;
    section.classList.add('ml-collapsible', peopleTitle ? 'ml-people' : 'ml-season');
    if (peopleTitle) section.setAttribute('data-ml-title', peopleTitle);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ml-season-toggle';
    btn.innerHTML = '<span class="ml-season-toggle-label"></span><span class="material-icons ml-season-toggle-icon" aria-hidden="true">expand_more</span>';
    section.insertBefore(btn, scroller);
    setSeasonOpen(section, !peopleTitle);
    btn.addEventListener('click', function (e) {
      var open = !section.classList.contains('ml-open');
      setSeasonOpen(section, open);
      // Only the remote moves focus into the wall: on a mouse click the focus scroll slides the button out from under the pointer.
      if (open && isTv() && e.detail === 0) {
        var first = section.querySelector('.card');
        if (first) first.focus();
      }
    });
  }

  window.addEventListener('hashchange', function () {
    // Each page starts at the defaults: episodes open, people rows closed.
    var all = document.querySelectorAll('.ml-collapsible');
    for (var i = 0; i < all.length; i++) setSeasonOpen(all[i], all[i].classList.contains('ml-season'));
  });

  // 4. Menu close button: reachable with the arrow keys and the remote.
  function enhanceCloseButtons() {
    var btns = document.querySelectorAll('.btnCloseActionSheet[tabindex="-1"]');
    for (var i = 0; i < btns.length; i++) btns[i].setAttribute('tabindex', '0');
  }

  // The menu list is a vertical focus container, so Jellyfin never moves Up out of it; step to the close button by hand.
  window.addEventListener('keydown', function (e) {
    var up = e.key === 'ArrowUp' || e.keyCode === 38;
    var down = e.key === 'ArrowDown' || e.keyCode === 40;
    if (!up && !down) return;
    var el = document.activeElement;
    var sheet = el && el.closest && el.closest('.actionSheet');
    if (!sheet) return;
    var close = sheet.querySelector('.btnCloseActionSheet');
    var first = sheet.querySelector('.actionSheetMenuItem');
    if (!close || !first || !close.offsetWidth) return;
    var target = up && el === first ? close : down && el === close ? first : null;
    if (!target) return;
    e.preventDefault();
    e.stopPropagation();
    target.focus();
  }, true);

  var pending = false;
  new MutationObserver(function () {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      var sections = document.querySelectorAll('.moreFromSeasonSection');
      for (var i = 0; i < sections.length; i++) enhanceSeason(sections[i]);
      // People rows (Cast & Crew, Guest Stars) have no class of their own; their cards do.
      var people = document.querySelectorAll('.itemDetailPage .verticalSection');
      for (var j = 0; j < people.length; j++) {
        var title = people[j].querySelector('.sectionTitle');
        if (title && people[j].querySelector('.personCard')) enhanceSeason(people[j], title.textContent.trim());
      }
      enhanceCloseButtons();
      enhancePlayerMenu();
    });
  }).observe(document.body, { childList: true, subtree: true });

  // 2. Player: a small clock and the remaining time while the controls are hidden.
  var clock = null;

  function parseTime(text) {
    var parts = String(text || '').replace('-', '').trim().split(':').map(Number);
    if (!parts.length || parts.some(isNaN)) return null;
    return parts.reduce(function (sum, n) { return sum * 60 + n; }, 0);
  }

  function formatTime(seconds) {
    seconds = Math.max(0, Math.round(seconds));
    var h = Math.floor(seconds / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    var s = seconds % 60;
    var mm = h ? String(m).padStart(2, '0') : String(m);
    return (h ? h + ':' : '') + mm + ':' + String(s).padStart(2, '0');
  }

  function remainingText() {
    var dur = document.querySelector('#videoOsdPage .osdDurationText');
    var pos = document.querySelector('#videoOsdPage .osdPositionText');
    var durText = dur ? dur.textContent.trim() : '';
    if (durText.charAt(0) === '-') return durText;
    var total = parseTime(durText);
    var done = parseTime(pos ? pos.textContent : '');
    if (total !== null && done !== null) return '-' + formatTime(total - done);
    var video = document.querySelector('video');
    if (video && isFinite(video.duration)) return '-' + formatTime(video.duration - video.currentTime);
    return '';
  }

  function clockOn() { return localStorage.getItem('ml-clock') !== 'off'; }

  // The player gear menu gets a Clock row that flips in place; the menu stays open.
  function enhancePlayerMenu() {
    var repeat = document.querySelector('.actionSheet .actionSheetMenuItem[data-id="repeatmode"]');
    if (!repeat || repeat.parentNode.querySelector('[data-id="ml-clock"]')) return;
    var item = repeat.cloneNode(true);
    item.setAttribute('data-id', 'ml-clock');
    item.querySelector('.actionSheetItemText').textContent = 'Clock';
    var aside = item.querySelector('.actionSheetItemAsideText');
    aside.textContent = clockOn() ? 'On' : 'Off';
    // Stops Jellyfin's menu handler, which would close the menu with an id it does not know.
    item.addEventListener('click', function (e) {
      e.stopPropagation();
      e.preventDefault();
      localStorage.setItem('ml-clock', clockOn() ? 'off' : 'on');
      aside.textContent = clockOn() ? 'On' : 'Off';
      tickClock();
    });
    repeat.parentNode.insertBefore(item, repeat.nextSibling);
  }

  function tickClock() {
    var bottom = document.querySelector('#videoOsdPage:not(.hide) .videoOsdBottom');
    var show = clockOn() && !!bottom && (bottom.classList.contains('hide') || bottom.classList.contains('videoOsdBottom-hidden'));
    if (!clock) {
      clock = document.createElement('div');
      clock.className = 'ml-osd-clock';
      clock.innerHTML = '<span class="ml-osd-clock-now"></span><span class="ml-osd-clock-left"></span>';
      document.body.appendChild(clock);
    }
    if (show) {
      clock.firstChild.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      clock.lastChild.textContent = remainingText();
    }
    clock.classList.toggle('ml-show', show);
  }
  setInterval(tickClock, 1000);

  // 3. PC cards: hovering a wide episode or movie card scrubs its trickplay frames along the pointer.
  var trickCache = {};

  function trickInfo(id) {
    if (trickCache[id]) return trickCache[id];
    var api = window.ApiClient;
    if (!api) return Promise.resolve(null);
    trickCache[id] = api.getJSON(api.getUrl('Items', { Ids: id, Fields: 'Trickplay' })).then(function (res) {
      var item = res && res.Items && res.Items[0];
      var bySource = item && item.Trickplay;
      if (!bySource) return null;
      var source = Object.keys(bySource)[0];
      if (!source) return null;
      var widths = Object.keys(bySource[source]).map(Number).sort(function (a, b) { return a - b; });
      return { source: source, width: widths[0], info: bySource[source][widths[0]] };
    }).catch(function () { return null; });
    return trickCache[id];
  }

  var hover = null;

  function endHover() {
    if (!hover) return;
    clearTimeout(hover.timer);
    hover.card.removeEventListener('mousemove', onMove);
    hover.card.removeEventListener('mouseleave', endHover);
    var layer = hover.card.querySelector('.ml-trick');
    if (layer) layer.remove();
    hover = null;
  }

  function onMove(e) {
    if (!hover) return;
    var box = hover.card.querySelector('.cardScalable');
    if (!box) return;
    var r = box.getBoundingClientRect();
    hover.frac = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    if (hover.trick) draw();
  }

  function draw() {
    var t = hover.trick;
    var info = t.info;
    var count = info.ThumbnailCount;
    var perTile = info.TileWidth * info.TileHeight;
    var index = Math.min(count - 1, Math.floor(hover.frac * count));
    var tile = Math.floor(index / perTile);
    var k = index % perTile;
    // Every sheet is the full grid, the last one padded with black, so the grid size never changes.
    var cols = info.TileWidth;
    var rows = info.TileHeight;
    var col = k % info.TileWidth;
    var row = Math.floor(k / info.TileWidth);
    var host = hover.card.querySelector('.cardImageContainer');
    if (!host) return;
    var layer = host.querySelector('.ml-trick');
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'ml-trick';
      layer.innerHTML = '<div class="ml-trick-bar"></div>';
      host.appendChild(layer);
    }
    var api = window.ApiClient;
    var url = api.getUrl('Videos/' + hover.card.dataset.id + '/Trickplay/' + t.width + '/' + tile + '.jpg', { MediaSourceId: t.source, api_key: api.accessToken() });
    layer.style.backgroundImage = 'url("' + url + '")';
    layer.style.backgroundSize = (cols * 100) + '% ' + (rows * 100) + '%';
    layer.style.backgroundPosition = (cols > 1 ? col / (cols - 1) * 100 : 0) + '% ' + (rows > 1 ? row / (rows - 1) * 100 : 0) + '%';
    layer.firstChild.style.width = (hover.frac * 100) + '%';
  }

  document.addEventListener('mouseover', function (e) {
    if (!isDesktop() || !e.target.closest) return;
    var card = e.target.closest('.card[data-id]');
    if (hover && card === hover.card) return;
    endHover();
    if (!card || !/^(Episode|Movie|Video)$/.test(card.dataset.type || '') || !/Backdrop|Thumb/i.test(card.className)) return;
    hover = { card: card, frac: 0.5, trick: null };
    card.addEventListener('mousemove', onMove);
    card.addEventListener('mouseleave', endHover);
    // Only a resting pointer loads frames, so sweeping across a row does not fetch every card.
    hover.timer = setTimeout(function () {
      var mine = hover;
      trickInfo(card.dataset.id).then(function (t) {
        if (!t || hover !== mine) return;
        mine.trick = t;
        draw();
      });
    }, 250);
  });
})();
