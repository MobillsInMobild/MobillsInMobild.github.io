/* global Fluid, CONFIG */
(function() {
  'use strict';
  var $toc = jQuery('#toc');
  if (!$toc.length || $toc.data('fluid-toc-ready')) { return; }
  $toc.data('fluid-toc-ready', true);
  var $home = $toc.parent();
  var $body = jQuery('#toc-body');
  var $button = jQuery('#mobile-toc-toggle').appendTo(document.body);
  var $modal = jQuery('#mobile-toc-dialog').appendTo(document.body);
  var pendingHeading = null;
  var pendingHash = '';
  var manualState = Object.create(null);
  var labels = Object.assign({ tocExpand: 'Expand section', tocCollapse: 'Collapse section' }, CONFIG.ui);

  function mobile() { return window.innerWidth < 992; }
  function expandAllEnabled() { return CONFIG.toc && CONFIG.toc.expand_all === true; }

  function updateToggle($li, $list) {
    var $toggle = $li.children('button.toc-toggle');
    if (!$toggle.length) { return; }
    var collapsed = $list.hasClass('tocbot-is-collapsed');
    var title = $li.children('a.tocbot-link').text();
    $toggle.toggleClass('toc-toggle-collapsed', collapsed)
      .toggleClass('toc-toggle-expanded', !collapsed)
      .attr('aria-expanded', String(!collapsed))
      .attr('aria-label', (collapsed ? labels.tocExpand : labels.tocCollapse) + ': ' + title);
  }

  function updateCurrent() {
    $body.find('a.tocbot-link').each(function() {
      if (this.classList.contains('tocbot-active-link')) {
        this.setAttribute('aria-current', 'location');
      } else {
        this.removeAttribute('aria-current');
      }
    });
  }

  function decorate() {
    var $items = $body.find('.toc-list-item');
    $toc.css('visibility', $items.length ? 'visible' : 'hidden');
    $button.prop('hidden', !$items.length);
    if (expandAllEnabled()) {
      $body.find('.tocbot-is-collapsed').removeClass('tocbot-is-collapsed');
      $items.each(function(index) {
        var $li = jQuery(this);
        var $list = $li.children('ol');
        if (!$list.length) {
          if (!$li.children('.toc-toggle').length) {
            $li.prepend('<span class="toc-toggle toc-toggle-placeholder" aria-hidden="true">›</span>');
          }
          return;
        }
        var id = 'toc-section-' + index;
        var key = $li.children('a.tocbot-link').attr('href');
        $list.attr('id', id);
        if (Object.prototype.hasOwnProperty.call(manualState, key)) {
          $list.toggleClass('tocbot-is-collapsed', manualState[key]);
        }
        if (!$li.children('button.toc-toggle').length) {
          $li.children('.toc-toggle').remove();
          $li.prepend(jQuery('<button>', { type: 'button', class: 'toc-toggle',
            'aria-controls': id }).text('›'));
        }
        updateToggle($li, $list);
      });
    }
    updateCurrent();
  }

  $body.on('click.fluidToc', 'button.toc-toggle', function(event) {
    event.preventDefault();
    event.stopPropagation();
    var $li = jQuery(this).parent();
    var $list = $li.children('ol');
    $list.toggleClass('tocbot-is-collapsed');
    manualState[$li.children('a.tocbot-link').attr('href')] = $list.hasClass('tocbot-is-collapsed');
    updateToggle($li, $list);
  });

  $button.on('click.fluidToc', function() {
    if (mobile()) { $modal.modal('show'); }
  });
  $modal.on('show.bs.modal', function() {
    $toc.appendTo($modal.find('.modal-body'));
    $button.attr('aria-expanded', 'true');
  }).on('shown.bs.modal', function() {
    var active = $body.find('a.tocbot-active-link')[0] || $body.find('a.tocbot-link')[0];
    if (active) {
      active.focus();
      if (active.scrollIntoView) { active.scrollIntoView({ block: 'nearest' }); }
    }
  }).on('hidden.bs.modal', function() {
    $toc.appendTo($home);
    $button.attr('aria-expanded', 'false');
    if (pendingHeading) {
      var heading = pendingHeading;
      var hash = pendingHash;
      pendingHeading = null;
      pendingHash = '';
      // Bootstrap must release the page scroll lock before moving to a heading.
      Fluid.utils.scrollToElement(heading, -(jQuery('#navbar').outerHeight() || 0) - 12);
      if (window.location.hash !== hash) { window.history.pushState(null, '', hash); }
      if (!heading.hasAttribute('tabindex')) {
        heading.setAttribute('tabindex', '-1');
        heading.addEventListener('blur', function() { heading.removeAttribute('tabindex'); }, { once: true });
      }
      heading.focus({ preventScroll: true });
    } else if (mobile()) {
      $button.trigger('focus');
    }
  });
  // Handle mobile navigation before tocbot's delegated smooth-scroll listener.
  $modal[0].addEventListener('click', function(event) {
    var link = event.target.closest('a.tocbot-link');
    if (!link || !$modal.hasClass('show')) { return; }
    var id;
    try { id = decodeURIComponent(link.hash.slice(1)); } catch (error) { return; }
    var heading = document.getElementById(id);
    if (!heading) { return; }
    event.preventDefault();
    event.stopPropagation();
    pendingHeading = heading;
    pendingHash = link.hash;
    $modal.modal('hide');
  }, true);

  jQuery(window).on('resize.fluidToc', function() {
    if (!mobile() && $modal.hasClass('show')) { $modal.modal('hide'); }
  });

  Fluid.utils.createScript($toc.attr('data-toc-script'), function() {
    if (!window.tocbot) { return; }
    var board = jQuery('#board-ctn');
    var config = Object.assign({
      tocSelector: '#toc-body',
      contentSelector: '.markdown-body',
      linkClass: 'tocbot-link',
      activeLinkClass: 'tocbot-active-link',
      listClass: 'tocbot-list',
      isCollapsedClass: 'tocbot-is-collapsed',
      collapsibleClass: 'tocbot-is-collapsible',
      scrollSmooth: true,
      includeTitleTags: true,
      headingsOffset: board.length ? -board.offset().top : 0
    }, CONFIG.toc);
    if (Fluid.utils.prefersReducedMotion()) { config.scrollSmooth = false; }
    if (expandAllEnabled()) { config.collapseDepth = 6; }
    window.tocbot.init(config);
    decorate();
    if ('MutationObserver' in window) {
      var observer = new MutationObserver(function(mutations) {
        var currentChanged = false;
        mutations.forEach(function(mutation) {
          var $target = jQuery(mutation.target);
          if ($target.is('ol')) {
            updateToggle($target.parent('.toc-list-item'), $target);
          } else if ($target.is('a.tocbot-link')) {
            currentChanged = true;
          }
        });
        if (currentChanged) { updateCurrent(); }
      });
      observer.observe($body[0], { attributes: true, attributeFilter: ['class'], subtree: true });
    }
    Fluid.events.registerRefreshCallback(function() {
      window.tocbot.refresh();
      decorate();
    });
  });
})();
