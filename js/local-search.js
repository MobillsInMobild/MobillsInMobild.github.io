/* global CONFIG */
(function() {
  'use strict';
  var $modal = jQuery('#modalSearch');
  var $input = jQuery('#local-search-input');
  var $result = jQuery('#local-search-result');
  var $status = jQuery('#local-search-status');
  if (!$modal.length || !$input.length || $modal.data('fluid-search-ready')) { return; }
  $modal.data('fluid-search-ready', true);

  var labels = Object.assign({
    loading: 'Loading search index…',
    prompt: 'Enter keywords to search articles.',
    error: 'Search could not load. Please try again.',
    retry: 'Retry',
    empty: 'No matching articles.',
    count: '{count} matching articles',
    more: 'Show more'
  }, CONFIG.ui && CONFIG.ui.search);
  var dataList = null;
  var request = null;
  var failed = false;
  var open = false;
  var composing = false;
  var timer;
  var matches = [];
  var shown = 0;
  var highlightPattern = null;
  var pageSize = 20;

  function setStatus(text, busy) {
    $status.text(text);
    $result.attr('aria-busy', busy ? 'true' : 'false');
  }

  function highlight(element, text) {
    if (!highlightPattern) {
      element.textContent = text;
      return;
    }
    highlightPattern.lastIndex = 0;
    var cursor = 0;
    var match;
    while ((match = highlightPattern.exec(text)) !== null) {
      element.appendChild(document.createTextNode(text.slice(cursor, match.index)));
      var mark = document.createElement('span');
      mark.className = 'search-word';
      mark.textContent = match[0];
      element.appendChild(mark);
      cursor = match.index + match[0].length;
    }
    element.appendChild(document.createTextNode(text.slice(cursor)));
  }

  function appendResults() {
    $result.find('.search-more').remove();
    var end = Math.min(shown + pageSize, matches.length);
    var fragment = document.createDocumentFragment();
    for (; shown < end; shown++) {
      var match = matches[shown];
      var link = document.createElement('a');
      link.href = match.data.url;
      link.className = 'search-list-title';
      var item = document.createElement('div');
      item.className = 'search-item';
      highlight(link, match.data.title);
      item.appendChild(link);
      fragment.appendChild(item);
      if (match.data.content) {
        var start = Math.max(0, match.first - 20);
        var excerpt = match.data.content.slice(start, start + 120);
        var p = document.createElement('p');
        p.className = 'search-list-content';
        highlight(p, (start ? '…' : '') + excerpt + (start + 120 < match.data.content.length ? '…' : ''));
        item.appendChild(p);
      }
    }
    $result[0].appendChild(fragment);
    if (shown < matches.length) {
      jQuery('<button>', { type: 'button', class: 'btn search-action search-more' })
        .text(labels.more).appendTo($result);
    }
  }

  function search() {
    clearTimeout(timer);
    if (!open || composing || !dataList) { return; }
    var query = $input.val().trim().toLowerCase();
    $result.empty();
    $input.removeClass('invalid valid');
    matches = [];
    shown = 0;
    if (!query) {
      setStatus(labels.prompt, false);
      return;
    }
    var keywords = Array.from(new Set(query.split(/\s+/)));
    highlightPattern = new RegExp(keywords.slice().sort(function(a, b) {
      return b.length - a.length;
    }).map(function(word) {
      return word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('|'), 'gi');

    dataList.forEach(function(data, order) {
      var score = data.lowerTitle.indexOf(query) !== -1 ? 100 : 0;
      var first = -1;
      var matched = keywords.every(function(keyword) {
        var inTitle = data.lowerTitle.indexOf(keyword);
        var inContent = data.lowerContent.indexOf(keyword);
        if (inTitle === -1 && inContent === -1) { return false; }
        if (inTitle !== -1) { score += 10; }
        if (inContent !== -1 && (first === -1 || inContent < first)) { first = inContent; }
        return true;
      });
      if (matched) { matches.push({ data: data, score: score, first: Math.max(first, 0), order: order }); }
    });
    matches.sort(function(a, b) { return b.score - a.score || a.order - b.order; });
    setStatus(matches.length ? labels.count.replace('{count}', matches.length) : labels.empty, false);
    if (matches.length) {
      appendResults();
    }
  }

  function showFailure() {
    $result.empty();
    setStatus(labels.error, false);
    jQuery('<button>', { type: 'button', class: 'btn search-action search-retry' })
      .text(labels.retry).appendTo($result);
  }

  function loadIndex() {
    if (dataList) { search(); return; }
    if (request) { setStatus(labels.loading, true); return; }
    failed = false;
    $result.empty();
    setStatus(labels.loading, true);
    request = jQuery.ajax({
      url: CONFIG.search_path || '/local-search.xml',
      dataType: 'xml',
      timeout: 15000
    }).done(function(xml) {
      dataList = jQuery('entry', xml).map(function() {
        var title = jQuery('title', this).text().trim() || 'Untitled';
        var content = CONFIG.include_content_in_search
          ? jQuery('content', this).text().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
          : '';
        var url;
        try {
          url = new URL(jQuery('url', this).text(), window.location.href);
        } catch (error) { return null; }
        if (url.protocol !== 'http:' && url.protocol !== 'https:') { return null; }
        return { title: title, content: content, url: url.href,
          lowerTitle: title.toLowerCase(), lowerContent: content.toLowerCase() };
      }).get();
      if (open) {
        setStatus(labels.prompt, false);
        search();
      }
    }).fail(function() {
      failed = true;
      if (open) { showFailure(); }
    }).always(function() { request = null; });
  }

  $input.on('compositionstart.fluidSearch', function() {
    composing = true;
    clearTimeout(timer);
  }).on('compositionend.fluidSearch', function() {
    composing = false;
    search();
  }).on('input.fluidSearch', function(event) {
    clearTimeout(timer);
    if (composing || (event.originalEvent && event.originalEvent.isComposing)) { return; }
    if (failed) { return; }
    timer = setTimeout(search, 180);
  });
  // Use native link focus: Enter activates the link and Tab remains available.
  $modal.on('keydown.fluidSearch', function(event) {
    if (composing || event.isComposing || (event.originalEvent && event.originalEvent.isComposing) ||
        event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) { return; }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') { return; }
    var links = $result.find('.search-list-title');
    var index = links.index(event.target);
    if (event.target !== $input[0] && index < 0) { return; }
    if (!links.length) { return; }
    event.preventDefault();
    var next = event.key === 'ArrowDown' ? index + 1 : index - 1;
    if (next < 0) { $input.trigger('focus'); return; }
    var target = links[Math.min(next, links.length - 1)];
    target.focus();
    if (target.scrollIntoView) { target.scrollIntoView({ block: 'nearest' }); }
  });
  $result.on('click.fluidSearch', '.search-retry', loadIndex);
  $result.on('click.fluidSearch', '.search-more', function() {
    var previous = shown;
    appendResults();
    $result.find('.search-list-title').eq(previous).trigger('focus');
  });
  $modal.on('show.bs.modal', function() {
    open = true;
    loadIndex();
  }).on('shown.bs.modal', function() {
    $input.trigger('focus');
  }).on('hidden.bs.modal', function() {
    open = false;
    composing = false;
    clearTimeout(timer);
    $input.val('').removeClass('invalid valid');
    $result.empty();
    setStatus('', false);
  });
})();
