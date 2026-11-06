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

  // Times are 24-hour everywhere: Jellyfin formats clocks and end times with the browser's language, which is 12-hour in English.
  var localeTime = Date.prototype.toLocaleTimeString;
  Date.prototype.toLocaleTimeString = function (locales, options) {
    var opts = Object.assign({}, options);
    if (opts.hour12 === undefined && !opts.hourCycle) opts.hourCycle = 'h23';
    return localeTime.call(this, locales, opts);
  };

  function isTv() { return root.classList.contains('layout-tv'); }
  function isDesktop() { return root.classList.contains('layout-desktop'); }

  // The TV app's Back walks the history and never reaches the page, so a menu or view opened over a page adds a history step that Back removes, as Jellyfin's dialogs do.
  var backStep = null;
  var backTag = null;
  var afterBack = null;
  // history.back() lands later; a second call before then would leave the page as well.
  var backPending = false;
  function goBack() {
    if (backPending) return;
    backPending = true;
    history.back();
  }
  function pushBackStep(tag, close) {
    history.pushState({ mlBack: tag }, '', location.href);
    armStep(tag, close);
  }
  function armStep(tag, close) {
    backStep = close;
    backTag = tag;
  }
  // Closing by other means takes the step back out; an action waits for that, or the back would undo its navigation.
  function popBackStep(then) {
    backStep = null;
    if (history.state && history.state.mlBack) {
      afterBack = then || null;
      goBack();
    } else if (then) {
      then();
    }
  }
  window.addEventListener('popstate', function () {
    // A Jellyfin dialog opened over the view (the filter menu over a full tab) took its own step out; the view's step is still the current one, so the view stays.
    if (backStep && !backPending && history.state && history.state.mlBack === backTag) return;
    var close = backStep;
    var then = afterBack;
    backStep = null;
    afterBack = null;
    backPending = false;
    if (close) close();
    if (then) setTimeout(then, 0);
  });
  window.addEventListener('keydown', function (e) {
    var back = e.key === 'Escape' || e.key === 'Backspace' || e.key === 'GoBack' || e.keyCode === 461;
    if (!back || !backStep || document.querySelector('.dialogContainer .dialog') || /INPUT|TEXTAREA/.test((document.activeElement || {}).tagName)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    goBack();
  }, true);

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

  function enhanceSeasonSections() {
    var sections = document.querySelectorAll('.moreFromSeasonSection');
    for (var i = 0; i < sections.length; i++) enhanceSeason(sections[i]);
  }
  // People rows (Cast & Crew, Guest Stars) have no class of their own; their cards do.
  function enhancePeopleRows() {
    var people = document.querySelectorAll('.itemDetailPage .verticalSection');
    for (var j = 0; j < people.length; j++) {
      var title = people[j].querySelector('.sectionTitle');
      if (title && people[j].querySelector('.personCard')) enhanceSeason(people[j], title.textContent.trim());
    }
  }

  // Each enhancer runs alone, so one that throws cannot stop the rest, such as the menu rows that replace buttons the CSS hides.
  var ENHANCERS = [enhanceLatestEpisodes, enhanceSeasonSections, enhancePeopleRows, enhanceCloseButtons, enhancePlayerMenu, enhanceItemMenu, enhanceDetailMore, enhanceSeriesCards, enhanceWideArt, enhanceSeasonCards, enhanceSeasonPage, enhanceDetailBanner, enhancePosterMenu, organizeWideMenu, enhanceDetailRows, enhanceLibrarySwitcher, enhanceViewStrip, enhanceCardTargets, enhanceHero, enhanceDetailBleed, enhanceClock, enhanceTopBar, enhanceUserMenu, enhanceLibrary, enhanceFilterCard, enhanceInfoIcons];
  var pending = false;
  var failedEnhancers = {};
  new MutationObserver(function () {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      ENHANCERS.forEach(function (enhance) {
        try { enhance(); } catch (err) {
          if (!failedEnhancers[enhance.name]) console.error('Moonlight: ' + enhance.name + ' failed', err);
          failedEnhancers[enhance.name] = true;
        }
      });
    });
  }).observe(document.body, { childList: true, subtree: true });

  // The detail info line is a row of pills like the card chips, each with an icon; star and tomato already carry theirs.
  function infoIcon(el) {
    var t = el.textContent.trim();
    if (el.classList.contains('starRatingContainer') || el.classList.contains('mediaInfoCriticRating')) return null;
    if (el.classList.contains('mediaInfoOfficialRating')) return 'security';
    if (el.classList.contains('endsAt')) return 'flag';
    if (/^(\d+h)?\s?(\d+m)?$/.test(t) && /\d/.test(t)) return 'schedule';
    if (/\d{4}/.test(t)) return 'event';
    return null;
  }
  function enhanceInfoIcons() {
    var items = document.querySelectorAll('.itemMiscInfo .mediaInfoItem');
    for (var i = 0; i < items.length; i++) {
      var el = items[i];
      if (el.firstElementChild && el.firstElementChild.classList.contains('ml-pill-icon')) continue;
      var icon = infoIcon(el);
      if (icon) el.insertBefore(pillIcon(icon), el.firstChild);
    }
  }

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

  // The detail page keeps Play and More in its row; Trailer, Shuffle, Mark played and Favourite are a 2 by 2 grid at the top of More, and each tile presses the hidden button so Jellyfin's own action runs.
  var MOVED_TO_MORE = [['.btnPlayTrailer', 'movie'], ['.btnShuffle', 'shuffle'], ['.btnPlaystate', 'check_circle'], ['.btnUserRating', 'favorite']];
  function enhanceDetailMore() {
    if (!menuFromPage) return;
    var first = document.querySelector('.actionSheet .actionSheetScroller > .actionSheetMenuItem');
    if (!first || first.parentNode.querySelector('.ml-moved-grid')) return;
    var page = document.querySelector('.itemDetailPage:not(.hide)');
    if (!page) return;
    var grid = document.createElement('div');
    grid.className = 'ml-moved-grid';
    MOVED_TO_MORE.forEach(function (m) {
      var btn = [].slice.call(page.querySelectorAll('.mainDetailButtons ' + m[0])).filter(function (b) { return !b.classList.contains('hide'); })[0];
      if (!btn) return;
      var item = first.cloneNode(true);
      item.classList.remove('hide');
      item.setAttribute('data-id', 'ml-moved' + m[0].slice(4));
      var icon = item.querySelector('.actionsheetMenuItemIcon');
      if (icon) icon.className = 'actionsheetMenuItemIcon listItemIcon listItemIcon-transparent material-icons ' + m[1];
      if (icon) icon.textContent = '';
      item.querySelector('.actionSheetItemText').textContent = btn.title;
      // Jellyfin's handler would close the menu with an id it does not know, so this row closes it and presses the page's button.
      item.addEventListener('click', function (e) {
        e.stopPropagation();
        e.preventDefault();
        var close = document.querySelector('.actionSheet .btnCloseActionSheet');
        if (close) close.click(); else history.back();
        setTimeout(function () { btn.click(); }, 150);
      });
      grid.appendChild(item);
    });
    if (!grid.children.length) return;
    var divider = document.createElement('div');
    divider.className = 'actionsheetDivider';
    first.parentNode.insertBefore(divider, first.parentNode.firstChild);
    first.parentNode.insertBefore(grid, first.parentNode.firstChild);
  }

  // TV layout: the More menu is a grid of icon tiles under three titled sections, so a long list needs no scrolling. Rows keep their place in the DOM; their section sets their order, and rows other scripts add later join on the next pass.
  var MENU_LIBRARY = ['addtocollection', 'addtoplaylist', 'download', 'downloadall', 'copy-stream', 'share'];
  var MENU_SECTIONS = [['quick', 'Quick actions'], ['lib', 'Add and download'], ['manage', 'Manage']];
  function organizeWideMenu() {
    if (!isTv()) return;
    var scroller = document.querySelector('.actionSheet .actionSheetScroller');
    if (!scroller || !scroller.querySelector('.ml-moved-grid')) return;
    scroller.closest('.actionSheet').classList.add('ml-sections-sheet');
    scroller.classList.add('ml-sections');
    var libShown = 0;
    [].forEach.call(scroller.children, function (row) {
      if (!row.classList.contains('actionSheetMenuItem')) return;
      var id = row.getAttribute('data-id') || '';
      var section = id === 'delete' ? 'danger' : MENU_LIBRARY.indexOf(id) >= 0 ? 'lib' : 'manage';
      row.setAttribute('data-ml-sec', section);
      if (section === 'lib' && !row.classList.contains('hide')) libShown++;
    });
    MENU_SECTIONS.forEach(function (s) {
      var head = scroller.querySelector('.ml-sec-head[data-ml-sec="' + s[0] + '"]');
      if (!head) {
        head = document.createElement('div');
        head.className = 'ml-sec-head';
        head.setAttribute('data-ml-sec', s[0]);
        head.textContent = s[1];
        scroller.appendChild(head);
      }
      head.hidden = s[0] === 'lib' && !libShown;
    });
  }

  // 18. Recently Added lists a show with one new episode as that episode under the show's poster; such a card opens, previews and counts the show, like the rest of its row.
  function enhanceLatestEpisodes() {
    var api = window.ApiClient;
    if (!api) return;
    var cards = document.querySelectorAll('.card[class*="ortraitCard"][data-type="Episode"][data-id]:not([data-ml-latest])');
    [].forEach.call(cards, function (card) {
      card.setAttribute('data-ml-latest', '1');
      // Holds the chips back until the card points at its show.
      card.setAttribute('data-ml-series', '1');
      var user = api.getCurrentUserId();
      api.getItem(user, card.getAttribute('data-id')).then(function (episode) {
        return episode.SeriesId ? api.getItem(user, episode.SeriesId) : null;
      }).then(function (show) {
        if (!show) return;
        card.setAttribute('data-id', show.Id);
        card.setAttribute('data-type', 'Series');
        card.setAttribute('data-isfolder', 'true');
        card.removeAttribute('data-mediatype');
        card.removeAttribute('data-ml-series');
        var pic = card.querySelector('.cardImageContainer');
        var badges = pic && pic.querySelector('.cardIndicators');
        if (badges) badges.remove();
        var count = show.UserData && show.UserData.UnplayedItemCount;
        if (!pic || !count) return;
        badges = document.createElement('div');
        badges.className = 'cardIndicators';
        badges.innerHTML = '<div class="countIndicator indicator"></div>';
        badges.firstChild.textContent = count > 99 ? '99+' : String(count);
        pic.appendChild(badges);
      }).catch(function () { card.removeAttribute('data-ml-series'); });
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

  function pillIcon(name) {
    var icon = document.createElement('span');
    icon.className = 'material-icons ml-pill-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = name;
    return icon;
  }

  // A text chip with its icon in front, as every pill has.
  function textChip(cls, icon, text) {
    var el = chip(cls, '');
    el.appendChild(pillIcon(icon));
    el.appendChild(document.createTextNode(text));
    return el;
  }

  function runtime(ticks) {
    var min = Math.round(ticks / 6e8);
    return (min >= 60 ? Math.floor(min / 60) + 'h ' : '') + (min % 60) + 'm';
  }

  function episodeChips(row, info) {
    if (info.CommunityRating != null) row.appendChild(chip('ml-chip-com', STAR + info.CommunityRating.toFixed(1)));
    if (info.RunTimeTicks) row.appendChild(textChip('ml-chip-seasons', 'schedule', runtime(info.RunTimeTicks)));
    if (info.PremiereDate) row.appendChild(textChip('ml-chip-seasons', 'event', new Date(info.PremiereDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })));
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
      row.appendChild(textChip('ml-chip-code', 'tv', code[1]));
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
    if (info.IndexNumber != null) row.appendChild(textChip('ml-chip-code', 'tv', 'S' + info.ParentIndexNumber + ':E' + info.IndexNumber));
    episodeChips(row, info);
    title.parentNode.insertBefore(row, title.nextSibling);
    // Desktop builds these tiles with action "none" and an Info button the theme hides, so the tile itself opens the episode.
    item.setAttribute('data-action', 'link');
    // Only More stays on the tile, in the picture's corner as on cards; watched and favourite are in its menu.
    var actions = item.querySelector('.listViewUserDataButtons');
    var picture = item.querySelector('.listItemImage');
    if (actions) {
      actions.classList.add('ml-tile-actions');
      if (picture) picture.appendChild(actions);
      else title.parentNode.insertBefore(actions, title.nextSibling);
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
      if (years) row.appendChild(textChip('ml-chip-years', 'event', years));
      if (info.Type === 'Series' && info.ChildCount) row.appendChild(textChip('ml-chip-seasons', 'video_library', info.ChildCount + (info.ChildCount === 1 ? ' season' : ' seasons')));
      if (info.Type === 'Movie' && info.RunTimeTicks) row.appendChild(textChip('ml-chip-seasons', 'schedule', runtime(info.RunTimeTicks)));
    }
    if (info.CommunityRating != null) row.appendChild(chip('ml-chip-com', STAR + info.CommunityRating.toFixed(1)));
    if (info.CriticRating != null) row.appendChild(chip('ml-chip-crit', TOMATO + Math.round(info.CriticRating) + '%'));
    if (!row.children.length) return;
    pic.parentNode.insertBefore(row, pic.nextSibling);
    card.classList.add('ml-info-on');
  }

  // TV cards are wide everywhere, so every poster card (not people) gets its item's wide art laid over the poster; one request per batch of new cards.
  var wideInfo = {};
  function enhanceWideArt() {
    if (!isTv() || !window.ApiClient) return;
    var cards = [].slice.call(document.querySelectorAll('.card.overflowPortraitCard[data-id]:not([data-ml-wide]):not(.personCard), .card.portraitCard[data-id]:not([data-ml-wide]):not(.personCard)'));
    var missing = [];
    cards.forEach(function (card) {
      card.setAttribute('data-ml-wide', '1');
      var id = card.dataset.id;
      if (wideInfo[id]) wideArt(card, wideInfo[id]);
      else if (missing.indexOf(id) < 0) missing.push(id);
    });
    if (!missing.length) return;
    var api = window.ApiClient;
    api.getJSON(api.getUrl('Items', { userId: api.getCurrentUserId(), Ids: missing.join(','), Fields: 'ImageTags,BackdropImageTags,ParentBackdropItemId,ParentBackdropImageTags,ParentThumbItemId,ParentThumbImageTag' })).then(function (res) {
      (res.Items || []).forEach(function (item) { wideInfo[item.Id] = item; });
      cards.forEach(function (card) { if (wideInfo[card.dataset.id]) wideArt(card, wideInfo[card.dataset.id]); });
    }).catch(function () {});
  }

  function wideArt(card, info) {
    var box = card.querySelector('.cardImageContainer');
    var art = libImage(info, true);
    if (!box || !art || box.querySelector('.ml-wide-art')) return;
    var el = document.createElement('i');
    el.className = 'ml-wide-art';
    el.style.backgroundImage = 'url("' + art + '")';
    // First in the box, so the unwatched count still paints over it.
    box.insertBefore(el, box.firstChild);
  }

  // Cards arrive in batches as rows load, so their scores are fetched in one request per batch and cached by id.
  function enhanceSeriesCards() {
    var api = window.ApiClient;
    if (!api) return;
    var cards = document.querySelectorAll('.card[data-type="Series"][data-id]:not([data-ml-series]), .homeSectionsContainer .card[data-type="Season"][data-id]:not([data-ml-series]), .card[data-type="Movie"][data-id]:not([data-ml-series]), .card[data-type="Episode"][data-id]:not([data-ml-series]), .itemDetailPage #childrenContent .listItem[data-type="Episode"][data-id]:not([data-ml-series])');
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
    var fields = 'CriticRating,CommunityRating,ChildCount,RunTimeTicks,PremiereDate,ProductionYear,EndDate,Status';
    var getItems = function (ids) { return api.getJSON(api.getUrl('Items', { userId: api.getCurrentUserId(), Ids: ids.join(','), Fields: fields })); };
    getItems(missing).then(function (res) {
      (res.Items || []).forEach(function (item) { seriesInfo[item.Id] = item; });
      // A season has no score of its own, so its card shows its series' scores.
      var seasons = (res.Items || []).filter(function (item) { return item.Type === 'Season' && item.SeriesId; });
      var series = seasons.map(function (s) { return s.SeriesId; }).filter(function (id, i, all) { return !seriesInfo[id] && all.indexOf(id) === i; });
      return (series.length ? getItems(series) : Promise.resolve({})).then(function (more) {
        (more.Items || []).forEach(function (item) { seriesInfo[item.Id] = item; });
        seasons.forEach(function (s) {
          var show = seriesInfo[s.SeriesId] || {};
          s.CommunityRating = show.CommunityRating;
          s.CriticRating = show.CriticRating;
        });
      });
    }).then(function () {
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
    row.appendChild(textChip('ml-chip-seasons', 'video_library', s.n + (s.n === 1 ? ' episode' : ' episodes')));
    if (s.y0) row.appendChild(textChip('ml-chip-years', 'event', s.y1 !== s.y0 ? s.y0 + ' - ' + s.y1 : String(s.y0)));
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

  // 11. Detail pages: the poster becomes a faded banner behind the page, and the page's More menu opens it full screen.
  function enhanceDetailBanner() {
    var page = document.querySelector('.itemDetailPage:not(.hide)');
    var id = /[?&]id=([0-9a-f]+)/i.exec(location.hash);
    if (!page) return;
    var banner = page.querySelector('.ml-banner');
    var on = !!id;
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
    var first = document.querySelector('.actionSheet .actionSheetScroller > .actionSheetMenuItem');
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

  // Person pages print "Born: <date>" as one translated line; split at the first colon it reads as a label and value row like Links.
  function factRows(page, group) {
    var anchor = group.firstChild;
    ['itemBirthday', 'itemBirthLocation', 'itemDeathDate'].forEach(function (id) {
      var source = page.querySelector('#' + id);
      var cls = 'ml-fact-' + id;
      var row = group.querySelector('.' + cls);
      var text = source && !source.classList.contains('hide') ? source.textContent : '';
      var cut = text.indexOf(':');
      if (row && row.getAttribute('data-sig') === text) { anchor = row.nextSibling; return; }
      if (row) row.remove();
      if (!source || cut < 0) return;
      source.classList.add('ml-moved');
      row = document.createElement('div');
      row.className = 'detailsGroupItem ' + cls;
      row.setAttribute('data-sig', text);
      row.innerHTML = '<div class="label"></div><div class="content"></div>';
      row.firstChild.textContent = text.slice(0, cut).trim();
      row.lastChild.textContent = text.slice(cut + 1).trim();
      group.insertBefore(row, anchor);
      anchor = row.nextSibling;
    });
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
    factRows(page, group);
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

  // One request for the session; whoever asked first is called back once the list is in.
  function loadLibraries(done) {
    var api = window.ApiClient;
    if (!api || libraries === false) return;
    libraries = false;
    api.getJSON(api.getUrl('Users/' + api.getCurrentUserId() + '/Views')).then(function (res) {
      libraries = (res.Items || []).filter(function (v) { return v.CollectionType !== 'livetv' && v.CollectionType !== 'playlists'; });
      done();
    }).catch(function () { libraries = null; });
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
    if (!libraries) return loadLibraries(enhanceLibrarySwitcher);
    if (libraries.length < 2) return;
    var current = match[1];
    if (existing && existing.getAttribute('data-current') === current && existing.parentNode === title.parentNode) return placeTabs(existing);
    if (existing) existing.remove();
    var nav = document.createElement('div');
    nav.className = 'ml-libnav';
    nav.setAttribute('data-current', current);
    // TV: one button with the library's name opens the library menu, so the tabs fit beside it at any library count.
    if (isTv() && getComputedStyle(root).getPropertyValue('--ml-libdrop-css')) {
      var lib = libraries.filter(function (l) { return l.Id === current; })[0];
      if (!lib) return;
      nav.className = 'ml-libnav ml-libdrop';
      var drop = document.createElement('button');
      drop.type = 'button';
      drop.className = 'ml-libdrop-btn';
      drop.innerHTML = '<span></span><span class="material-icons" aria-hidden="true">expand_more</span>';
      drop.firstChild.textContent = lib.Name;
      drop.addEventListener('click', function () { if (clockMenu) closeClockMenu(true); else openLibraryMenu(drop, current); });
      nav.appendChild(drop);
      title.parentNode.insertBefore(nav, title.nextSibling);
      root.classList.add('ml-libnav-on');
      return placeTabs(nav);
    }
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
  // The TV tabs start after the library button, whose width follows the library's name; the landing hides the button, so it is measured once shown.
  function placeTabs(nav) {
    if (!nav.classList.contains('ml-libdrop') || !nav.offsetWidth) return;
    var left = Math.round(nav.getBoundingClientRect().right + 14) + 'px';
    if (root.style.getPropertyValue('--ml-tabs-left') !== left) root.style.setProperty('--ml-tabs-left', left);
    var row = nav.closest('.headerTop');
    var head = row && Math.round(row.getBoundingClientRect().bottom) + 'px';
    if (head && root.style.getPropertyValue('--ml-head-h') !== head) root.style.setProperty('--ml-head-h', head);
  }

  // The card frame (padding, chips row) is not an item action, so a tap there did nothing; Jellyfin takes the innermost action, so buttons and links keep theirs.
  function enhanceCardTargets() {
    if (isTv()) return;
    var boxes = document.querySelectorAll('.card[data-id] .cardBox:not([data-action])');
    for (var i = 0; i < boxes.length; i++) {
      boxes[i].classList.add('itemAction');
      boxes[i].setAttribute('data-action', 'link');
    }
    // Phone home cards come with Play only; they get the More button the library cards have.
    if (!root.classList.contains('layout-mobile')) return;
    var pics = document.querySelectorAll('.card[data-id] .cardScalable:not(.ml-more-on)');
    for (var j = 0; j < pics.length; j++) {
      pics[j].classList.add('ml-more-on');
      if (pics[j].querySelector('[data-action="menu"]') || pics[j].closest('.detailImageContainer')) continue;
      var more = document.createElement('button');
      more.type = 'button';
      more.className = 'ml-card-more itemAction';
      more.setAttribute('data-action', 'menu');
      more.title = 'More';
      more.innerHTML = '<span class="material-icons" aria-hidden="true">more_vert</span>';
      pics[j].appendChild(more);
    }
  }

  // 12.x Modern shell on PC: a pill strip for the view menu; the menu stays mounted while closed, so each pill clicks its item.
  function enhanceViewStrip() {
    var items = document.querySelectorAll('#library-view-menu .MuiMenuItem-root');
    var button = document.querySelector('[aria-controls="library-view-menu"]');
    var existing = document.querySelector('.ml-viewnav');
    if (!isDesktop() || !items.length || !button) {
      if (existing) existing.remove();
      root.classList.remove('ml-viewnav-on');
      return;
    }
    var key = Array.prototype.map.call(items, function (it) { return (it.classList.contains('Mui-selected') ? '*' : '') + it.textContent; }).join('|');
    if (existing && existing.getAttribute('data-key') === key && existing.nextSibling === button) return;
    if (existing) existing.remove();
    var nav = document.createElement('div');
    nav.className = 'ml-libnav ml-viewnav';
    nav.setAttribute('data-key', key);
    Array.prototype.forEach.call(items, function (it) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ml-libnav-item' + (it.classList.contains('Mui-selected') ? ' ml-on' : '');
      btn.textContent = it.textContent;
      btn.addEventListener('click', function () { it.click(); });
      nav.appendChild(btn);
    });
    button.parentNode.insertBefore(nav, button);
    root.classList.add('ml-viewnav-on');
  }

  // 13. TV home: a hero over the top half shows the focused item, Next Up is the first row, and each focused row sits right under the hero.
  var HERO_DELAY = 400;
  var hero = null;
  var heroItems = {};
  var heroTimer = null;
  var homeTypes = null;

  // Sections are only numbered in the page, so their kinds come from the user's home settings.
  function sectionOfType(container, type) {
    if (!homeTypes) {
      var api = window.ApiClient;
      if (!api || homeTypes === false) return null;
      homeTypes = false;
      api.getJSON(api.getUrl('DisplayPreferences/usersettings', { userId: api.getCurrentUserId(), client: 'emby' })).then(function (prefs) {
        var custom = prefs.CustomPrefs || {};
        homeTypes = Object.keys(custom).reduce(function (map, key) {
          if (/^homesection\d+$/.test(key)) map[custom[key]] = key.replace('homesection', 'section');
          return map;
        }, {});
        enhanceHero();
      }).catch(function () { homeTypes = null; });
      return null;
    }
    return homeTypes[type] ? container.querySelector(':scope > .' + homeTypes[type]) : null;
  }

  function heroHome() {
    var container = document.querySelector('#indexPage:not(.hide) .homeSectionsContainer');
    return isTv() && container && container.offsetWidth ? container : null;
  }

  // The hero sits in the home page, since the remote only moves between elements of the current page.
  var HERO_HTML = '<div class="ml-hero-art"></div><div class="ml-hero-body"><div class="ml-hero-title"></div><div class="ml-hero-sub"></div>' +
    '<p class="ml-hero-overview"></p><div class="ml-hero-actions"></div><div class="ml-hero-resume"><span class="ml-hero-left"></span><span class="ml-hero-bar"><i></i></span></div></div>';

  function buildHero(page) {
    hero = document.createElement('div');
    hero.className = 'ml-hero';
    hero.innerHTML = HERO_HTML;
    page.insertBefore(hero, page.firstChild);
  }

  function heroButton(item, label, icon, ticks, primary) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ml-hero-btn emby-button' + (primary ? ' ml-hero-primary' : '');
    btn.setAttribute('data-icon', icon);
    btn.innerHTML = '<span class="material-icons" aria-hidden="true">' + icon + '</span><span></span>';
    btn.lastChild.textContent = label;
    btn.addEventListener('click', function () { playFromHero(item, ticks); });
    return btn;
  }

  function heroLink(label, icon, hash) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ml-hero-btn emby-button';
    btn.setAttribute('data-icon', icon);
    btn.innerHTML = '<span class="material-icons" aria-hidden="true">' + icon + '</span><span></span>';
    btn.lastChild.textContent = label;
    btn.addEventListener('click', function () { location.hash = hash; });
    return btn;
  }

  // Jellyfin's play and resume live behind its item containers, so a hidden item button inside one runs them.
  function playFromHero(item, ticks) {
    var host = [].slice.call(document.querySelectorAll('#indexPage:not(.hide) .card[data-id]')).filter(function (c) { return c.offsetWidth; })[0];
    host = (host && host.closest('[is="emby-itemscontainer"]')) || document.querySelector('.page:not(.hide) [is="emby-itemscontainer"]');
    if (!host) return;
    var proxy = document.createElement('button');
    proxy.type = 'button';
    proxy.className = 'itemAction hide';
    proxy.setAttribute('data-action', ticks ? 'resume' : 'play');
    proxy.setAttribute('data-id', item.Id);
    proxy.setAttribute('data-serverid', item.ServerId);
    proxy.setAttribute('data-type', item.Type);
    proxy.setAttribute('data-mediatype', item.MediaType || '');
    proxy.setAttribute('data-isfolder', String(!!item.IsFolder));
    proxy.setAttribute('data-positionticks', String(ticks || 0));
    host.appendChild(proxy);
    proxy.click();
    proxy.remove();
  }

  function heroArt(item) {
    var api = window.ApiClient;
    var image = function (id, kind, tag) { return api.getUrl('Items/' + id + '/Images/' + kind, { maxWidth: 1920, quality: 80, tag: tag }); };
    if (item.BackdropImageTags && item.BackdropImageTags.length) return image(item.Id, 'Backdrop/0', item.BackdropImageTags[0]);
    if (item.ParentBackdropItemId && item.ParentBackdropImageTags && item.ParentBackdropImageTags.length) return image(item.ParentBackdropItemId, 'Backdrop/0', item.ParentBackdropImageTags[0]);
    if (item.ImageTags && item.ImageTags.Thumb) return image(item.Id, 'Thumb', item.ImageTags.Thumb);
    return image(item.Id, 'Primary', item.ImageTags && item.ImageTags.Primary);
  }

  function showHeroItem(item, target) {
    var h = target || hero;
    if (!h || h.getAttribute('data-id') === item.Id) return;
    h.setAttribute('data-id', item.Id);
    var art = document.createElement('div');
    art.className = 'ml-hero-art';
    art.style.backgroundImage = 'url("' + heroArt(item) + '")';
    var old = h.querySelectorAll('.ml-hero-art');
    h.insertBefore(art, h.querySelector('.ml-hero-body'));
    setTimeout(function () { for (var i = 0; i < old.length; i++) old[i].remove(); }, 500);

    var episode = item.Type === 'Episode';
    var code = episode && item.IndexNumber != null ? 'S' + item.ParentIndexNumber + ':E' + item.IndexNumber : '';
    h.querySelector('.ml-hero-title').textContent = episode && item.SeriesName ? item.SeriesName : item.Name;
    // The scores use the cards' gold star and tomato, so the same number looks the same everywhere.
    var sub = h.querySelector('.ml-hero-sub');
    sub.innerHTML = '';
    (episode ? [code, item.Name] : [item.ProductionYear, item.RunTimeTicks ? runtime(item.RunTimeTicks) : '']).filter(Boolean).forEach(function (part) { sub.appendChild(text('span', '', String(part))); });
    if (item.CommunityRating != null) sub.appendChild(text('span', 'ml-hero-score', '')).innerHTML = STAR + item.CommunityRating.toFixed(1);
    if (item.CriticRating != null) sub.appendChild(text('span', 'ml-hero-score', '')).innerHTML = TOMATO + Math.round(item.CriticRating) + '%';
    h.querySelector('.ml-hero-overview').textContent = item.Overview || '';

    var data = item.UserData || {};
    var ticks = data.PlaybackPositionTicks || 0;
    var actions = h.querySelector('.ml-hero-actions');
    var hadFocus = actions.contains(document.activeElement);
    actions.innerHTML = '';
    actions.appendChild(heroButton(item, ticks ? 'Continue' : 'Play', 'play_arrow', ticks, true));
    if (ticks) actions.appendChild(heroButton(item, 'From start', 'replay', 0, false));
    // An episode also opens its season, so the rest of its episodes are one press away.
    if (episode && item.SeasonId) actions.appendChild(heroLink(item.SeasonName || 'Season ' + item.ParentIndexNumber, 'video_library', '#/details?id=' + item.SeasonId + '&serverId=' + item.ServerId));
    if (hadFocus) actions.firstChild.focus();
    // After the resume line below has updated, since it moves the buttons.
    requestAnimationFrame(function () { fitHeroOverview(h); });

    var resume = h.querySelector('.ml-hero-resume');
    resume.classList.toggle('hide', !ticks);
    if (ticks && item.RunTimeTicks) {
      var left = Math.max(1, Math.round((item.RunTimeTicks - ticks) / 6e8));
      h.querySelector('.ml-hero-left').textContent = 'Continue ' + (code ? code + ' · ' : '') + (left < 60 ? left + ' min' : runtime((item.RunTimeTicks - ticks))) + ' left';
      h.querySelector('.ml-hero-bar i').style.width = Math.min(100, data.PlayedPercentage || ticks / item.RunTimeTicks * 100) + '%';
    }
  }

  // The whole synopsis shows while it fits above the buttons; only a longer one is cut, at the last line that fits.
  function fitHeroOverview(target) {
    var h = target && target.nodeType ? target : hero;
    var text = h && h.querySelector('.ml-hero-overview');
    var actions = h && h.querySelector('.ml-hero-actions');
    if (!text || !actions || !text.textContent) return;
    text.style.webkitLineClamp = '';
    text.style.display = '';
    var line = parseFloat(getComputedStyle(text).lineHeight) || 27;
    var room = actions.getBoundingClientRect().top - 16 - text.getBoundingClientRect().top;
    // With no room for even one line, the synopsis gives way to the buttons rather than run under them.
    if (room < line) text.style.display = 'none';
    if (text.scrollHeight > room) text.style.webkitLineClamp = String(Math.max(1, Math.floor(room / line)));
  }
  window.addEventListener('resize', fitHeroOverview);

  function loadHeroItem(id) {
    var api = window.ApiClient;
    if (heroItems[id]) return showHeroItem(heroItems[id]);
    api.getItem(api.getCurrentUserId(), id).then(function (item) {
      heroItems[id] = item;
      var focused = document.activeElement && document.activeElement.closest && document.activeElement.closest('.homeSectionsContainer .card[data-id]');
      // A slow answer must not replace an item the remote has already moved past.
      if (!focused || focused.dataset.id === id) showHeroItem(item);
    }).catch(function () {});
  }

  function enhanceHero() {
    var container = heroHome();
    var on = !!container && !!homeTypes;
    if (container && !homeTypes) sectionOfType(container, 'nextup');
    if (root.classList.contains('ml-hero-on') !== on) {
      root.classList.toggle('ml-hero-on', on);
      if (hero) hero.removeAttribute('data-id');
    }
    if (!on) return;
    var page = container.closest('.page');
    if (!hero || hero.parentNode !== page) {
      if (hero) hero.remove();
      buildHero(page);
    }
    heroLibraries();
    // Continue Watching leads, since the hero opens on its first item; Next Up follows. Moving the node would detach its row while it loads and leave it empty, so the order is only visual.
    var resume = sectionOfType(container, 'resume');
    if (resume && !resume.classList.contains('ml-first')) resume.classList.add('ml-first');
    var nextUp = sectionOfType(container, 'nextup');
    if (nextUp && !nextUp.classList.contains('ml-second')) nextUp.classList.add('ml-second');
    // My Media comes third, before the Recently Added rows, whatever the home settings order.
    var media = sectionOfType(container, 'smalllibrarytiles') || sectionOfType(container, 'librarybuttons');
    if (media && !media.classList.contains('ml-third')) media.classList.add('ml-third');
    if (hero.getAttribute('data-id')) return;
    var first = (resume && resume.querySelector('.card[data-id]')) || (nextUp && nextUp.querySelector('.card[data-id]')) || container.querySelector('.card[data-id]');
    if (!first) return;
    hero.setAttribute('data-id', '');
    var api = window.ApiClient;
    api.getItem(api.getCurrentUserId(), first.dataset.id).then(function (item) {
      heroItems[item.Id] = item;
      var active = document.activeElement;
      // Back from a detail page Jellyfin puts focus on the card again, and that card leads.
      var focusedCard = active && active.closest('.homeSectionsContainer .card[data-id]');
      if (focusedCard) return loadHeroItem(focusedCard.dataset.id);
      showHeroItem(item);
      // The page's own first focus lands on the library buttons; the hero's button leads instead.
      if (!active || active === document.body || active.closest('.section0, .homeLibraryButton')) {
        hero.querySelector('.ml-hero-btn').focus();
        alignHomeRow(hero);
      }
    }).catch(function () { hero.removeAttribute('data-id'); });
  }

  // My Media lives in the hero: a tile per library with its own art at the bottom right, in place of the row.
  function heroLibraries() {
    if (!hero || hero.querySelector('.ml-hero-libs')) return;
    if (!libraries) return loadLibraries(heroLibraries);
    var api = window.ApiClient;
    var box = document.createElement('div');
    box.className = 'ml-hero-libs';
    libraries.forEach(function (lib) {
      var a = document.createElement('a');
      a.className = 'ml-hero-lib focusable';
      a.href = libraryLink(lib);
      a.innerHTML = '<span class="ml-hero-lib-art"></span><span class="ml-hero-lib-name"></span>';
      a.lastChild.textContent = lib.Name;
      var tag = lib.ImageTags && lib.ImageTags.Primary;
      if (tag) a.firstChild.style.backgroundImage = 'url("' + api.getUrl('Items/' + lib.Id + '/Images/Primary', { maxWidth: 440, quality: 85, tag: tag }) + '")';
      box.appendChild(a);
    });
    hero.appendChild(box);
    root.classList.add('ml-hero-libs-on');
  }

  // The tiles sit far right of the buttons, so Jellyfin's nearest-element move would skip them for a card below; the hero moves its own focus.
  window.addEventListener('keydown', function (e) {
    var from = document.activeElement;
    if (!hero || !root.classList.contains('ml-hero-on') || !from || !hero.contains(from)) return;
    var left = e.key === 'ArrowLeft' || e.keyCode === 37;
    var right = e.key === 'ArrowRight' || e.keyCode === 39;
    var down = e.key === 'ArrowDown' || e.keyCode === 40;
    var buttons = [].slice.call(hero.querySelectorAll('.ml-hero-btn'));
    var tiles = [].slice.call(hero.querySelectorAll('.ml-hero-lib'));
    var target = null;
    if (right && from === buttons[buttons.length - 1]) target = tiles[0];
    else if (from.classList.contains('ml-hero-lib')) {
      if (left) target = from.previousElementSibling || buttons[buttons.length - 1];
      else if (right) target = from.nextElementSibling || from;
      else if (down) {
        var container = heroHome();
        var row = container && visibleRows(container)[0];
        var x = from.getBoundingClientRect().left + from.offsetWidth / 2;
        var best = Infinity;
        [].slice.call(row ? row.querySelectorAll('.card[data-id]') : []).forEach(function (el) {
          var r = el.getBoundingClientRect();
          var d = Math.abs(r.left + r.width / 2 - x);
          if (el.offsetWidth && d < best) { best = d; target = el; }
        });
      }
    }
    if (!target) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    target.focus();
  }, true);

  // Jellyfin centres the focused row; on the hero home the row sits right under the hero instead, so the hero covers the rows above it.
  function alignHomeRow(target) {
    var container = heroHome();
    if (!container || !hero) return;
    // One "Recently Added" section holds a row per library, so the row is aligned, not the section.
    var rows = [].slice.call(container.querySelectorAll('.verticalSection')).filter(function (r) { return r.offsetHeight; });
    rows.sort(function (a, b) { return a.getBoundingClientRect().top - b.getBoundingClientRect().top; });
    var row = target === hero ? rows[0] : target.closest('.verticalSection');
    // The heading text, not the section, goes just under the hero's 24 px fade: sections start their heading at different depths.
    var head = row && (row.querySelector('.sectionTitle') || row);
    var off = head ? head.getBoundingClientRect().top - (hero.offsetHeight + 24) : 0;
    if (Math.abs(off) > 1) window.scrollTo({ top: window.pageYOffset + off, behavior: 'instant' });
  }

  // Jellyfin scrolls the focused row to the centre a frame or more after focus moves; scroll events run before paint, so undoing it here never shows.
  var alignTarget = null;
  var alignUntil = 0;
  window.addEventListener('scroll', function () {
    if (alignTarget && Date.now() < alignUntil && root.classList.contains('ml-hero-on')) alignHomeRow(alignTarget);
  }, { passive: true });

  // Jellyfin moves Up and Down to whatever sits straight above or below, which jumps a short row such as a one-card Continue Watching; on the hero home they step one row at a time.
  function visibleRows(container) {
    var rows = [].slice.call(container.querySelectorAll('.verticalSection')).filter(function (r) { return r.offsetHeight && !r.querySelector('.verticalSection'); });
    return rows.sort(function (a, b) { return a.getBoundingClientRect().top - b.getBoundingClientRect().top; });
  }

  window.addEventListener('keydown', function (e) {
    var up = e.key === 'ArrowUp' || e.keyCode === 38;
    var down = e.key === 'ArrowDown' || e.keyCode === 40;
    if ((!up && !down) || !hero || !root.classList.contains('ml-hero-on')) return;
    var container = heroHome();
    var from = document.activeElement;
    var row = container && from && from.closest('.homeSectionsContainer .verticalSection');
    if (!row) return;
    var rows = visibleRows(container);
    var next = rows[rows.indexOf(row) + (down ? 1 : -1)];
    var target = null;
    if (!next && up) target = hero.querySelector('.ml-hero-btn');
    if (next) {
      var x = from.getBoundingClientRect().left + from.offsetWidth / 2;
      var best = Infinity;
      [].slice.call(next.querySelectorAll('.card[data-id], .homeLibraryButton')).forEach(function (el) {
        var r = el.getBoundingClientRect();
        var d = Math.abs(r.left + r.width / 2 - x) + (r.right < 0 || r.left > window.innerWidth ? 1e6 : 0);
        if (el.offsetWidth && d < best) { best = d; target = el; }
      });
    }
    if (!target) return;
    e.preventDefault();
    e.stopPropagation();
    target.focus();
  }, true);

  // Down from the header would land on the card under the pressed tab, past the hero, or on a library landing on the hidden stock page; it goes to the hero's first button.
  window.addEventListener('keydown', function (e) {
    var h = activeHero();
    if (!(e.key === 'ArrowDown' || e.keyCode === 40) || !h) return;
    var btn = h.querySelector('.ml-hero-btn');
    if (!btn || !document.activeElement || !document.activeElement.closest('.skinHeader') || document.activeElement.closest('.ml-clock-menu')) return;
    e.preventDefault();
    // The landing's own key handler also listens on window and would take this Down a second time from the hero.
    e.stopImmediatePropagation();
    btn.focus();
  }, true);

  // A page shown again from the cache, or a tab switch, changes only classes, which the observer does not watch.
  window.addEventListener('hashchange', function () { setTimeout(enhanceHero, 0); });

  document.addEventListener('focusin', function (e) {
    enhanceHero();
    if (!root.classList.contains('ml-hero-on') || !e.target.closest) return;
    var inHero = hero && hero.contains(e.target);
    var card = e.target.closest('.homeSectionsContainer .card[data-id]');
    if (!inHero && !e.target.closest('.homeSectionsContainer')) return;
    alignTarget = inHero ? hero : e.target;
    alignUntil = Date.now() + 800;
    requestAnimationFrame(function () { alignHomeRow(alignTarget); });
    if (!card) return;
    clearTimeout(heroTimer);
    heroTimer = setTimeout(function () { if (document.activeElement === card) loadHeroItem(card.dataset.id); }, HERO_DELAY);
  });

  // 14. TV detail page of a series, movie or episode: the backdrop fills the screen, and Play names the episode it plays.
  var bleedItems = {};

  function episodeCode(ep) { return ep && ep.IndexNumber != null ? 'S' + ep.ParentIndexNumber + ':E' + ep.IndexNumber : ''; }

  function loadBleed(page, id) {
    var api = window.ApiClient;
    var user = api.getCurrentUserId();
    page.setAttribute('data-ml-bleed', id);
    page.classList.remove('ml-bleed');
    api.getItem(user, id).then(function (item) {
      if (!/^(Series|Season|Movie|Episode)$/.test(item.Type)) return null;
      // A series or season plays its next episode, so that is the episode Play names.
      var target = /^(Series|Season)$/.test(item.Type)
        ? api.getJSON(api.getUrl('Shows/NextUp', { SeriesId: item.SeriesId || item.Id, UserId: user, Limit: 1, Fields: 'UserData' })).then(function (res) {
          var ep = res.Items && res.Items[0];
          return ep && (item.Type === 'Series' || ep.SeasonId === item.Id) ? ep : null;
        })
        : Promise.resolve(item);
      return target.then(function (ep) {
        // Jellyfin marks Play as resume even with no saved position, so Continue follows the position itself.
        var ticks = ep && ep.UserData ? ep.UserData.PlaybackPositionTicks || 0 : 0;
        bleedItems[id] = {
          art: heroArt(item),
          code: item.Type === 'Movie' ? '' : episodeCode(ep),
          started: ticks > 0,
          left: ticks && ep.RunTimeTicks ? ep.RunTimeTicks - ticks : 0,
          pct: ticks && ep.RunTimeTicks ? Math.min(100, ticks / ep.RunTimeTicks * 100) : 0
        };
        if (page.getAttribute('data-ml-bleed') === id) page.classList.add('ml-bleed');
        enhanceDetailBleed();
      });
    }).catch(function () {});
  }

  function enhanceDetailBleed() {
    var page = document.querySelector('.itemDetailPage:not(.hide)');
    var id = /[?&]id=([0-9a-f]+)/i.exec(location.hash);
    var on = isTv() && !!page && !!id && page.classList.contains('ml-banner-on');
    if (on && page.getAttribute('data-ml-bleed') !== id[1]) loadBleed(page, id[1]);
    var bleed = on && page.classList.contains('ml-bleed') && !!bleedItems[id[1]];
    if (root.classList.contains('ml-bleed-on') !== bleed) root.classList.toggle('ml-bleed-on', bleed);
    if (!bleed) return;
    var info = bleedItems[id[1]];
    var banner = page.querySelector('.ml-banner');
    if (banner && banner.getAttribute('data-ml-art') !== info.art) {
      banner.setAttribute('data-ml-art', info.art);
      banner.style.backgroundImage = 'url("' + info.art + '")';
    }
    // The labels live in their own attribute, since Jellyfin rewrites the buttons' titles on every refresh.
    var play = page.querySelector('.mainDetailButtons .btnPlay');
    var label = play && (info.started ? 'Continue' : 'Play') + (info.code ? '  ' + info.code : '');
    if (play && play.getAttribute('data-ml-label') !== label) play.setAttribute('data-ml-label', label);
    var replay = page.querySelector('.mainDetailButtons .btnReplay');
    if (replay && replay.getAttribute('data-ml-label') !== 'From start') replay.setAttribute('data-ml-label', 'From start');
    detailResume(page, info);
    lockDetailLinks(page);
  }

  // The home hero's resume line, under Continue and From start; inside the buttons row it is also the break before the icon buttons.
  function detailResume(page, info) {
    var row = page.querySelector('.mainDetailButtons');
    if (!row) return;
    var line = row.querySelector('.ml-detail-resume');
    var text = info.started && info.left ? 'Continue ' + (info.code ? info.code + ' · ' : '') + (info.left < 36e9 ? Math.max(1, Math.round(info.left / 6e8)) + ' min' : runtime(info.left)) + ' left' : '';
    if (!text) { if (line) line.remove(); return; }
    if (line && line.getAttribute('data-sig') === text) return;
    if (!line) {
      line = document.createElement('div');
      line.className = 'ml-hero-resume ml-detail-resume';
      line.innerHTML = '<span class="ml-hero-left"></span><span class="ml-hero-bar"><i></i></span>';
      row.appendChild(line);
    }
    line.setAttribute('data-sig', text);
    line.firstChild.textContent = text;
    line.querySelector('i').style.width = info.pct + '%';
  }

  // Studio, genre and tag links would each stop the remote on the way down, so the block is one stop and OK opens its links.
  function lockDetailLinks(page) {
    var group = page.querySelector('.itemDetailsGroup');
    if (!group || !group.querySelector('a')) return;
    if (!group.hasAttribute('data-ml-lock')) {
      group.setAttribute('data-ml-lock', '');
      group.tabIndex = 0;
      // Jellyfin's remote only stops on controls or elements marked focusable.
      group.classList.add('ml-locked', 'focusable');
    }
    if (!group.classList.contains('ml-locked')) return;
    var links = group.querySelectorAll('a, button');
    for (var i = 0; i < links.length; i++) if (links[i].tabIndex !== -1) links[i].tabIndex = -1;
  }

  document.addEventListener('keydown', function (e) {
    var group = e.target && e.target.classList && e.target.classList.contains('ml-locked') ? e.target : null;
    if (!group || !(e.key === 'Enter' || e.keyCode === 13)) return;
    e.preventDefault();
    e.stopPropagation();
    group.classList.remove('ml-locked');
    var links = group.querySelectorAll('a, button');
    for (var i = 0; i < links.length; i++) links[i].tabIndex = 0;
    var first = [].slice.call(links).filter(function (a) { return a.offsetWidth; })[0];
    if (first) first.focus();
  }, true);

  document.addEventListener('focusout', function (e) {
    var group = e.target.closest && e.target.closest('[data-ml-lock]');
    if (!group || group.classList.contains('ml-locked') || (e.relatedTarget && group.contains(e.relatedTarget))) return;
    group.classList.add('ml-locked');
    lockDetailLinks(group.closest('.itemDetailPage'));
  });
  window.addEventListener('hashchange', function () { setTimeout(enhanceDetailBleed, 0); });

  // A focused TV card opens its cut lines and grows; it gives the growth back as a negative bottom margin, so its row keeps its height and nothing below moves.
  var grownBox = null;
  document.addEventListener('focusin', function (e) {
    if (grownBox) { grownBox.style.removeProperty('margin-bottom'); grownBox = null; }
    var card = isTv() && e.target.closest && e.target.closest('.card, .ml-season-page #childrenContent .listItem');
    var tile = card && !card.classList.contains('card');
    // A season page tile is a restyled list row: the row is the frame, and only its title opens.
    var box = tile ? card : card && card.querySelector('.cardBox');
    if (!box) return;
    var lines = [].slice.call(card.querySelectorAll(tile ? '.listItemBody > .listItemBodyText:first-child' : '.cardText'));
    var open = box.offsetHeight;
    // Inline !important beats the theme's layered rules, so this shows the card at rest for one measure.
    lines.forEach(function (l) { l.style.setProperty('-webkit-line-clamp', '1', 'important'); });
    var rest = box.offsetHeight;
    var margin = parseFloat(getComputedStyle(box).marginBottom) || 0;
    lines.forEach(function (l) { l.style.removeProperty('-webkit-line-clamp'); });
    if (open <= rest) return;
    box.style.setProperty('margin-bottom', (margin - (open - rest)) + 'px', 'important');
    grownBox = box;
  });

  // 17. TV library page: a landing over Jellyfin's tabbed page, a hero for the focused title over one shelf per view; See all opens that view's tab in full and Back returns.
  var LIB_FIELDS = 'Overview,ProductionYear,RunTimeTicks,CommunityRating,CriticRating,UserData,BackdropImageTags,ParentBackdropImageTags,ParentBackdropItemId,ImageTags,SeriesName,ParentThumbItemId,ParentThumbImageTag,Status,EndDate';
  var libLayer = null;
  var libItems = {};
  var libTimer = null;

  function libRoute() {
    // A device on an older theme CSS keeps the stock page, since the landing is unstyled without it.
    if (!isTv() || !getComputedStyle(root).getPropertyValue('--ml-lib-css')) return null;
    var m = location.hash.match(/^#\/(tv|movies)\?(.*)$/);
    var id = m && (m[2].match(/(?:^|&)topParentId=([^&]+)/) || [])[1];
    var page = id && document.querySelector('.page.libraryPage:not(.hide)');
    return page ? { id: id, kind: m[1], page: page } : null;
  }

  // Each shelf names the stock tab its See all opens.
  function libShelves(kind, id) {
    var api = window.ApiClient;
    var user = api.getCurrentUserId();
    var base = { ParentId: id, Recursive: true, Fields: LIB_FIELDS, Limit: 12, EnableTotalRecordCount: true };
    var items = function (extra) { return api.getItems(user, Object.assign({}, base, extra)); };
    // Latest answers a bare list cut at the limit, so it has no total to show.
    var list = function (p) { return p.then(function (r) { return Array.isArray(r) ? { Items: r } : r; }); };
    // Latest names a show with one new episode by that episode; the shelf lists the show, in the same order.
    var showsOf = function (r) {
      var ids = r.Items.map(function (it) { return it.Type === 'Episode' ? it.SeriesId : it.Id; });
      return api.getItems(user, { Ids: ids.join(','), Fields: LIB_FIELDS }).then(function (shows) {
        var byId = {};
        shows.Items.forEach(function (s) { byId[s.Id] = s; });
        return { Items: ids.map(function (id) { return byId[id]; }).filter(Boolean) };
      });
    };
    var resume = { title: 'Continue watching', tab: 1, wide: true, load: function () { return list(api.getResumableItems(user, Object.assign({ MediaTypes: 'Video' }, base))); } };
    var genres = function (tab, type) { return { title: 'Genres', tab: tab, wide: true, art: { key: 'GenreIds', type: type }, load: function () { return api.getGenres(user, { ParentId: id, EnableTotalRecordCount: true }); } }; };
    if (kind === 'tv') {
      return [
        resume,
        { title: 'Next up', tab: 1, wide: true, load: function () { return list(api.getNextUpEpisodes(Object.assign({ userId: user }, base))); } },
        { title: 'Shows', tab: 0, load: function () { return items({ IncludeItemTypes: 'Series', SortBy: 'SortName' }); } },
        { title: 'Latest', tab: 1, load: function () { return list(api.getLatestItems(Object.assign({ userId: user, IncludeItemTypes: 'Episode', GroupItems: true }, base))).then(showsOf); } },
        { title: 'Upcoming', tab: 2, wide: true, load: function () { return list(api.getJSON(api.getUrl('Shows/Upcoming', Object.assign({ UserId: user }, base)))); } },
        genres(3, 'Series'),
        { title: 'TV networks', tab: 4, wide: true, art: { key: 'StudioIds', type: 'Series' }, load: function () { return api.getStudios(user, { ParentId: id, EnableTotalRecordCount: true }); } }
      ];
    }
    return [
      resume,
      { title: 'Movies', tab: 0, load: function () { return items({ IncludeItemTypes: 'Movie', SortBy: 'SortName' }); } },
      { title: 'Latest', tab: 1, load: function () { return list(api.getLatestItems(Object.assign({ userId: user, IncludeItemTypes: 'Movie' }, base))); } },
      { title: 'Favourites', tab: 2, load: function () { return items({ IncludeItemTypes: 'Movie', Filters: 'IsFavorite' }); } },
      { title: 'Collections', tab: 3, load: function () { return items({ IncludeItemTypes: 'BoxSet' }); } },
      genres(4, 'Movie')
    ];
  }

  function libImage(item, wide) {
    var api = window.ApiClient;
    var url = function (id, type, tag) { return api.getUrl('Items/' + id + '/Images/' + type, { maxWidth: wide ? 640 : 400, quality: 85, tag: tag }); };
    var tags = item.ImageTags || {};
    if (wide) {
      if (tags.Thumb) return url(item.Id, 'Thumb', tags.Thumb);
      if (item.Type === 'Episode' && tags.Primary) return url(item.Id, 'Primary', tags.Primary);
      if (item.BackdropImageTags && item.BackdropImageTags.length) return url(item.Id, 'Backdrop/0', item.BackdropImageTags[0]);
      if (item.ParentThumbItemId && item.ParentThumbImageTag) return url(item.ParentThumbItemId, 'Thumb', item.ParentThumbImageTag);
      if (item.ParentBackdropItemId && item.ParentBackdropImageTags && item.ParentBackdropImageTags.length) return url(item.ParentBackdropItemId, 'Backdrop/0', item.ParentBackdropImageTags[0]);
    }
    return tags.Primary ? url(item.Id, 'Primary', tags.Primary) : '';
  }

  // The line under the art, worded as Jellyfin's own cards word it, so a landing card matches the same card on any other page.
  function libSubtitle(item) {
    if (item.Type === 'Episode') return item.IndexNumber != null ? 'S' + item.ParentIndexNumber + ':E' + item.IndexNumber + ' - ' + item.Name : item.Name;
    if (item.Type === 'Movie') return item.ProductionYear ? String(item.ProductionYear) : '';
    if (item.Type !== 'Series' || !item.ProductionYear) return '';
    if (item.Status === 'Continuing') return item.ProductionYear + ' - Present';
    var end = item.EndDate && new Date(item.EndDate).getFullYear();
    return end && end !== item.ProductionYear ? item.ProductionYear + ' - ' + end : String(item.ProductionYear);
  }

  function libCard(item, shelf) {
    var server = window.ApiClient.serverId();
    var a = document.createElement('a');
    a.className = 'card ml-lib-card focusable' + (shelf.wide ? ' ml-lib-wide' : '');
    a.setAttribute('data-ml-id', item.Id);
    // With Jellyfin's id and type the card gets the same chips as every other card (enhanceSeriesCards).
    if (!shelf.art) {
      a.setAttribute('data-id', item.Id);
      a.setAttribute('data-type', item.Type);
    }
    a.href = shelf.art ? '#/list?' + (shelf.art.key === 'GenreIds' ? 'genreId=' : 'studioId=') + item.Id + '&parentId=' + libLayer.lib + '&serverId=' + server
      : '#/details?id=' + item.Id + '&serverId=' + server;
    a.innerHTML = '<div class="cardBox"><div class="cardText cardText-first"></div><div class="cardScalable"><div class="cardImageContainer"></div></div><div class="cardText cardText-secondary"></div></div>';
    a.querySelector('.cardText-first').textContent = item.Type === 'Episode' ? item.SeriesName || item.Name : item.Name;
    var sub = libSubtitle(item);
    if (sub) a.querySelector('.cardText-secondary').textContent = sub;
    else a.querySelector('.cardText-secondary').remove();
    var pic = a.querySelector('.cardImageContainer');
    var art = libImage(item, shelf.wide);
    if (art && !shelf.art) pic.style.backgroundImage = 'url("' + art + '")';
    var count = !shelf.art && item.UserData && item.UserData.UnplayedItemCount;
    if (count) {
      var badges = document.createElement('div');
      badges.className = 'cardIndicators';
      badges.innerHTML = '<div class="countIndicator indicator"></div>';
      badges.firstChild.textContent = count > 99 ? '99+' : String(count);
      pic.appendChild(badges);
    }
    // Jellyfin's genre and network art is one collage for the whole server, so other libraries' titles showed here; the collage is drawn from this library's titles, and under 4 titles one backdrop stands in.
    if (shelf.art) {
      var api = window.ApiClient;
      var query = { ParentId: libLayer.lib, Recursive: true, IncludeItemTypes: shelf.art.type, ImageTypes: 'Backdrop', Fields: 'BackdropImageTags', Limit: 4 };
      query[shelf.art.key] = item.Id;
      api.getItems(api.getCurrentUserId(), query).then(function (r) {
        var urls = (r.Items || []).map(function (it) { return libImage(it, true); }).filter(Boolean);
        if (urls.length < 4) {
          if (urls[0]) pic.style.backgroundImage = 'url("' + urls[0] + '")';
          return;
        }
        pic.classList.add('ml-lib-collage');
        urls.forEach(function (u) {
          var tile = document.createElement('i');
          tile.style.backgroundImage = 'url("' + u + '")';
          pic.appendChild(tile);
        });
      }).catch(function () {});
    }
    return a;
  }

  // See all leads the row as a card whose art peeks at the next title, one Left from the first title.
  function libShelf(shelf, result) {
    var items = result.Items;
    // Every shelf uses wide art, so a whole focused card fits under the TV hero.
    shelf.wide = true;
    var el = document.createElement('section');
    el.className = 'ml-lib-shelf';
    el.innerHTML = '<h2 class="ml-lib-title"></h2><div class="ml-lib-strip"></div>';
    el.firstChild.textContent = shelf.title;
    var strip = el.lastChild;
    var shown = items.slice(0, 11);
    shown.forEach(function (item) {
      if (!shelf.art) libItems[item.Id] = item;
      strip.appendChild(libCard(item, shelf));
    });
    var more = document.createElement('button');
    more.type = 'button';
    more.className = 'card ml-lib-more ml-lib-wide focusable';
    more.innerHTML = '<div class="cardBox"><div class="cardText cardText-first">See all</div><div class="cardScalable"><div class="cardImageContainer"><span class="ml-lib-more-label"></span></div></div></div>';
    var next = items[shown.length] && libImage(items[shown.length], true);
    if (next) more.querySelector('.cardImageContainer').style.backgroundImage = 'url("' + next + '")';
    more.querySelector('.ml-lib-more-label').textContent = result.TotalRecordCount ? result.TotalRecordCount + ' ›' : '›';
    more.addEventListener('click', function () { libSeeAll(shelf.tab); });
    strip.insertBefore(more, strip.firstChild);
    return el;
  }

  function libBuild(route) {
    if (libLayer) libLayer.el.remove();
    var el = document.createElement('div');
    el.className = 'ml-lib';
    el.innerHTML = '<div class="ml-hero ml-lib-hero">' + HERO_HTML + '</div><div class="ml-lib-rows"><div class="ml-lib-track"></div></div>';
    route.page.appendChild(el);
    libLayer = { el: el, lib: route.id, page: route.page, hero: el.firstChild, track: el.querySelector('.ml-lib-track'), last: null, card: null };
    libTag(el);
    var shelves = libShelves(route.kind, route.id);
    // All shelves land at once, so the first row is the first shelf and focus never jumps.
    Promise.all(shelves.map(function (s) { return s.load().catch(function () { return null; }); })).then(function (results) {
      if (!libLayer || libLayer.el !== el) return;
      results.forEach(function (r, i) { if (r && r.Items && r.Items.length) libLayer.track.appendChild(libShelf(shelves[i], r)); });
      var first = libLayer.track.querySelector('.ml-lib-card');
      if (!first) return;
      var active = document.activeElement;
      if (!active || active === document.body || !active.offsetWidth || route.page.contains(active)) first.focus({ preventScroll: true });
      var id = first.getAttribute('data-ml-id');
      if (libItems[id]) libHero(libItems[id]);
    });
  }

  // A tag over the hero title names this library.
  function libTag(el) {
    var retry = function () { if (libLayer && libLayer.el === el) libTag(el); };
    // false means another caller's load is still running, and it calls back only its own caller.
    if (libraries === false) return setTimeout(retry, 300);
    if (!libraries) return loadLibraries(retry);
    var at = libraries.map(function (l) { return l.Id; }).indexOf(libLayer.lib);
    if (at < 0) return;
    var tag = document.createElement('div');
    tag.className = 'ml-lib-tag';
    tag.innerHTML = '<span class="ml-lib-tag-name"></span>';
    tag.firstChild.textContent = libraries[at].Name;
    var body = el.querySelector('.ml-hero-body');
    body.insertBefore(tag, body.firstChild);
    // The tag can land after the hero was fitted, and it moves the synopsis down.
    fitHeroOverview(libLayer.hero);
  }

  function libHero(item) {
    showHeroItem(item, libLayer.hero);
    var actions = libLayer.hero.querySelector('.ml-hero-actions');
    if (actions.querySelector('.ml-lib-sort')) return;
    var libs = libraries && libraries.length > 1;
    [['sort', 'Sort', '.btnSort'], ['filter_list', 'Filter', '.btnFilter']].concat(libs ? [['apps', 'Libraries']] : []).forEach(function (b) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ml-hero-btn emby-button ml-lib-' + b[1].toLowerCase();
      btn.setAttribute('data-icon', b[0]);
      btn.innerHTML = '<span class="material-icons" aria-hidden="true">' + b[0] + '</span><span></span>';
      btn.lastChild.textContent = b[1];
      btn.addEventListener('click', function () {
        if (!b[2]) return clockMenu ? closeClockMenu(true) : openLibraryMenu(btn);
        libSeeAll(0, b[2]);
      });
      actions.appendChild(btn);
    });
  }

  // See all hands over to the stock tab; Sort and Filter then press Jellyfin's own buttons there.
  function libSeeAll(tab, press) {
    libLayer.last = document.activeElement;
    root.classList.add('ml-lib-all');
    var tabs = document.querySelectorAll('.skinHeader .headerTabs .emby-tab-button');
    if (tabs[tab]) tabs[tab].click();
    pushBackStep('lib', libLanding);
    setTimeout(function () {
      var visible = function (sel) { return [].slice.call(libLayer.page.querySelectorAll(sel)).filter(function (b) { return b.offsetWidth; })[0]; };
      var btn = press && visible(press);
      if (btn) return btn.click();
      var card = visible('.card');
      if (card) card.focus();
    }, 400);
  }

  function libAlign(el) {
    var shelf = el.closest('.ml-lib-shelf');
    if (!shelf) return;
    // Focus scrolls the shelf's clipped strip on its own; the strip moves only by the shift below.
    shelf.scrollLeft = 0;
    // Jellyfin centres the focused card in the shelves, which pushed its heading under the hero; once it has, the shelf's heading goes just under the 24 px fade.
    var rows = libLayer.track.parentNode;
    var top = Math.max(0, shelf.offsetTop - 24);
    setTimeout(function () { if (rows.scrollTop !== top) rows.scrollTop = top; }, 0);
    // The focused card stays in view with a slice of the next one showing past it.
    var strip = shelf.querySelector('.ml-lib-strip');
    var x = parseFloat(strip.getAttribute('data-x')) || 0;
    var room = shelf.clientWidth - el.offsetWidth * 0.35;
    if (el.offsetLeft + el.offsetWidth - x > room) x = el.offsetLeft + el.offsetWidth - room;
    if (el.offsetLeft - x < 0) x = el.offsetLeft;
    strip.setAttribute('data-x', String(x));
    strip.style.transform = 'translateX(' + (-x) + 'px)';
  }

  function enhanceLibrary() {
    var route = libRoute();
    if (root.classList.contains('ml-lib-on') !== !!route) root.classList.toggle('ml-lib-on', !!route);
    if (!route) {
      root.classList.remove('ml-lib-all');
      return;
    }
    if (libLayer && libLayer.lib === route.id && libLayer.el.parentNode === route.page) {
      // Back from a title opened in a full tab lands on that tab's history step, so the tab shows again.
      if (history.state && history.state.mlBack === 'lib' && !root.classList.contains('ml-lib-all')) {
        root.classList.add('ml-lib-all');
        armStep('lib', libLanding);
      }
      return;
    }
    root.classList.remove('ml-lib-all');
    libBuild(route);
  }
  window.addEventListener('hashchange', function () { setTimeout(enhanceLibrary, 0); });

  // Filter card: Moonlight chips inside Jellyfin's own filter dialog. Each chip clicks the stock checkbox under it, so Jellyfin still filters, saves and closes the dialog.
  var FC_GROUPS = [['Show', '.chkStandardFilter'], ['Genre', '.chkGenreFilter']];
  var FC_NAMES = { IsResumable: 'In progress' };
  function fcKey(input) { return (input.className.match(/chk\w+/) || ['chk'])[0] + ':' + (input.getAttribute('data-filter') || input.id); }
  function fcLabel(input) {
    var name = FC_NAMES[input.getAttribute('data-filter')];
    var label = input.closest('label');
    return name || (label ? label.textContent.trim() : input.getAttribute('data-filter') || '');
  }
  function fcChip(key, text, picked) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ml-fc-chip' + (picked ? ' ml-fc-tag' : '');
    btn.setAttribute('data-ml-key', key);
    btn.textContent = picked ? text : '+ ' + text;
    if (picked) btn.insertAdjacentHTML('beforeend', '<span class="ml-fc-x" aria-hidden="true">×</span>');
    return btn;
  }
  function fcLine(card, title) {
    if (title) card.insertAdjacentHTML('beforeend', '<div class="ml-fc-label"></div>');
    if (title) card.lastChild.textContent = title;
    var line = document.createElement('div');
    line.className = 'ml-fc-line';
    card.appendChild(line);
    return line;
  }
  // Focus stays where the remote was: on the chip that slid into the clicked one's place, or the nearest one left.
  function fcNext(btn) {
    var near = btn.nextElementSibling && btn.nextElementSibling.getAttribute('data-ml-key') ? btn.nextElementSibling : btn.previousElementSibling;
    return near && near.getAttribute('data-ml-key');
  }
  function fcRender(dialog, want) {
    var content = dialog.querySelector('.filterDialogContent');
    var card = dialog.querySelector('.ml-fc');
    var active = document.activeElement;
    if (!want && card && card.contains(active)) want = active.getAttribute('data-ml-key');
    if (!card) {
      card = document.createElement('div');
      card.className = 'ml-fc';
      content.parentNode.insertBefore(card, content);
      dialog.classList.add('ml-fc-on');
    }
    card.textContent = '';
    var inputs = {};
    [].slice.call(content.querySelectorAll('input[type="checkbox"]')).forEach(function (i) { inputs[fcKey(i)] = i; });
    var picked = Object.keys(inputs).filter(function (k) { return inputs[k].checked; });
    var tags = fcLine(card, 'Filter');
    picked.forEach(function (k) { tags.appendChild(fcChip(k, fcLabel(inputs[k]), true)); });
    if (picked.length) tags.insertAdjacentHTML('beforeend', '<button type="button" class="ml-fc-clear" data-ml-key="clear">Clear all</button>');
    else tags.insertAdjacentHTML('beforeend', '<span class="ml-fc-none">No filters</span>');
    card.insertAdjacentHTML('beforeend', '<div class="ml-fc-div"></div>');
    FC_GROUPS.forEach(function (g) {
      var free = [].slice.call(content.querySelectorAll(g[1])).filter(function (i) { return !i.checked; });
      if (!free.length) return;
      var line = fcLine(card, g[0]);
      free.forEach(function (i) { line.appendChild(fcChip(fcKey(i), fcLabel(i), false)); });
    });
    var target = (want && card.querySelector('[data-ml-key="' + want.replace(/"/g, '\\"') + '"]')) || card.querySelector('button');
    if (target && (card.contains(active) || !dialog.contains(active) || !active.offsetWidth || active === dialog)) target.focus();
    card.mlInputs = inputs;
  }
  function fcClick(e) {
    var btn = e.target.closest('.ml-fc button');
    if (!btn) return;
    var dialog = btn.closest('.filterDialog');
    var inputs = btn.closest('.ml-fc').mlInputs;
    var key = btn.getAttribute('data-ml-key');
    var want;
    if (key === 'clear') {
      Object.keys(inputs).forEach(function (k) { if (inputs[k].checked) inputs[k].click(); });
    } else {
      // A picked tag leaves for its group and a + chip joins the tags, so focus goes to its neighbour; the last tag hands over to the first + chip.
      want = fcNext(btn);
      if (want === 'clear') want = null;
      inputs[key].click();
    }
    fcRender(dialog, want);
  }
  function enhanceFilterCard() {
    if (!isTv() || !getComputedStyle(root).getPropertyValue('--ml-fc-css')) return;
    var dialog = document.querySelector('.dialogContainer .filterDialog:not(.ml-fc-on)');
    if (!dialog || !dialog.querySelector('.filterDialogContent')) return;
    fcRender(dialog);
    dialog.addEventListener('click', fcClick);
    // Genres arrive after the dialog opens.
    var queued = false;
    new MutationObserver(function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; fcRender(dialog); });
    }).observe(dialog.querySelector('.filterDialogContent'), { childList: true, subtree: true });
  }

  document.addEventListener('focusin', function (e) {
    if (!libLayer || !libLayer.el.contains(e.target)) return;
    var card = e.target.closest('.ml-lib-card, .ml-lib-more');
    if (!card) return;
    libLayer.card = card;
    libAlign(card);
    var id = card.getAttribute('data-ml-id');
    if (!id || !libItems[id]) return;
    clearTimeout(libTimer);
    libTimer = setTimeout(function () { if (document.activeElement === card) libHero(libItems[id]); }, HERO_DELAY);
  });

  // The step up or down from the focused element: the nearest card in the next shelf, the hero from the first shelf, the first shelf from the hero.
  function libStep(from, down) {
    var shelf = from && from.closest('.ml-lib-shelf');
    if (!shelf) return down ? libLayer.card || libLayer.track.querySelector('.ml-lib-card') : null;
    var shelves = [].slice.call(libLayer.track.querySelectorAll('.ml-lib-shelf'));
    var next = shelves[shelves.indexOf(shelf) + (down ? 1 : -1)];
    if (!next) return down ? null : libLayer.hero.querySelector('.ml-hero-btn');
    var x = from.getBoundingClientRect().left + from.offsetWidth / 2;
    var best = Infinity;
    var target = null;
    [].slice.call(next.querySelectorAll('.ml-lib-card, .ml-lib-more')).forEach(function (el) {
      var r = el.getBoundingClientRect();
      var d = Math.abs(r.left + r.width / 2 - x) + (r.right < 0 || r.left > window.innerWidth ? 1e6 : 0);
      if (d < best) { best = d; target = el; }
    });
    return target;
  }

  // The wheel scrolls the shelves wherever the pointer is on the landing, the hero included, since the page behind must not move.
  window.addEventListener('wheel', function (e) {
    if (!libLayer || !root.classList.contains('ml-lib-on') || root.classList.contains('ml-lib-all') || clockMenu) return;
    var rows = libLayer.track.parentNode;
    if (rows.contains(e.target)) return;
    e.preventDefault();
    rows.scrollBy({ top: e.deltaY });
  }, { passive: false });

  // Rows step one at a time and Left and Right stay in the row, as on the hero home.
  window.addEventListener('keydown', function (e) {
    if (!libLayer || !root.classList.contains('ml-lib-on') || root.classList.contains('ml-lib-all')) return;
    var from = document.activeElement;
    if (!from || !libLayer.el.contains(from)) return;
    var up = e.key === 'ArrowUp' || e.keyCode === 38;
    var down = e.key === 'ArrowDown' || e.keyCode === 40;
    var left = e.key === 'ArrowLeft' || e.keyCode === 37;
    var right = e.key === 'ArrowRight' || e.keyCode === 39;
    var shelf = from.closest('.ml-lib-shelf');
    var target = null;
    // Jellyfin's own Left and Right stopped at From start in the hero, so the buttons step in order here too.
    var inActions = from.classList.contains('ml-hero-btn') && from.parentNode.classList.contains('ml-hero-actions');
    if ((shelf || inActions) && (left || right)) {
      target = right ? from.nextElementSibling : from.previousElementSibling;
    } else if (shelf && (up || down)) {
      target = libStep(from, down);
    } else if (down && from.closest('.ml-lib-hero')) {
      target = libStep(null, true);
    } else if (up && from.closest('.ml-lib-hero')) {
      // Jellyfin found nothing above the hero, so Up stayed put; it goes to the nearest header control instead.
      var x = from.getBoundingClientRect().left + from.offsetWidth / 2;
      var best = Infinity;
      [].slice.call(document.querySelectorAll('.skinHeader button, .skinHeader .focusable')).forEach(function (el) {
        var r = el.getBoundingClientRect();
        var d = Math.abs(r.left + r.width / 2 - x);
        if (el.offsetWidth && getComputedStyle(el).visibility !== 'hidden' && d < best) { best = d; target = el; }
      });
    } else {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (target) target.focus({ preventScroll: true });
  }, true);

  // Back from the rows of the hero home or a library landing goes to the hero's first button, showing the card that was focused; a second Back does what it did before.
  var heroCard = null;
  function activeHero() {
    if (root.classList.contains('ml-hero-on') && hero) return hero;
    if (libLayer && root.classList.contains('ml-lib-on') && !root.classList.contains('ml-lib-all')) return libLayer.hero;
    return null;
  }
  function heroBack() {
    var h = activeHero();
    if (!h) return;
    var id = heroCard && (heroCard.getAttribute('data-ml-id') || heroCard.getAttribute('data-id'));
    if (id && h === hero) loadHeroItem(id);
    if (id && h !== hero && libItems[id]) libHero(libItems[id]);
    // After the hero has shown the card, since that redraws its buttons.
    var btn = h.querySelector('.ml-hero-btn');
    if (btn) btn.focus({ preventScroll: true });
    if (h === hero) alignHomeRow(hero);
  }
  // A page shown again from the history, after a title opened from the rows, gets its step back.
  function armBackStep() {
    if (!backStep && history.state && history.state.mlBack === 'hero' && activeHero()) armStep('hero', heroBack);
  }
  window.addEventListener('popstate', function () { setTimeout(armBackStep, 0); });
  window.addEventListener('hashchange', function () { if (backStep === heroBack) backStep = null; setTimeout(armBackStep, 300); });
  document.addEventListener('focusin', function (e) {
    var h = activeHero();
    if (!h || !e.target.closest) return;
    var onHero = (history.state || {}).mlBack === 'hero';
    if (h.contains(e.target)) {
      if (onHero) popBackStep();
      return;
    }
    var card = e.target.closest('.homeSectionsContainer .card[data-id], .ml-lib-card, .ml-lib-more');
    if (!card) return;
    heroCard = card;
    if (!onHero) pushBackStep('hero', heroBack);
  });

  // Back from a full tab returns to the landing and the tile that opened it.
  function libLanding() {
    root.classList.remove('ml-lib-all');
    if (!libLayer) return;
    var last = libLayer.last;
    (last && libLayer.el.contains(last) ? last : libLayer.track.querySelector('.ml-lib-card') || document.body).focus({ preventScroll: true });
  }

  // 15. TV header: only the clock stays on the right; OK on it opens a menu with what the header buttons did, plus Favourites, whose tab the hero home hides.
  var clockMenu = null;
  // The button that opened the menu when it is not the clock, such as the library page's Libraries button.
  var clockOwner = null;

  // popped: Back already took the history step; then: an item's action, run once the step is gone.
  function closeClockMenu(refocus, popped, then) {
    if (!clockMenu) return then && then();
    clockMenu.remove();
    clockMenu = null;
    var owner = clockOwner || document.querySelector('.skinHeader .currentTimeText');
    clockOwner = null;
    if (!popped) popBackStep(then);
    if (refocus && owner) owner.focus();
  }

  // The Libraries button on a library page, and the TV header's library button, open the clock menu's list with the libraries, under the button.
  function openLibraryMenu(btn, currentId) {
    var at = currentId || (libLayer && libLayer.lib);
    if (clockMenu || !libraries || !at) return;
    clockMenu = document.createElement('div');
    clockMenu.className = 'ml-clock-menu';
    var current = null;
    libraries.forEach(function (lib) {
      var on = lib.Id === at;
      var item = clockMenuItem(on ? 'check' : lib.CollectionType === 'movies' ? 'movie' : lib.CollectionType === 'tvshows' ? 'tv' : 'folder', lib.Name, function () { if (!on) location.hash = libraryLink(lib); });
      if (on) current = item;
      clockMenu.appendChild(item);
    });
    var at = btn.getBoundingClientRect();
    clockMenu.style.top = Math.round(at.bottom + 8) + 'px';
    clockMenu.style.left = Math.round(at.left) + 'px';
    document.body.appendChild(clockMenu);
    clockOwner = btn;
    (current || clockMenu.firstChild).focus();
    pushBackStep('menu', function () { closeClockMenu(true, true); });
  }

  function clockMenuItem(icon, label, act) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ml-clock-item';
    btn.innerHTML = '<span class="material-icons" aria-hidden="true">' + icon + '</span><span></span>';
    btn.lastChild.textContent = label;
    btn.addEventListener('click', function () { closeClockMenu(false, false, act); });
    return btn;
  }

  function openClockMenu(clockEl) {
    var header = clockEl.closest('.headerRight');
    if (!header || clockMenu) return;
    // The stock buttons stay in the header, hidden, and the menu presses them, so SyncPlay, Search and the profile keep Jellyfin's own behaviour.
    var press = function (sel) { return function () { var b = header.querySelector(sel); if (b) b.click(); }; };
    clockMenu = document.createElement('div');
    clockMenu.className = 'ml-clock-menu';
    clockMenu.appendChild(clockMenuItem('search', 'Search', press('.headerSearchButton')));
    clockMenu.appendChild(clockMenuItem('favorite', 'Favourites', function () { location.hash = '#/home?tab=1'; }));
    var sync = header.querySelector('.headerSyncButton');
    if (sync && !sync.classList.contains('hide')) clockMenu.appendChild(clockMenuItem('groups', sync.title || 'SyncPlay', press('.headerSyncButton')));
    var user = header.querySelector('.headerUserButton');
    if (user) clockMenu.appendChild(clockMenuItem('person', user.title || 'Profile', press('.headerUserButton')));
    if (inBrowser()) clockMenu.appendChild(clockMenuItem('computer', 'Desktop layout', function () { setLayout('desktop'); }));
    // The header clips what overflows it, so the menu hangs from the page body, placed under the clock.
    var at = clockEl.getBoundingClientRect();
    clockMenu.style.top = Math.round(at.bottom + 8) + 'px';
    clockMenu.style.right = Math.round(window.innerWidth - at.right) + 'px';
    document.body.appendChild(clockMenu);
    clockMenu.firstChild.focus();
    pushBackStep('menu', function () { closeClockMenu(true, true); });
  }

  // 16. Layout switch, browser only: in the TV or phone app a desktop layout would leave the remote stranded.
  // The LG app runs in the TV's own browser with no native shell, and its Magic Remote counts as a fine pointer, so TVs are told apart by name.
  function inBrowser() { return !window.NativeShell && window.matchMedia('(pointer: fine)').matches && !/SmartTV|Web0S|NetCast|Tizen|BRAVIA|AFT\w|Android TV/i.test(navigator.userAgent); }

  // Display settings keep the layout in the same key and apply it on load.
  function setLayout(name) {
    localStorage.setItem('layout', name);
    location.reload();
  }

  // A clone of a menu row with its own icon, label and click, for rows the script adds to a React menu.
  function menuRow(template, icon, text, onClick) {
    var item = template.cloneNode(true);
    item.removeAttribute('href');
    item.setAttribute('role', 'menuitem');
    var svg = item.querySelector('svg');
    if (svg) svg.outerHTML = '<span class="material-icons" aria-hidden="true">' + icon + '</span>';
    var label = item.querySelector('.MuiListItemText-root span, .MuiTypography-root');
    if (label) label.textContent = text;
    item.addEventListener('click', function (e) { e.preventDefault(); onClick(); });
    return item;
  }

  // The desktop user menu mounts on open, so its rows are added each time: SyncPlay and Cast, which the top bar no longer shows, on top, and a TV layout item beside Settings.
  function enhanceUserMenu() {
    if (!isDesktop()) return;
    var settings = document.querySelector('.MuiMenu-paper a[href*="mypreferencesmenu"]');
    if (!settings) return;
    var list = settings.parentNode;
    if (inBrowser() && !list.querySelector('.ml-layout-item')) {
      var layout = menuRow(settings, 'tv', 'TV layout', function () { setLayout('tv'); });
      layout.classList.add('ml-layout-item');
      settings.after(layout);
    }
    var devices = [].slice.call(document.querySelectorAll('.MuiAppBar-root .ml-device-btn'));
    if (!devices.length || list.querySelector('.ml-device-item')) return;
    var divider = list.querySelector('hr');
    var rows = devices.map(function (btn) {
      var name = btn.getAttribute('aria-label') || btn.title;
      var row = menuRow(settings, /cast/i.test(name) ? 'cast' : 'group', name, function () {
        var backdrop = document.querySelector('.MuiPopover-root .MuiBackdrop-root');
        if (backdrop) backdrop.click();
        setTimeout(function () { btn.click(); }, 150);
      });
      row.classList.add('ml-device-item');
      return row;
    });
    if (divider) rows.push(divider.cloneNode(true));
    rows.reverse().forEach(function (row) { list.insertBefore(row, list.firstChild); });
  }

  // Desktop top bar: the library links sit under one Libraries button, and SyncPlay and Cast hide (the user menu holds them).
  var libsMenu = null;
  function closeLibsMenu() {
    if (!libsMenu) return;
    libsMenu.remove();
    libsMenu = null;
  }
  function openLibsMenu(btn, links) {
    closeLibsMenu();
    var menu = document.createElement('div');
    menu.className = 'ml-libs-menu';
    menu.setAttribute('role', 'menu');
    links.forEach(function (link) {
      var a = document.createElement('a');
      a.setAttribute('role', 'menuitem');
      a.href = link.getAttribute('href') || '#';
      var svg = link.querySelector('svg');
      if (svg) a.appendChild(svg.cloneNode(true));
      a.appendChild(document.createTextNode(link.textContent.trim()));
      a.addEventListener('click', closeLibsMenu);
      menu.appendChild(a);
    });
    var r = btn.getBoundingClientRect();
    menu.style.left = Math.round(r.left) + 'px';
    menu.style.top = Math.round(r.bottom + 4) + 'px';
    document.body.appendChild(menu);
    libsMenu = menu;
    if (menu.firstChild) menu.firstChild.focus();
  }
  document.addEventListener('click', function (e) {
    if (libsMenu && !libsMenu.contains(e.target) && !(e.target.closest && e.target.closest('.ml-libs-btn'))) closeLibsMenu();
  }, true);
  window.addEventListener('hashchange', closeLibsMenu);
  window.addEventListener('keydown', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('.ml-libs-btn');
    if (btn && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); btn.click(); return; }
    if (!libsMenu) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeLibsMenu();
      var opener = document.querySelector('.ml-libs-btn');
      if (opener) opener.focus();
      return;
    }
    var down = e.key === 'ArrowDown', up = e.key === 'ArrowUp';
    if (!down && !up) return;
    e.preventDefault();
    var items = [].slice.call(libsMenu.children);
    var next = items[items.indexOf(document.activeElement) + (down ? 1 : -1)];
    if (next) next.focus();
  }, true);

  function enhanceTopBar() {
    if (!isDesktop()) { closeLibsMenu(); return; }
    var bar = document.querySelector('.MuiAppBar-root .MuiToolbar-root');
    var stack = bar && bar.querySelector('.MuiStack-root');
    if (!stack) return;
    [].forEach.call(bar.querySelectorAll('button.MuiIconButton-root'), function (b) {
      if (/syncplay|cast/i.test(b.getAttribute('aria-label') || b.title || '')) b.classList.add('ml-device-btn');
    });
    var links = [].slice.call(stack.children).filter(function (a) { return a.tagName === 'A' && !a.classList.contains('ml-libs-btn'); });
    // The logo and Favourites stay; the rest are the libraries.
    var libs = links.slice(2);
    if (!libs.length) return;
    libs.forEach(function (a) { a.classList.add('ml-lib-link'); });
    if (stack.querySelector('.ml-libs-btn')) return;
    var btn = links[1].cloneNode(false);
    btn.removeAttribute('href');
    btn.className = links[1].className + ' ml-libs-btn';
    btn.setAttribute('role', 'button');
    btn.setAttribute('aria-haspopup', 'menu');
    btn.tabIndex = 0;
    btn.innerHTML = '<span class="material-icons" aria-hidden="true">video_library</span>Libraries<span class="material-icons" aria-hidden="true">expand_more</span>';
    btn.addEventListener('click', function () {
      if (libsMenu) closeLibsMenu(); else openLibsMenu(btn, [].slice.call(stack.querySelectorAll('.ml-lib-link')));
    });
    links[1].after(btn);
  }

  function enhanceClock() {
    var clockEl = document.querySelector('.skinHeader .currentTimeText');
    if (!clockEl) return;
    var on = isTv();
    if (on === clockEl.classList.contains('ml-clock-btn')) return;
    clockEl.classList.toggle('ml-clock-btn', on);
    clockEl.classList.toggle('focusable', on);
    // The CSS hides the header buttons only under this class, so a device with an older or no script keeps them.
    root.classList.toggle('ml-clock-on', on);
    if (on) {
      clockEl.tabIndex = 0;
      clockEl.setAttribute('role', 'button');
    } else {
      clockEl.removeAttribute('tabindex');
      clockEl.removeAttribute('role');
      closeClockMenu(false);
    }
  }

  // The menu is a vertical list inside a header that only moves sideways, so its keys are handled here.
  window.addEventListener('keydown', function (e) {
    var el = document.activeElement;
    var enter = e.key === 'Enter' || e.keyCode === 13;
    if (enter && el && el.classList && el.classList.contains('ml-clock-btn')) {
      e.preventDefault();
      e.stopPropagation();
      if (clockMenu) closeClockMenu(true); else openClockMenu(el);
      return;
    }
    if (!clockMenu || !clockMenu.contains(el)) return;
    var back = e.key === 'Escape' || e.key === 'Backspace' || e.keyCode === 461;
    var up = e.key === 'ArrowUp' || e.keyCode === 38;
    var down = e.key === 'ArrowDown' || e.keyCode === 40;
    if (!back && !up && !down && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    e.stopPropagation();
    if (back) return closeClockMenu(true);
    var items = [].slice.call(clockMenu.children);
    var next = items[items.indexOf(el) + (down ? 1 : up ? -1 : 0)];
    if (next) next.focus();
  }, true);

  document.addEventListener('click', function (e) {
    var clockEl = e.target.closest && e.target.closest('.ml-clock-btn');
    if (clockEl) { if (clockMenu) closeClockMenu(false); else openClockMenu(clockEl); return; }
    if (clockMenu && !clockMenu.contains(e.target) && !(clockOwner && clockOwner.contains(e.target))) closeClockMenu(false);
  });

  document.addEventListener('focusin', function (e) {
    if (clockMenu && !clockMenu.contains(e.target) && e.target !== clockOwner && !(e.target.classList && e.target.classList.contains('ml-clock-btn'))) closeClockMenu(false);
  });
  window.addEventListener('hashchange', function () { closeClockMenu(false); });

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

  // 12.x rejects the api_key URL parameter, so each frame sheet is fetched with the auth header and shown from a blob URL.
  var sheetCache = {};

  function sheetUrl(id, t, tile) {
    var key = id + '/' + t.width + '/' + tile;
    if (sheetCache[key]) return sheetCache[key];
    var api = window.ApiClient;
    var url = api.getUrl('Videos/' + id + '/Trickplay/' + t.width + '/' + tile + '.jpg', { MediaSourceId: t.source });
    sheetCache[key] = fetch(url, { headers: { Authorization: 'MediaBrowser Token="' + api.accessToken() + '"' } })
      .then(function (res) { if (!res.ok) throw new Error(res.status); return res.blob(); })
      .then(function (blob) { return URL.createObjectURL(blob); })
      .catch(function () { delete sheetCache[key]; return null; });
    return sheetCache[key];
  }

  var hover = null;
  // The strip's share of the picture height; matches .ml-trick-strip in the CSS.
  var STRIP = 0.16;

  function endHover() {
    if (!hover) return;
    clearTimeout(hover.timer);
    hover.card.removeEventListener('mousemove', onMove);
    hover.card.removeEventListener('mouseleave', endHover);
    var layers = hover.card.querySelectorAll('.ml-trick, .ml-trick-none');
    for (var i = 0; i < layers.length; i++) layers[i].remove();
    hover.card.classList.remove('ml-scrubbing');
    hover = null;
  }

  function onMove(e) {
    if (!hover) return;
    var box = hover.card.querySelector('.cardScalable');
    if (!box) return;
    var r = box.getBoundingClientRect();
    // Only the strip scrubs; the rest of the picture holds the frame, so the pointer can reach Play and More.
    if (e.clientY - r.top < r.height * (1 - STRIP)) return;
    hover.frac = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    if (hover.trick) draw();
  }

  // Paints frame `index` onto `el`. Every sheet is the full grid, the last one padded with black, so the grid size never changes.
  function paintFrame(el, index) {
    var t = hover.trick;
    var info = t.info;
    var cols = info.TileWidth;
    var rows = info.TileHeight;
    var perTile = cols * rows;
    var k = index % perTile;
    var col = k % cols;
    var row = Math.floor(k / cols);
    var mine = hover;
    el.setAttribute('data-frame', index);
    sheetUrl(hover.card.dataset.id, t, Math.floor(index / perTile)).then(function (url) {
      if (hover !== mine || el.getAttribute('data-frame') !== String(index)) return;
      if (!url) { mine.card.querySelectorAll('.ml-trick').forEach(function (n) { n.remove(); }); return markNoPreview(mine.card); }
      el.style.backgroundImage = 'url("' + url + '")';
    });
    el.style.backgroundSize = (cols * 100) + '% ' + (rows * 100) + '%';
    el.style.backgroundPosition = (cols > 1 ? col / (cols - 1) * 100 : 0) + '% ' + (rows > 1 ? row / (rows - 1) * 100 : 0) + '%';
  }

  // The chosen frame fills the picture; a strip of three runs along the bottom, the current one ringed between its neighbours.
  function draw() {
    var count = hover.trick.info.ThumbnailCount;
    var index = Math.min(count - 1, Math.floor(hover.frac * count));
    var host = hover.card.querySelector('.cardImageContainer');
    if (!host) return;
    var layer = host.querySelector('.ml-trick');
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'ml-trick';
      layer.innerHTML = '<div class="ml-trick-strip">' + '<span></span>'.repeat(3) + '</div>';
      host.appendChild(layer);
      hover.card.classList.add('ml-scrubbing');
    }
    paintFrame(layer, index);
    var minis = layer.querySelectorAll('.ml-trick-strip span');
    for (var i = 0; i < minis.length; i++) {
      var n = index + i - 1;
      minis[i].style.visibility = n < 0 || n >= count ? 'hidden' : '';
      minis[i].className = i === 1 ? 'ml-now' : '';
      if (n >= 0 && n < count) paintFrame(minis[i], n);
    }
  }

  // Without frames the pointer would do nothing, so the picture says why.
  function markNoPreview(card) {
    var host = card.querySelector('.cardImageContainer');
    if (!host || host.querySelector('.ml-trick-none')) return;
    var chip = document.createElement('div');
    chip.className = 'ml-trick-none';
    chip.textContent = 'No preview';
    host.appendChild(chip);
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
        if (hover !== mine) return;
        if (!t) return markNoPreview(card);
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
