// Runs only from the client-side copy action. The live document is never hidden or altered.
async function captureConsultation(root: HTMLElement): Promise<Blob> {
  const { toBlob } = await import('html-to-image');
  await document.fonts.ready;
  const clone = root.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('[data-capture-ignore="true"]').forEach(node => node.remove());
  clone.querySelectorAll<HTMLElement>('[data-capture-text="true"]').forEach(node => {
    node.style.setProperty('display', 'block', 'important');
  });
  // Layout the document at its current width, with no viewport-height limit.
  const width = Math.ceil(root.getBoundingClientRect().width);
  const host = document.createElement('div');
  host.className = 'consultationPage';
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = `position:fixed;left:-100000px;top:0;width:${width}px;pointer-events:none;`;
  clone.style.cssText += `;box-sizing:border-box;width:${width}px;max-width:none;margin:0;display:block;height:auto;max-height:none;overflow:visible;`;
  host.appendChild(clone);
  document.body.appendChild(host);
  try {
    const height = Math.ceil(Math.max(clone.scrollHeight, clone.getBoundingClientRect().height));
    // Prefer 2x resolution, bounded by canvas dimensions and a 24-megapixel budget.
    const pixelRatio = Math.min(2, 16384 / Math.max(width, height), Math.sqrt(24_000_000 / (width * height)));
    const blob = await toBlob(clone, {
      width, height, pixelRatio, backgroundColor: '#f7f5ef', preferredFontFormat: 'woff2',
      filter: node => !(node instanceof Element && node.getAttribute('data-capture-ignore') === 'true'),
    });
    if (!blob) throw new Error('PNG capture failed');
    return blob;
  } finally { host.remove(); }
}

export async function copyConsultationImage(root: HTMLElement): Promise<void> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    throw new Error('PNG clipboard is unavailable');
  }
  // Start the clipboard write during user activation; rendering resolves the PNG promise.
  const png = captureConsultation(root);
  // A browser may reject the clipboard before it consumes the rendering promise.
  void png.catch(() => {});
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
}
