/* Recolor the saved lockup, never redraw the Bitcoin glyph. */
window.WinnowAccent = (() => {
  const original = new WeakMap();
  const orange = {
    ink: 'assets/logo/winnow-lockup-orange-ink.svg',
    paper: 'assets/logo/winnow-lockup-orange-paper.svg'
  };
  function apply(root, palette) {
    const colored = palette === 'signal' || palette === 'orange';
    root.querySelectorAll('img[alt="Winnow"]').forEach(img => {
      if (!original.has(img)) original.set(img, img.getAttribute('src'));
      img.setAttribute('src', colored ? orange[img.classList.contains('dark-logo') ? 'paper' : 'ink'] : original.get(img));
    });
  }
  return {apply};
})();
