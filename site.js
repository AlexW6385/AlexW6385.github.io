/* Small page behaviours: image tabs, the era slider, and videos that play only while visible. */
(() => {
  const img = document.getElementById('moc-img');
  const tabs = [...document.querySelectorAll('#moc .tabs button')];
  tabs.forEach(t => t.addEventListener('click', () => {
    tabs.forEach(o => o.setAttribute('aria-selected', o === t));
    img.src = t.dataset.img; img.alt = t.dataset.alt;
  }));

  const range = document.getElementById('sym-range');
  const late = document.getElementById('sym-late');
  if (range && late) range.addEventListener('input', () => { late.style.opacity = range.value / 100; });

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const videos = document.querySelectorAll('video');
  if (reduce) { videos.forEach(v => { v.controls = true; }); return; }
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.preload = 'auto'; e.target.play().catch(() => { e.target.controls = true; }); }
    else e.target.pause();
  }), { threshold: 0.35 });
  videos.forEach(v => io.observe(v));
})();
