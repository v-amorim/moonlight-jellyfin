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
      enhanceItemMenu();
      enhanceSeriesCards();
      enhanceSeasonCards();
      enhanceSeasonPage();
      enhanceDetailBanner();
      enhancePosterMenu();
      enhanceDetailRows();
      enhanceLibrarySwitcher();
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

  // 6. Item menus get "Reset progress" when the episode or movie was started but not finished.
  var menuItemId = null;
  var menuFromPage = false;

  // The menu does not say which item opened it, so remember the card or detail page behind the last menu press.
  function rememberMenuItem(e) {
    var btn = e.target.closest && e.target.closest('.btnMoreCommands, [data-action="menu"], .card[data-id]');
    if (!btn) return;
    var card = btn.closest('.card[data-id]');
    var page = /[?&]id=([0-9a-f]+)/i.exec(location.hash);
    menuItemId = card ? card.dataset.id : page ? page[1] : null;
    menuFromPage = !card && !!btn.closest('.itemDetailPage');
  }
  document.addEventListener('click', rememberMenuItem, true);
  document.addEventListener('contextmenu', rememberMenuItem, true);
  document.addEventListener('keydown', function (e) {
    if (e.target.closest && e.target.closest('.card[data-id]')) menuItemId = e.target.closest('.card[data-id]').dataset.id;
  }, true);

  function enhanceItemMenu() {
    var anchor = document.querySelector('.actionSheet .actionSheetMenuItem[data-id="copy-stream"], .actionSheet .actionSheetMenuItem[data-id="delete"]');
    if (!anchor || !menuItemId || anchor.parentNode.querySelector('[data-id="ml-reset"]')) return;
    var id = menuItemId;
    var api = window.ApiClient;
    var item = anchor.cloneNode(true);
    item.setAttribute('data-id', 'ml-reset');
    item.classList.add('hide');
    var icon = item.querySelector('.actionsheetMenuItemIcon');
    if (icon) icon.className = 'actionsheetMenuItemIcon listItemIcon listItemIcon-transparent material-icons replay';
    item.querySelector('.actionSheetItemText').textContent = 'Reset progress';
    var copy = anchor.parentNode.querySelector('[data-id="copy-stream"]');
    anchor.parentNode.insertBefore(item, copy ? copy.nextSibling : anchor);
    api.getJSON(api.getUrl('UserItems/' + id + '/UserData', { userId: api.getCurrentUserId() })).then(function (data) {
      // A started episode keeps its series in Next Up through its last-played date, even at position 0.
      if (data && !data.Played && (data.PlaybackPositionTicks > 0 || data.LastPlayedDate)) item.classList.remove('hide');
    }).catch(function () {});
    // Jellyfin's own menu handler would close the menu with an id it does not know, so this row handles itself.
    item.addEventListener('click', function (e) {
      e.stopPropagation();
      e.preventDefault();
      // Mark unplayed clears the position, play count and last-played date, so the series also leaves Next Up.
      api.ajax({
        type: 'DELETE',
        url: api.getUrl('UserPlayedItems/' + id, { userId: api.getCurrentUserId() })
      }).then(function () {
        var close = document.querySelector('.actionSheet .btnCloseActionSheet');
        if (close) close.click(); else history.back();
      });
    });
  }

  // 7. Series and movie cards: a row of small chips under the picture (years, seasons or runtime, community star, critic tomato); home rows keep only the scores.
  var TOMATO = '<svg class="ml-tomato" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="9.5" r="5.5" fill="#E2725B"/><path d="M8 4.2 6 2.6l1.3 2.2-2.4.2 2.2.9L8 7.5l.9-1.6 2.2-.9-2.4-.2L10 2.6z" fill="#7FC98B"/></svg>';
  var STAR = '<span class="material-icons star" aria-hidden="true"></span>';
  var seriesInfo = {};

  function chip(cls, html) {
    var el = document.createElement('span');
    el.className = 'ml-chip ' + cls;
    el.innerHTML = html;
    return el;
  }

  function runtime(ticks) {
    var min = Math.round(ticks / 6e8);
    return (min >= 60 ? Math.floor(min / 60) + 'h ' : '') + (min % 60) + 'm';
  }

  function episodeChips(row, info) {
    if (info.CommunityRating != null) row.appendChild(chip('ml-chip-com', STAR + info.CommunityRating.toFixed(1)));
    if (info.RunTimeTicks) row.appendChild(chip('ml-chip-seasons', '')).textContent = runtime(info.RunTimeTicks);
    if (info.PremiereDate) row.appendChild(chip('ml-chip-seasons', '')).textContent = new Date(info.PremiereDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // Episodes keep their title alone on the line; the code, score, runtime and air date move into chips under it.
  function decorateEpisodeCard(card, info) {
    var texts = card.querySelectorAll('.cardText');
    var line = texts[texts.length - 1];
    if (!line || card.querySelector('.ml-info')) return;
    var row = document.createElement('div');
    row.className = 'ml-info';
    var code = /^\s*(S\d+:E\d+(?:-E?\d+)?)\s*-\s*/.exec(line.textContent);
    if (code) {
      row.appendChild(chip('ml-chip-code', '')).textContent = code[1];
      var link = line.querySelector('a, button') || line;
      link.textContent = link.textContent.replace(code[0], '');
    }
    episodeChips(row, info);
    if (!row.children.length) return;
    line.parentNode.insertBefore(row, line.nextSibling);
    // Card texts are placed with flex order, so the row takes the order right after its line.
    row.style.order = String((parseInt(getComputedStyle(line).order, 10) || 0) + 1);
  }

  // Season page episode tiles: the title loses its "1." prefix, the chips follow it, and Jellyfin's own runtime line goes.
  function decorateEpisodeRow(item, info) {
    var texts = item.querySelectorAll('.listItemBodyText');
    var title = texts[0];
    if (!title || item.querySelector('.ml-info')) return;
    title.textContent = title.textContent.replace(/^\s*\d+\.\s*/, '');
    for (var i = 1; i < texts.length; i++) if (!texts[i].classList.contains('listItem-overview')) texts[i].style.display = 'none';
    var row = document.createElement('div');
    row.className = 'ml-info';
    if (info.IndexNumber != null) row.appendChild(chip('ml-chip-code', '')).textContent = 'S' + info.ParentIndexNumber + ':E' + info.IndexNumber;
    episodeChips(row, info);
    title.parentNode.insertBefore(row, title.nextSibling);
    // Only More stays on the tile, at the title's right end; watched and favourite are in its menu.
    var actions = item.querySelector('.listViewUserDataButtons');
    if (actions) {
      actions.classList.add('ml-tile-actions');
      title.parentNode.insertBefore(actions, title.nextSibling);
    }
  }

  function decorateSeriesCard(card, info) {
    if (card.classList.contains('listItem')) return decorateEpisodeRow(card, info);
    if (info.Type === 'Episode') return decorateEpisodeCard(card, info);
    var pic = card.querySelector('.cardScalable');
    if (!pic || card.querySelector('.ml-info')) return;
    var row = document.createElement('div');
    row.className = 'ml-info';
    var line = card.querySelector('.cardText-secondary');
    if (!card.closest('.homeSectionsContainer')) {
      var years = line ? line.textContent.trim() : '';
      // Phones draw no years line, so the years come from the item itself.
      if (!years && info.ProductionYear) {
        var end = info.EndDate ? new Date(info.EndDate).getFullYear() : null;
        years = String(info.ProductionYear) + (info.Type === 'Series' ? (info.Status === 'Continuing' ? ' - Present' : end && end !== info.ProductionYear ? ' - ' + end : '') : '');
      }
      if (years) row.appendChild(chip('ml-chip-years', '')).textContent = years;
      if (info.Type === 'Series' && info.ChildCount) row.appendChild(chip('ml-chip-seasons', '')).textContent = info.ChildCount + (info.ChildCount === 1 ? ' season' : ' seasons');
      if (info.Type === 'Movie' && info.RunTimeTicks) row.appendChild(chip('ml-chip-seasons', '')).textContent = runtime(info.RunTimeTicks);
    }
    if (info.CommunityRating != null) row.appendChild(chip('ml-chip-com', STAR + info.CommunityRating.toFixed(1)));
    if (info.CriticRating != null) row.appendChild(chip('ml-chip-crit', TOMATO + Math.round(info.CriticRating) + '%'));
    if (!row.children.length) return;
    pic.parentNode.insertBefore(row, pic.nextSibling);
    card.classList.add('ml-info-on');
  }

  // Cards arrive in batches as rows load, so their scores are fetched in one request per batch and cached by id.
  function enhanceSeriesCards() {
    var api = window.ApiClient;
    if (!api) return;
    var cards = document.querySelectorAll('.card[data-type="Series"][data-id]:not([data-ml-series]), .card[data-type="Movie"][data-id]:not([data-ml-series]), .card[data-type="Episode"][data-id]:not([data-ml-series]), .itemDetailPage #childrenContent .listItem[data-type="Episode"][data-id]:not([data-ml-series])');
    if (!cards.length) return;
    var missing = [];
    for (var i = 0; i < cards.length; i++) {
      cards[i].setAttribute('data-ml-series', '1');
      var id = cards[i].dataset.id;
      if (seriesInfo[id]) decorateSeriesCard(cards[i], seriesInfo[id]);
      else if (missing.indexOf(id) < 0) missing.push(id);
    }
    if (!missing.length) return;
    var pending = Array.prototype.slice.call(cards);
    api.getJSON(api.getUrl('Items', { userId: api.getCurrentUserId(), Ids: missing.join(','), Fields: 'CriticRating,CommunityRating,ChildCount,RunTimeTicks,PremiereDate,ProductionYear,EndDate,Status' })).then(function (res) {
      (res.Items || []).forEach(function (item) { seriesInfo[item.Id] = item; });
      pending.forEach(function (card) { if (seriesInfo[card.dataset.id]) decorateSeriesCard(card, seriesInfo[card.dataset.id]); });
    }).catch(function () {});
  }

  // 9. Series page season cards: episode count, air years, and the mean of the episode scores marked avg, since seasons carry no score of their own.
  var seasonStats = {};

  function decorateSeasonCard(card, s) {
    var pic = card.querySelector('.cardScalable');
    if (!pic || !s || card.querySelector('.ml-info')) return;
    var row = document.createElement('div');
    row.className = 'ml-info';
    row.appendChild(chip('ml-chip-seasons', '')).textContent = s.n + (s.n === 1 ? ' episode' : ' episodes');
    if (s.y0) row.appendChild(chip('ml-chip-years', '')).textContent = s.y1 !== s.y0 ? s.y0 + ' - ' + s.y1 : String(s.y0);
    if (s.rated) row.appendChild(chip('ml-chip-com', STAR + (s.sum / s.rated).toFixed(1) + ' <span class="ml-avg">avg</span>'));
    pic.parentNode.insertBefore(row, pic.nextSibling);
  }

  // One request per series fetches every episode, grouped here by season.
  function enhanceSeasonCards() {
    var api = window.ApiClient;
    var cards = document.querySelectorAll('.itemDetailPage:not(.hide) .card[data-type="Season"][data-id]:not([data-ml-season])');
    var id = /[?&]id=([0-9a-f]+)/i.exec(location.hash);
    if (!api || !cards.length || !id) return;
    var seriesId = id[1];
    cards.forEach(function (card) { card.setAttribute('data-ml-season', '1'); });
    var decorate = function () { cards.forEach(function (card) { decorateSeasonCard(card, seasonStats[seriesId][card.dataset.id]); }); };
    if (seasonStats[seriesId]) return decorate();
    api.getJSON(api.getUrl('Items', { userId: api.getCurrentUserId(), ParentId: seriesId, Recursive: true, IncludeItemTypes: 'Episode', Fields: 'CommunityRating,PremiereDate' })).then(function (res) {
      var stats = {};
      (res.Items || []).forEach(function (ep) {
        var s = stats[ep.SeasonId] || (stats[ep.SeasonId] = { n: 0, sum: 0, rated: 0, y0: 0, y1: 0 });
        s.n++;
        if (ep.CommunityRating != null) { s.sum += ep.CommunityRating; s.rated++; }
        if (ep.PremiereDate) {
          var y = new Date(ep.PremiereDate).getFullYear();
          if (!s.y0 || y < s.y0) s.y0 = y;
          if (y > s.y1) s.y1 = y;
        }
      });
      seasonStats[seriesId] = stats;
      decorate();
    }).catch(function () {});
  }

  // 10. Season page: episode tiles in a grid, and the poster beside the header, level with the series name, fading once the page scrolls.
  var posterWatch = null;

  function alignSeasonPoster(page) {
    // Phones draw the poster in a second container; the first one is hidden there.
    var card = [].slice.call(page.querySelectorAll('.detailImageContainer .card')).filter(function (c) { return c.offsetWidth; })[0];
    var name = page.querySelector('.nameContainer');
    if (!card || !name) return;
    card.style.setProperty('top', '0px', 'important');
    var base = card.getBoundingClientRect().top;
    card.style.setProperty('top', (name.getBoundingClientRect().top - base) + 'px', 'important');
    // The header can be shorter than the poster, so the synopsis block grows until the episode grid starts below it.
    var text = page.querySelector('.detailSection > .detailSectionContent');
    if (!text) return;
    text.style.minHeight = '';
    var gap = card.getBoundingClientRect().bottom + 16 - text.getBoundingClientRect().top;
    if (gap > text.offsetHeight) text.style.minHeight = gap + 'px';
  }

  function enhanceSeasonPage() {
    var page = document.querySelector('.itemDetailPage:not(.hide)');
    if (!page) return;
    var on = !!page.querySelector('#childrenContent .listItem[data-type="Episode"]');
    if (page.classList.contains('ml-season-page') === on) return;
    page.classList.toggle('ml-season-page', on);
    if (posterWatch) posterWatch.disconnect();
    if (!on) return;
    alignSeasonPoster(page);
    // The header's height changes with the logo and the window, so the poster is lined up again whenever it does.
    var header = page.querySelector('.detailPagePrimaryContainer');
    if (header && window.ResizeObserver) {
      posterWatch = new ResizeObserver(function () { alignSeasonPoster(page); });
      posterWatch.observe(header);
    }
  }

  document.addEventListener('scroll', function (e) {
    var page = document.querySelector('.itemDetailPage.ml-season-page:not(.hide)');
    if (page) page.classList.toggle('ml-scrolled', (window.pageYOffset || (e.target && e.target.scrollTop) || 0) > 120);
  }, { capture: true, passive: true });

  // 11. Detail pages other than a season: the poster becomes a faded banner behind the header, and the page's More menu opens it full screen.
  function enhanceDetailBanner() {
    var page = document.querySelector('.itemDetailPage:not(.hide)');
    var id = /[?&]id=([0-9a-f]+)/i.exec(location.hash);
    if (!page) return;
    var banner = page.querySelector('.ml-banner');
    var on = !!id && !page.classList.contains('ml-season-page');
    page.classList.toggle('ml-banner-on', on);
    if (!on) { if (banner) banner.remove(); return; }
    if (banner && banner.getAttribute('data-id') === id[1]) return;
    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'ml-banner';
      page.insertBefore(banner, page.firstChild);
    }
    banner.setAttribute('data-id', id[1]);
    banner.style.backgroundImage = 'url("' + window.ApiClient.getUrl('Items/' + id[1] + '/Images/Primary', { maxWidth: 1920, quality: 90 }) + '")';
  }

  function showPoster(id) {
    var view = document.createElement('div');
    view.className = 'ml-poster-view';
    view.tabIndex = -1;
    var img = document.createElement('img');
    img.alt = '';
    img.src = window.ApiClient.getUrl('Items/' + id + '/Images/Primary', { quality: 90 });
    view.appendChild(img);
    document.body.appendChild(view);
    view.focus();
    function close() { view.remove(); window.removeEventListener('keydown', onKey, true); }
    function onKey(e) {
      if (e.key !== 'Escape' && e.key !== 'Backspace' && e.keyCode !== 461) return;
      e.preventDefault();
      e.stopPropagation();
      close();
    }
    view.addEventListener('click', close);
    window.addEventListener('keydown', onKey, true);
  }

  function enhancePosterMenu() {
    if (!menuFromPage || !menuItemId) return;
    var first = document.querySelector('.actionSheet .actionSheetMenuItem');
    if (!first || first.parentNode.querySelector('[data-id="ml-poster"]')) return;
    var id = menuItemId;
    var item = first.cloneNode(true);
    item.setAttribute('data-id', 'ml-poster');
    item.classList.remove('hide');
    var icon = item.querySelector('.actionsheetMenuItemIcon');
    if (icon) icon.className = 'actionsheetMenuItemIcon listItemIcon listItemIcon-transparent material-icons image';
    item.querySelector('.actionSheetItemText').textContent = 'View poster';
    first.parentNode.appendChild(item);
    item.addEventListener('click', function (e) {
      e.stopPropagation();
      e.preventDefault();
      var closeBtn = document.querySelector('.actionSheet .btnCloseActionSheet');
      if (closeBtn) closeBtn.click(); else history.back();
      showPoster(id);
    });
  }

  // 12. Detail pages: tags and the outside links become rows of the details group, labelled like Genres; a long tag list folds behind Show all.
  var TAGS_SHOWN = 10;

  // Jellyfin rewrites its own blocks on refresh, so the rows hold copies, rebuilt whenever the source text changes, and the source is only hidden.
  function detailRow(group, source, cls, label, fold) {
    var links = [].slice.call(source.querySelectorAll('a'));
    var row = group.querySelector('.' + cls);
    var sig = source.textContent;
    source.classList.add('ml-moved');
    if (row && row.getAttribute('data-sig') === sig) return;
    if (row) row.remove();
    if (!links.length) return;
    row = document.createElement('div');
    row.className = 'detailsGroupItem ' + cls;
    row.setAttribute('data-sig', sig);
    row.innerHTML = '<div class="label"></div><div class="content"></div>';
    row.firstChild.textContent = label;
    var content = row.lastChild;
    links.forEach(function (a, i) {
      var bit = document.createElement('span');
      if (fold && i >= TAGS_SHOWN) bit.className = 'ml-fold';
      if (i) bit.appendChild(document.createTextNode(', '));
      bit.appendChild(a.cloneNode(true));
      content.appendChild(bit);
    });
    if (fold && links.length > TAGS_SHOWN) {
      var more = document.createElement('button');
      more.type = 'button';
      more.className = 'ml-fold-toggle';
      var setLabel = function () { more.textContent = row.classList.contains('ml-open') ? 'Show less' : 'Show all (' + links.length + ')'; };
      more.addEventListener('click', function () { row.classList.toggle('ml-open'); setLabel(); });
      setLabel();
      content.appendChild(more);
    }
    group.appendChild(row);
  }

  function enhanceDetailRows() {
    var page = document.querySelector('.itemDetailPage:not(.hide)');
    if (!page) return;
    // A page shows as a season only once its episode list loads, so rows made before then are taken back.
    if (page.classList.contains('ml-season-page')) {
      [].slice.call(page.querySelectorAll('.ml-tags-row, .ml-links-row')).forEach(function (r) { r.remove(); });
      [].slice.call(page.querySelectorAll('.ml-moved')).forEach(function (e) { e.classList.remove('ml-moved'); });
      return;
    }
    var group = page.querySelector('.itemDetailsGroup');
    if (!group) return;
    var tags = page.querySelector('.itemTags');
    var links = page.querySelector('.itemExternalLinks');
    if (tags) detailRow(group, tags, 'ml-tags-row', (tags.firstChild && tags.firstChild.nodeType === 3 ? tags.firstChild.textContent : 'Tags').replace(/[:\s]+$/, '') || 'Tags', true);
    if (links) detailRow(group, links, 'ml-links-row', 'Links', false);
  }

  // 8. Library pages: the header title becomes a pill of every library, so switching needs no trip home.
  var libraries = null;
  var ROUTES = { tvshows: 'tv', movies: 'movies', music: 'music', homevideos: 'list', boxsets: 'list' };

  function libraryLink(lib) {
    var route = ROUTES[lib.CollectionType] || 'list';
    return '#/' + route + '?topParentId=' + lib.Id + (lib.CollectionType ? '&collectionType=' + lib.CollectionType : '') + (route === 'list' ? '&parentId=' + lib.Id : '');
  }

  function enhanceLibrarySwitcher() {
    var match = /[?&](?:topParentId|parentId)=([0-9a-f]+)/i.exec(location.hash);
    var title = document.querySelector('.skinHeader .pageTitle');
    var existing = document.querySelector('.ml-libnav');
    var onLibrary = match && /^#\/(tv|movies|music|list)\b/.test(location.hash);
    if (!onLibrary) {
      if (existing) existing.remove();
      root.classList.remove('ml-libnav-on');
      return;
    }
    if (!title) return;
    if (!libraries) {
      var api = window.ApiClient;
      if (!api || libraries === false) return;
      libraries = false;
      api.getJSON(api.getUrl('Users/' + api.getCurrentUserId() + '/Views')).then(function (res) {
        libraries = (res.Items || []).filter(function (v) { return v.CollectionType !== 'livetv' && v.CollectionType !== 'playlists'; });
        enhanceLibrarySwitcher();
      }).catch(function () { libraries = null; });
      return;
    }
    if (libraries.length < 2) return;
    var current = match[1];
    if (existing && existing.getAttribute('data-current') === current && existing.parentNode === title.parentNode) return;
    if (existing) existing.remove();
    var nav = document.createElement('div');
    nav.className = 'ml-libnav';
    nav.setAttribute('data-current', current);
    libraries.forEach(function (lib) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ml-libnav-item' + (lib.Id === current ? ' ml-on' : '');
      btn.textContent = lib.Name;
      btn.addEventListener('click', function () { if (lib.Id !== current) location.hash = libraryLink(lib); });
      nav.appendChild(btn);
    });
    title.parentNode.insertBefore(nav, title.nextSibling);
    root.classList.add('ml-libnav-on');
  }
  window.addEventListener('hashchange', enhanceLibrarySwitcher);

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

  // 5. Pause card: 15 s into a pause the controls fade and the episode's details show; any key or pointer move brings them back.
  var PAUSE_DELAY = 15000;
  var pauseTimer = null;
  var pauseCard = null;

  function hidePauseCard() {
    clearTimeout(pauseTimer);
    pauseTimer = null;
    root.classList.remove('ml-pause-idle');
    if (pauseCard) pauseCard.remove();
    pauseCard = null;
  }

  function armPauseCard() {
    hidePauseCard();
    var video = document.querySelector('video');
    if (video && video.paused && document.querySelector('#videoOsdPage:not(.hide)')) pauseTimer = setTimeout(showPauseCard, PAUSE_DELAY);
  }

  function playingItem() {
    var api = window.ApiClient;
    return api.getJSON(api.getUrl('Sessions', { DeviceId: api.deviceId() })).then(function (sessions) {
      var now = sessions[0] && sessions[0].NowPlayingItem;
      return now ? api.getItem(api.getCurrentUserId(), now.Id) : null;
    });
  }

  function text(tag, cls, value) {
    var el = document.createElement(tag);
    el.className = cls;
    el.textContent = value;
    return el;
  }

  function showPauseCard() {
    pauseTimer = null;
    playingItem().then(function (item) {
      var video = document.querySelector('video');
      if (!item || !video || !video.paused || pauseCard || !document.querySelector('#videoOsdPage:not(.hide)')) return;
      var card = document.createElement('div');
      card.className = 'ml-pause-card';
      if (item.SeriesName) card.appendChild(text('div', 'ml-pc-series', item.SeriesName));
      card.appendChild(text('div', 'ml-pc-title', item.Name));
      var meta = document.createElement('div');
      meta.className = 'ml-pc-meta';
      if (item.IndexNumber != null) meta.appendChild(text('span', '', 'S' + item.ParentIndexNumber + ' · E' + item.IndexNumber));
      if (item.RunTimeTicks) meta.appendChild(text('span', '', Math.round(item.RunTimeTicks / 6e8) + ' min'));
      var ends = document.querySelector('.osdEndsTime, .endsAtText');
      if (ends && ends.textContent.trim()) meta.appendChild(text('span', '', ends.textContent.trim()));
      card.appendChild(meta);
      if (item.Overview) card.appendChild(text('p', 'ml-pc-overview', item.Overview));
      document.body.appendChild(card);
      pauseCard = card;
      root.classList.add('ml-pause-idle');
    }).catch(function () {});
  }

  function onActivity(e) {
    if (!pauseTimer && !pauseCard) return;
    var shown = !!pauseCard;
    armPauseCard();
    // The dismissing key presses no hidden button; the synthetic pointer move makes Jellyfin show its controls.
    if (shown && e.type === 'keydown') {
      e.preventDefault();
      e.stopPropagation();
      var at = { bubbles: true, pointerType: 'mouse', clientX: Math.random() * 100, clientY: Math.random() * 100, screenX: Math.random() * 100, screenY: Math.random() * 100 };
      document.body.dispatchEvent(window.PointerEvent ? new PointerEvent('pointermove', at) : new MouseEvent('mousemove', at));
    }
  }

  document.addEventListener('pause', function (e) { if (e.target.tagName === 'VIDEO') armPauseCard(); }, true);
  document.addEventListener('play', function (e) { if (e.target.tagName === 'VIDEO') hidePauseCard(); }, true);
  document.addEventListener('ended', function (e) { if (e.target.tagName === 'VIDEO') hidePauseCard(); }, true);
  window.addEventListener('hashchange', hidePauseCard);
  ['keydown', 'mousemove', 'pointerdown', 'touchstart', 'wheel'].forEach(function (type) {
    document.addEventListener(type, onActivity, true);
  });
})();
