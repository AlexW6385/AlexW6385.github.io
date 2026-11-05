/* Polyphony replay: every voice listens to each new thought; a few choose to speak; the clerk may call a weighted vote. */
(() => {
  const root = document.querySelector('[data-sim="mind"]');
  if (!root) return;
  const NS = 'http://www.w3.org/2000/svg';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = ms => new Promise(r => setTimeout(r, reduce ? 0 : ms));
  const svg = root.querySelector('svg.ring');
  svg.setAttribute('viewBox', '-75 0 570 420');
  const vg = svg.querySelector('.voices'), sg = svg.querySelector('.spokes');
  const logEl = root.querySelector('#mind-log'), cad = root.querySelector('#cadence');
  const $ = id => root.querySelector('#' + id);

  const NAMES = ['pragmatist', 'feeling', 'restraint', 'trickster', 'intent', 'seeker', 'deriver', 'restless', 'aesthete', 'explainer', 'worldbuilder'];
  const V = {};
  NAMES.forEach((name, i) => {
    const a = -Math.PI / 2 + i * 2 * Math.PI / NAMES.length;
    const x = 210 + 160 * Math.cos(a), y = 210 + 160 * Math.sin(a);
    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', x); line.setAttribute('y1', y); line.setAttribute('x2', 210); line.setAttribute('y2', 210);
    sg.appendChild(line);
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'voice');
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', 13);
    const t = document.createElementNS(NS, 'text');
    const ca = Math.cos(a), lx = 210 + 182 * ca, ly = 210 + 186 * Math.sin(a) + 5;
    t.setAttribute('x', lx); t.setAttribute('y', ly);
    t.setAttribute('text-anchor', ca > 0.25 ? 'start' : ca < -0.25 ? 'end' : 'middle');
    t.textContent = name;
    g.append(c, t); vg.appendChild(g);
    V[name] = { g, line };
  });

  const SCRIPTS = [
    {
      q: 'Send out applications tomorrow morning, or play badminton?',
      rounds: [
        [['pragmatist', 'Applications. Summer 2027 postings are open now, and the early ones get read first.'],
         ['feeling', 'I have been at the desk all week. Badminton is the thing I would actually look forward to.']],
        [['restraint', 'Do both. Thirty minutes of sending, then go.'],
         ['trickster', '"Tomorrow morning" assumes the resume is finished. Is it?']],
        [['intent', 'The question was which comes first, not whether to drop one.']],
      ],
      cadence: {
        q: 'What comes first tomorrow morning?',
        options: [['Send five applications, then badminton', 68], ['Badminton first, apply in the afternoon', 22], ['Only applications', 10]],
        digest: 'Decided: send five applications first, then go play badminton.',
      },
    },
    {
      q: 'Should I take the AI specialization next term?',
      rounds: [
        [['seeker', 'Yes, if it means the theory. Knowing why models work is the part I would keep.'],
         ['pragmatist', 'Check the load first. A heavy term during recruiting costs offers.']],
        [['deriver', 'Count it: how many required courses are left, and how many terms to fit them in?'],
         ['restless', 'Agents are what I want to build. This is the closest thing on offer.']],
        [['aesthete', 'Only if the courses are good. A label on the degree is not worth a dull term.']],
      ],
      cadence: {
        q: 'Take the AI specialization next term?',
        options: [['Take it and keep the rest of the load light', 41], ['Wait for next term\'s course list', 35], ['Skip it, take the courses I want anyway', 24]],
        digest: 'No decision: no option reached 60%. Open question: how heavy the required courses are.',
      },
    },
  ];

  let seq = 0, listens = 0, spoke = 0, busy = false;
  function counters() { $('seq').textContent = 'seq ' + seq; $('m-listens').textContent = listens; $('m-spoke').textContent = spoke; }
  function setAll(cls) { NAMES.forEach(n => { V[n].g.setAttribute('class', 'voice ' + cls); V[n].line.classList.remove('on'); }); }
  function add(who, text, cls) {
    const empty = logEl.querySelector('.empty'); if (empty) empty.remove();
    const li = document.createElement('li');
    if (cls) li.className = cls;
    const b = document.createElement('b'); b.textContent = who + ' ';
    li.append(b, document.createTextNode(text));
    logEl.appendChild(li); logEl.scrollTop = logEl.scrollHeight;
    seq++; counters();
  }

  async function listenRound(speakers) {
    setAll('listening');
    listens += NAMES.length; counters();
    await wait(900);
    const who = speakers.map(s => s[0]);
    NAMES.forEach(n => V[n].g.setAttribute('class', 'voice ' + (who.includes(n) ? 'listening' : 'quiet')));
    const quiet = NAMES.length - who.length;
    const li = document.createElement('li'); li.className = 'quiet';
    li.textContent = `${quiet} voices listened and stayed quiet`;
    logEl.appendChild(li);
    await wait(500);
    for (const [name, text] of speakers) {
      V[name].g.setAttribute('class', 'voice speaking'); V[name].line.classList.add('on');
      await wait(700);
      add(name, text);
      spoke++; counters();
      V[name].g.setAttribute('class', 'voice quiet'); V[name].line.classList.remove('on');
      await wait(400);
    }
  }

  async function runCadence(c) {
    cad.hidden = false; cad.innerHTML = '';
    const h = document.createElement('h4'); h.textContent = 'Cadence: ' + c.q;
    const note = document.createElement('p'); note.className = 'digest'; note.style.margin = '0 0 6px';
    note.textContent = 'Voices weigh each other, then support options. The top option needs 60%.';
    cad.append(h, note);
    setAll('listening');
    const top = Math.max(...c.options.map(o => o[1]));
    const fills = c.options.map(([label, pct]) => {
      const row = document.createElement('div'); row.className = 'bar' + (pct === top && pct >= 60 ? ' win' : '');
      const l = document.createElement('span'); l.textContent = label;
      const b = document.createElement('b'); b.textContent = pct + '%';
      const track = document.createElement('div'); track.className = 'track';
      const fill = document.createElement('div'); fill.className = 'fill';
      track.appendChild(fill); row.append(l, b, track); cad.appendChild(row);
      return [fill, pct];
    });
    listens += NAMES.length * 2; counters();
    await wait(300);
    fills.forEach(([f, pct]) => { f.style.width = pct + '%'; });
    await wait(1200);
    setAll('');
    const d = document.createElement('p'); d.className = 'digest'; d.textContent = c.digest;
    cad.appendChild(d);
  }

  const buttons = [...root.querySelectorAll('[data-q]')];
  async function play(i) {
    if (busy) return;
    busy = true;
    buttons.forEach(b => { b.disabled = true; b.setAttribute('aria-pressed', b.dataset.q === String(i)); });
    const s = SCRIPTS[i];
    logEl.innerHTML = ''; cad.hidden = true; seq = 0; listens = 0; spoke = 0; counters(); setAll('');
    add('conscious', s.q, 'conscious');
    logEl.lastChild.className = 'conscious';
    for (const r of s.rounds) await listenRound(r);
    setAll('listening'); listens += NAMES.length; counters();
    await wait(800);
    setAll('quiet');
    const li = document.createElement('li'); li.className = 'quiet';
    li.textContent = 'every voice listened and stayed quiet: the stream is quiet';
    logEl.appendChild(li); logEl.scrollTop = logEl.scrollHeight;
    await wait(700);
    const clerk = document.createElement('li'); clerk.className = 'quiet';
    clerk.textContent = 'clerk: conscious asked for a decision, a vote is due';
    logEl.appendChild(clerk);
    await runCadence(s.cadence);
    busy = false;
    buttons.forEach(b => { b.disabled = false; b.setAttribute('aria-pressed', 'false'); });
  }
  buttons.forEach(b => b.addEventListener('click', () => play(Number(b.dataset.q))));
  counters();
})();
