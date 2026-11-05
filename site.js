/* Page behaviours: the picture galleries, live embeds, and videos that play only while visible. */
(() => {
  // galleries: a tile shows its picture on its stage (Memory of Civilizations, the novel exhibition)
  const allTiles = [];
  document.querySelectorAll('[data-gallery]').forEach(g => {
    const big = g.querySelector('.stage img'), cap = g.querySelector('.stage figcaption'), film = g.querySelector('.stage video');
    const tiles = [...g.querySelectorAll('.strip button')].filter(t => t.dataset.big || 'film' in t.dataset);
    tiles.forEach(t => t.addEventListener('click', () => {
      tiles.forEach(o => o.classList.toggle('on', o === t));
      cap.textContent = t.dataset.cap;
      if ('film' in t.dataset) { big.hidden = true; film.hidden = false; film.play().catch(() => {}); return; }
      if (film) { film.pause(); film.hidden = true; }
      big.hidden = false; big.src = t.dataset.big; big.alt = t.dataset.cap;
    }));
    allTiles.push(...tiles);
  });
  // warm the galleries' large pictures once the page is idle
  const warm = () => allTiles.forEach(t => { if (t.dataset.big) { const i = new Image(); i.src = t.dataset.big; } });
  if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 4000 }); else setTimeout(warm, 2500);

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
