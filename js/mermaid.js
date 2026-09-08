/* global Fluid, mermaid */
Fluid.initMermaid = function(options, autoTheme) {
  if (Fluid.mermaidReady) { return; }
  Fluid.mermaidReady = true;
  var originals = new WeakMap();
  var rendered = new WeakMap();
  var running = false;
  var pending = false;
  var root = document.documentElement;
  options = options || {};

  function scheme() {
    return root.getAttribute('data-user-color-scheme') ||
      getComputedStyle(root).getPropertyValue('--color-mode').replace(/["'\s]/g, '') || 'light';
  }

  async function refresh() {
    pending = true;
    if (running) { return; }
    running = true;
    try {
      while (pending) {
        pending = false;
        var theme = autoTheme && scheme() === 'dark' ? 'dark' : (options.theme || 'default');
        var nodes = Array.from(document.querySelectorAll('.mermaid'));
        nodes = nodes.filter(function(node) {
          if (!originals.has(node)) {
            if (node.querySelector('svg')) { return false; }
            originals.set(node, node.textContent);
            if (autoTheme && node.parentElement && node.parentElement.tagName === 'PRE') {
              node.parentElement.classList.add('fluid-mermaid');
            }
          }
          return rendered.get(node) !== theme;
        });
        if (!nodes.length) { continue; }
        mermaid.initialize(Object.assign({}, options, { startOnLoad: false, theme: theme }));
        for (var node of nodes) {
          // Restore text safely; never treat diagram source as page HTML.
          node.textContent = originals.get(node);
          node.removeAttribute('data-processed');
          try {
            if (typeof mermaid.run === 'function') {
              await mermaid.run({ nodes: [node] });
            } else {
              await Promise.resolve(mermaid.init(undefined, node));
            }
            rendered.set(node, theme);
          } catch (error) {
            node.textContent = originals.get(node);
            node.removeAttribute('data-processed');
            console.error('Mermaid diagram could not render:', error);
          }
        }
      }
    } finally {
      running = false;
    }
  }

  // Disable Mermaid's automatic pass so source is captured before SVG replaces it.
  mermaid.initialize(Object.assign({}, options, { startOnLoad: false }));
  Fluid.utils.listenDOMLoaded(function() {
    if (autoTheme) {
      new MutationObserver(refresh).observe(root, {
        attributes: true, attributeFilter: ['data-user-color-scheme', 'data-default-color-scheme']
      });
      var media = window.matchMedia('(prefers-color-scheme: dark)');
      if (media.addEventListener) { media.addEventListener('change', refresh); }
      else if (media.addListener) { media.addListener(refresh); }
    }
    Fluid.events.registerRefreshCallback(refresh);
    refresh();
  });
};
