// Progressive enhancement: the original HTTPS links work without JavaScript.
(() => {
  const dialog = document.querySelector('#article-reader');
  if (!dialog || typeof dialog.showModal !== 'function') return;

  const title = dialog.querySelector('#reader-title');
  const source = dialog.querySelector('#reader-source');
  const external = dialog.querySelector('#reader-external');
  const viewport = dialog.querySelector('#reader-viewport');
  const close = dialog.querySelector('#reader-close');
  let trigger;
  let backdropPress = false;

  document.querySelectorAll('main a[href^="https://"]').forEach(link => {
    link.setAttribute('aria-haspopup', 'dialog');
    link.setAttribute('aria-controls', 'article-reader');
    link.addEventListener('click', event => {
      // Preserve the browser's open-in-new-tab and context-menu behavior.
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const url = new URL(link.href);
      if (url.protocol !== 'https:' || url.origin === location.origin) return;
      event.preventDefault();
      if (dialog.open) return;
      trigger = link;
      title.textContent = link.closest('.study')?.querySelector('.original')?.textContent || link.textContent.replace('↗', '').trim();
      source.textContent = url.hostname.replace(/^www\./, '');
      external.href = url.href;
      const frame = document.createElement('iframe');
      frame.title = 'Originalkälla: ' + title.textContent;
      frame.referrerPolicy = 'no-referrer';
      // Do not proxy content or circumvent the publisher's embedding policy.
      // Native PDF viewers are not compatible with an iframe sandbox.
      // These are the original, curated HTTPS PDF links; no proxy is involved.
      if (!/\.pdf$/i.test(url.pathname)) {
        frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox');
      }
      frame.src = url.href;
      viewport.replaceChildren(frame);
      document.documentElement.classList.add('reader-open');
      dialog.showModal();
      close.focus({ preventScroll: true });
    });
  });

  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    // Remove the frame to stop playback, requests and stale content on reopening.
    viewport.replaceChildren();
    document.documentElement.classList.remove('reader-open');
    backdropPress = false;
    trigger?.focus({ preventScroll: true });
  });
  const outside = event => {
    const rect = dialog.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  };
  dialog.addEventListener('pointerdown', event => { backdropPress = event.target === dialog && outside(event); });
  dialog.addEventListener('click', event => {
    if (backdropPress && event.target === dialog && outside(event)) dialog.close();
    backdropPress = false;
  });
})();
