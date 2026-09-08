/* global Fluid, CONFIG */

HTMLElement.prototype.wrap = function(wrapper) {
  this.parentNode.insertBefore(wrapper, this);
  this.parentNode.removeChild(this);
  wrapper.appendChild(this);
};

Fluid.plugins = {

  typing: function(text) {
    var subtitle = document.getElementById('subtitle');
    if (!subtitle) { return; }
    if (Fluid.plugins._typed) { Fluid.plugins._typed.destroy(); Fluid.plugins._typed = null; }
    subtitle.textContent = text || '';
    if (!('Typed' in window) || Fluid.utils.prefersReducedMotion()) { return; }
    subtitle.textContent = '';
    var typed = new window.Typed('#subtitle', {
      strings: [text || ''],
      contentType: 'null',
      cursorChar: CONFIG.typing.cursorChar,
      typeSpeed: CONFIG.typing.typeSpeed,
      loop: CONFIG.typing.loop
    });
    Fluid.plugins._typed = typed;
  },

  fancyBox: function(selector) {
    if (!CONFIG.image_zoom.enable || !('fancybox' in jQuery)) { return; }

    jQuery(selector || '.markdown-body :not(a) > img, .markdown-body > img').each(function() {
      var $image = jQuery(this);
      var imageUrl = $image.attr('data-src') || $image.attr('src') || '';
      if (CONFIG.image_zoom.img_url_replace) {
        var rep = CONFIG.image_zoom.img_url_replace;
        var r1 = rep[0] || '';
        var r2 = rep[1] || '';
        if (r1) {
          if (/^re:/.test(r1)) {
            r1 = r1.replace(/^re:/, '');
            var reg = new RegExp(r1, 'gi');
            imageUrl = imageUrl.replace(reg, r2);
          } else {
            imageUrl = imageUrl.replace(r1, r2);
          }
        }
      }
      var $imageWrap = $image.wrap(`
        <a class="fancybox fancybox.image" href="${imageUrl}"
          itemscope itemtype="http://schema.org/ImageObject" itemprop="url"></a>`
      ).parent('a');
      if ($imageWrap.length !== 0) {
        if ($image.is('.group-image-container img')) {
          $imageWrap.attr('data-fancybox', 'group').attr('rel', 'group');
        } else {
          $imageWrap.attr('data-fancybox', 'default').attr('rel', 'default');
        }

        var imageTitle = $image.attr('title') || $image.attr('alt');
        if (imageTitle) {
          $imageWrap.attr('title', imageTitle).attr('data-caption', imageTitle);
        }
      }
    });

    jQuery.fancybox.defaults.hash = false;
    jQuery('.fancybox').fancybox({
      loop   : true,
      helpers: {
        overlay: {
          locked: false
        }
      }
    });
  },

  imageCaption: function(selector) {
    if (!CONFIG.image_caption.enable) { return; }

    jQuery(selector || `.markdown-body > p > img, .markdown-body > figure > img,
      .markdown-body > p > a.fancybox, .markdown-body > figure > a.fancybox`).each(function() {
      var $target = jQuery(this);
      var $figcaption = $target.next('figcaption');
      if ($figcaption.length !== 0) {
        $figcaption.addClass('image-caption');
      } else {
        var imageTitle = $target.attr('title') || $target.attr('alt');
        if (imageTitle) {
          $target.after(`<figcaption aria-hidden="true" class="image-caption">${imageTitle}</figcaption>`);
        }
      }
    });
  },

  codeWidget() {
    var enableLang = CONFIG.code_language.enable && CONFIG.code_language.default;
    var enableCopy = CONFIG.copy_btn && 'ClipboardJS' in window;
    if (!enableLang && !enableCopy) { return; }
    var labels = Object.assign({
      copy: 'Copy code', copied: 'Copied',
      copyFailed: 'Copy failed; select the code and copy manually.'
    }, CONFIG.ui);
    function getBgClass(ele) {
      return Fluid.utils.getBackgroundLightness(ele) >= 0 ? 'code-widget-light' : 'code-widget-dark';
    }
    jQuery('.markdown-body pre').each(function() {
      var $pre = jQuery(this);
      if (($pre.find('code.mermaid').length || (!$pre.hasClass('shiki') && $pre.find('span.line').length)) || $pre.children('.code-widget').length) { return; }
      var lang = '';
      if (enableLang) {
        lang = CONFIG.code_language.default;
        if ($pre[0].children.length > 0 && $pre[0].children[0].classList.length >= 2 && $pre.children().hasClass('hljs')) {
          lang = $pre[0].children[0].classList[1];
        } else if ($pre[0].getAttribute('data-language')) {
          lang = $pre[0].getAttribute('data-language');
        } else if ($pre.parent().hasClass('sourceCode') && $pre[0].children.length > 0 && $pre[0].children[0].classList.length >= 2) {
          lang = $pre[0].children[0].classList[1];
          $pre.parent().addClass('code-wrapper');
        } else if ($pre.parent().hasClass('markdown-body') && $pre[0].classList.length === 0) {
          $pre.wrap('<div class="code-wrapper"></div>');
        }
        lang = lang.toUpperCase().replace('NONE', CONFIG.code_language.default);
      }
      var $widget = jQuery(enableCopy ? '<button type="button">' : '<div>')
        .addClass('code-widget ' + getBgClass($pre[0]));
      if (enableCopy) {
        $widget.addClass('copy-btn').attr({ 'aria-label': labels.copy, title: labels.copy })
          .append(jQuery('<i>', { class: 'iconfont icon-copy', 'aria-hidden': 'true' }));
      }
      $widget.append(jQuery('<span>', { class: 'code-widget-label', 'aria-hidden': 'true' }).text(lang));
      $pre.append($widget);
    });
    if (!enableCopy || Fluid.plugins._clipboard) { return; }
    var $status = jQuery('#code-copy-status');
    if (!$status.length) {
      $status = jQuery('<div>', { id: 'code-copy-status', class: 'sr-only', role: 'status',
        'aria-live': 'polite', 'aria-atomic': 'true' }).appendTo(document.body);
    }
    var clipboard = new window.ClipboardJS('.copy-btn', {
      text: function(trigger) {
        var pre = trigger.parentNode.cloneNode(true);
        Array.from(pre.querySelectorAll('.code-widget')).forEach(function(widget) { widget.remove(); });
        return pre.textContent;
      }
    });
    Fluid.plugins._clipboard = clipboard;
    function feedback(event, success) {
      var button = event.trigger;
      var $button = jQuery(button);
      clearTimeout(button._fluidCopyTimer);
      $button.attr({ title: success ? labels.copied : labels.copyFailed,
        'aria-label': success ? labels.copied : labels.copyFailed });
      $button.find('i').toggleClass('icon-copy', !success).toggleClass('icon-success', success);
      $button.attr('data-copy-state', success ? 'success' : 'error');
      $status.text(success ? labels.copied : labels.copyFailed);
      button._fluidCopyTimer = setTimeout(function() {
        $button.attr({ title: labels.copy, 'aria-label': labels.copy });
        $button.find('i').removeClass('icon-success').addClass('icon-copy');
        $button.removeAttr('data-copy-state');
        $status.text('');
      }, success ? 2000 : 5000);
    }
    clipboard.on('success', function(event) { event.clearSelection(); feedback(event, true); });
    clipboard.on('error', function(event) { feedback(event, false); });
  }
};
