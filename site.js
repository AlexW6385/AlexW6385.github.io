/* Page behaviours: the Memory of Civilizations gallery, the ages slider, live embeds, and videos that play only while visible. */
(() => {
  // gallery: a tile shows its picture on the stage
  const big = document.getElementById('moc-big'), cap = document.getElementById('moc-cap');
  const tiles = [...document.querySelectorAll('#moc .strip button')];
  tiles.forEach(t => t.addEventListener('click', () => {
    tiles.forEach(o => o.classList.toggle('on', o === t));
    big.src = t.dataset.big; big.alt = t.dataset.cap; cap.textContent = t.dataset.cap;
  }));
  // warm the gallery's large pictures once the page is idle
  const warm = () => tiles.forEach(t => { const i = new Image(); i.src = t.dataset.big; });
  if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 4000 }); else setTimeout(warm, 2500);

  // ages: three pictures crossfaded along the slider
  const range = document.getElementById('sym-range');
  const layers = [...document.querySelectorAll('#sym-fade img')];
  if (range && layers.length === 3) {
    const paint = () => {
      const v = range.value / 100;                  // 0 … 2
      layers[1].style.opacity = Math.min(1, v);
      layers[2].style.opacity = Math.max(0, v - 1);
    };
    range.addEventListener('input', paint); paint();
  }

  // live embeds: the clip until asked, then the real thing
  document.querySelectorAll('.viewer.live').forEach(v => {
    const btn = v.querySelector('.play-here');
    btn.addEventListener('click', () => {
      const f = document.createElement('iframe');
      f.src = v.dataset.src; f.title = btn.textContent; f.allow = 'fullscreen; autoplay';
      v.querySelectorAll('video, img').forEach(e => { if (e.tagName === 'VIDEO') e.pause(); e.remove(); });
      btn.remove(); v.appendChild(f); f.focus();
      v.closest('article').querySelectorAll('.thumbs button').forEach(b => { b.disabled = true; });
    });
  });

  // Desktop Universe: a thumbnail shows that universe still
  const duVideo = document.getElementById('du-video'), duStill = document.getElementById('du-still');
  const thumbs = [...document.querySelectorAll('#du .thumbs button')];
  thumbs.forEach(b => b.addEventListener('click', () => {
    if (!duStill || !duStill.isConnected) return;
    thumbs.forEach(o => o.classList.toggle('on', o === b));
    duStill.src = b.dataset.still; duStill.alt = b.querySelector('img').alt; duStill.hidden = false;
    if (duVideo && duVideo.isConnected) { duVideo.pause(); duVideo.hidden = true; }
  }));

  // videos play only while on screen (and not at all with reduced motion)
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const videos = document.querySelectorAll('video');
  if (reduce) { videos.forEach(v => { v.controls = true; }); return; }
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    const v = e.target;
    if (!v.isConnected || v.hidden) return;
    if (e.isIntersecting) { v.preload = 'auto'; v.play().catch(() => { v.controls = true; }); }
    else v.pause();
  }), { threshold: 0.35 });
  videos.forEach(v => io.observe(v));
})();
