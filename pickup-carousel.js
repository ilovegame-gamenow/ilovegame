/* Controls follow actual overflow, including after resizing or editor previews. */
window.GamePickupCarousel = (() => {
  const rail = document.getElementById('pickup');
  const controls = document.getElementById('pickup-controls');
  if (!rail || !controls) return { refresh() {} };
  const prev = document.getElementById('pickup-prev');
  const next = document.getElementById('pickup-next');
  const dots = document.getElementById('pickup-dots');
  let positions = [];
  let current = 0;

  function update() {
    const left = rail.scrollLeft;
    current = positions.reduce((best, value, i) =>
      Math.abs(value - left) < Math.abs(positions[best] - left) ? i : best, 0);
    prev.disabled = left <= 2;
    next.disabled = left >= rail.scrollWidth - rail.clientWidth - 2;
    [...dots.children].forEach((dot, i) => dot.setAttribute('aria-pressed', String(i === current)));
  }
  function move(index) {
    rail.scrollTo({ left: positions[Math.max(0, Math.min(positions.length - 1, index))] || 0 });
  }
  function refresh() {
    const cards = [...rail.querySelectorAll('.card')];
    const max = rail.scrollWidth - rail.clientWidth;
    const overflowing = cards.length > 1 && max > 2;
    controls.hidden = !overflowing;
    positions = overflowing ? [...new Set(cards.map(card =>
      Math.round(Math.min(max, card.offsetLeft - cards[0].offsetLeft))))] : [];
    dots.replaceChildren(...positions.map((_, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.setAttribute('aria-label', `注目記事の表示位置 ${i + 1}`);
      dot.setAttribute('aria-controls', 'pickup');
      dot.addEventListener('click', () => move(i));
      return dot;
    }));
    update();
  }
  prev.addEventListener('click', () => move(current - 1));
  next.addEventListener('click', () => move(current + 1));
  rail.addEventListener('scroll', update, { passive: true });
  rail.addEventListener('keydown', event => {
    if (!controls.hidden && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      move(current + (event.key === 'ArrowRight' ? 1 : -1));
    }
  });
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(refresh).observe(rail);
  else window.addEventListener('resize', refresh);
  refresh();
  return { refresh };
})();
