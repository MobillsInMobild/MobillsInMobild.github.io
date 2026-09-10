/* global Fluid, CONFIG */

(function(window, document) {
  for (const each of document.querySelectorAll('img[lazyload]')) {
    Fluid.utils.waitElementVisible(each, function() {
      const responsiveSrcset = each.dataset.fluidSrcset;
      if (responsiveSrcset) {
        each.setAttribute('srcset', responsiveSrcset);
        delete each.dataset.fluidSrcset;
      } else {
        each.removeAttribute('srcset');
      }
      each.removeAttribute('lazyload');
    }, CONFIG.lazyload.offset_factor);
  }
})(window, document);
