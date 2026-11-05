/* Order system replay: scripted scenarios that show what the real design does. */
(() => {
  const root = document.querySelector('[data-sim="orders"]');
  if (!root) return;
  const svg = root.querySelector('svg');
  const layer = svg.querySelector('.packets');
  const logEl = root.querySelector('#order-log');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NS = 'http://www.w3.org/2000/svg';
  const $ = id => root.querySelector('#' + id);

  const START_STOCK = 5;
  let S;
  function fresh() {
    S = { stock: START_STOCK, orders: 0, charges: {}, outbox: 0, events: 0, notified: 0, keys: {}, state: 'none' };
  }

  function render() {
    $('stock-label').textContent = 'stock ' + S.stock;
    $('stock-state').textContent = S.stock;
    $('order-state').textContent = S.state;
    const totalCharges = Object.values(S.charges).reduce((a, b) => a + b, 0);
    $('charge-label').textContent = 'charges ' + totalCharges;
    $('notif-label').textContent = 'sent ' + S.notified;
    $('outbox-count').textContent = S.outbox + (S.outbox === 1 ? ' row' : ' rows');
    const dbl = Object.values(S.charges).filter(n => n > 1).length;
    setInv('inv-charge', dbl);
    setInv('inv-over', Math.max(0, -S.stock));
  }
  function setInv(id, n) { const el = $(id); el.textContent = n; el.classList.toggle('bad', n > 0); }

  function log(text, cls) {
    const li = document.createElement('li');
    li.textContent = text;
    if (cls) li.className = cls;
    logEl.appendChild(li);
    logEl.scrollTop = logEl.scrollHeight;
  }

  const wait = ms => new Promise(r => setTimeout(r, reduce ? 0 : ms));

  function node(id, cls, on) { $(id).classList.toggle(cls, on); }

  /* Move a dot along an edge. opts: rev (travel backwards), cls (packet colour), lose (stop halfway and vanish), dur */
  function send(edge, opts = {}) {
    const path = $(edge);
    const len = path.getTotalLength();
    const dot = document.createElementNS(NS, 'circle');
    dot.setAttribute('r', opts.r || 7);
    dot.setAttribute('class', 'packet ' + (opts.cls || ''));
    layer.appendChild(dot);
    path.classList.add('hot');
    const dur = reduce ? 0 : (opts.dur || 520);
    const stopAt = opts.lose ? 0.55 : 1;
    return new Promise(resolve => {
      const t0 = performance.now();
      function frame(now) {
        const k = dur ? Math.min(1, (now - t0) / dur) : 1;
        const p = Math.min(k, stopAt);
        const at = path.getPointAtLength(len * (opts.rev ? 1 - p : p));
        dot.setAttribute('cx', at.x); dot.setAttribute('cy', at.y);
        if (opts.lose && k >= stopAt) dot.setAttribute('opacity', Math.max(0, 1 - (k - stopAt) * 4));
        if (k < 1) requestAnimationFrame(frame);
        else { dot.remove(); path.classList.remove('hot'); resolve(); }
      }
      requestAnimationFrame(frame);
    });
  }

  async function placeOrder(key, { paymentTimeout = false, crashBeforePublish = false } = {}) {
    log(`POST /orders  Idempotency-Key ${key}`);
    await send('e-cli-gw');
    if (S.keys[key]) {
      log(`gateway: key ${key} already seen, replaying the stored response`, 'ok');
      await send('e-cli-gw', { rev: true, cls: 'ok' });
      log(`client gets the same ${S.keys[key]} again; no second order, no second charge`, 'ok');
      return;
    }
    await send('e-gw-redis', { dur: 260 }); await send('e-gw-redis', { rev: true, dur: 260, cls: 'ok' });
    await send('e-gw-ord');
    const id = 'o-' + (++S.orders);
    S.state = id + ' CREATED'; render();
    log(`${id}: created`);

    await send('e-ord-prod');
    if (S.stock <= 0) {
      await send('e-ord-prod', { rev: true, cls: 'lost' });
      S.state = id + ' REJECTED'; render();
      log(`${id}: out of stock, rejected (row lock + CHECK stock >= 0)`, 'fail');
      await send('e-gw-ord', { rev: true }); await send('e-cli-gw', { rev: true });
      S.keys[key] = '409 sold out';
      return;
    }
    S.stock--; await send('e-ord-prod', { rev: true, cls: 'ok' });
    S.state = id + ' RESERVED'; render();
    log(`${id}: 1 unit reserved, stock ${S.stock}`);

    log(`${id}: charge, keyed by order id`);
    await send('e-ord-pay');
    S.charges[id] = (S.charges[id] || 0) + 1; render();
    if (paymentTimeout) {
      await send('e-ord-pay', { rev: true, lose: true, cls: 'lost', dur: 900 });
      S.state = id + ' PAYMENT_PENDING'; render();
      log(`${id}: response lost. Was the card charged? Unknown, so the order waits instead of failing`, 'fail');
      await send('e-gw-ord', { rev: true }); await send('e-cli-gw', { rev: true });
      log('client gets 202: payment settling');
      await wait(700);
      log('recovery worker: retry the charge with the same key', 'note');
      await send('e-ord-pay');
      log(`payment: key ${id} already charged, returning the first result`, 'ok');
      await send('e-ord-pay', { rev: true, cls: 'ok' });
    } else {
      await send('e-ord-pay', { rev: true, cls: 'ok' });
    }
    S.outbox++; S.state = id + ' PAID'; render();
    log(`${id}: PAID and an outbox row, committed in one transaction`, 'ok');
    if (!paymentTimeout) {
      await send('e-gw-ord', { rev: true, cls: 'ok' }); await send('e-cli-gw', { rev: true, cls: 'ok' });
      log('client gets 200 paid');
    }
    S.keys[key] = '200 paid';

    if (crashBeforePublish) {
      node('n-ord', 'down', true);
      log('order-service killed before the event was published', 'fail');
      await wait(1100);
      node('n-ord', 'down', false);
      log('order-service restarts; the outbox row is still there', 'note');
      await wait(400);
    }
    await publish(id, crashBeforePublish);
  }

  async function publish(id, duplicate) {
    log('outbox relay: claim the row (SKIP LOCKED) and publish');
    await send('e-ord-kafka');
    S.outbox--; S.events++; render();
    await Promise.all([send('e-kafka-prod'), send('e-kafka-notif')]);
    S.notified++; render();
    log(`${id}: product confirms the reservation, notification sent`, 'ok');
    if (duplicate) {
      log('Kafka redelivers the same event after the restart', 'note');
      await send('e-kafka-notif', { cls: 'lost' });
      log('notification inbox: event id already seen, dropped', 'ok');
    }
  }

  async function flashSale() {
    const buyers = 40;
    log(`flash sale: ${buyers} buyers at once, ${S.stock} units left`);
    node('n-redis2', 'flash', true);
    let gate = S.stock, sold = 0, refused = 0;
    const one = async i => {
      await wait(i * 45);
      const o = { dur: 300, r: 5 };
      await send('e-cli-gw', o); await send('e-gw-ord', o); await send('e-ord-prod', o);
      await send('e-prod-redis', { ...o, dur: 200 });
      if (gate > 0) { gate--; sold++; S.stock--; render(); await send('e-prod-redis', { ...o, dur: 200, rev: true, cls: 'ok' }); }
      else { refused++; await send('e-prod-redis', { ...o, dur: 200, rev: true, cls: 'lost' }); }
    };
    await Promise.all(Array.from({ length: buyers }, (_, i) => one(i)));
    node('n-redis2', 'flash', false);
    S.state = 'flash sale over'; render();
    log(`Redis Lua gate: ${sold} let through, ${refused} told sold out in one round trip`, 'ok');
    log(`stock ${S.stock}, never below zero; the hot row was never contended`, 'ok');
  }

  let busy = false;
  const buttons = [...root.querySelectorAll('[data-run]')];
  async function run(name) {
    if (busy) return;
    if (name === 'reset') { fresh(); logEl.innerHTML = ''; render(); log('reset: 5 units in stock', 'note'); return; }
    busy = true;
    buttons.forEach(b => { b.disabled = b.dataset.run !== name; b.setAttribute('aria-pressed', b.dataset.run === name); });
    log('—', 'note');
    try {
      if (name === 'checkout') await placeOrder('k-' + (S.orders + 1));
      if (name === 'timeout') await placeOrder('k-' + (S.orders + 1), { paymentTimeout: true });
      if (name === 'crash') await placeOrder('k-' + (S.orders + 1), { crashBeforePublish: true });
      if (name === 'retry') { const k = 'k-' + (S.orders + 1); await placeOrder(k); log('the client never saw the answer and sends it again', 'note'); await placeOrder(k); }
      if (name === 'flash') await flashSale();
    } finally {
      busy = false;
      buttons.forEach(b => { b.disabled = false; b.setAttribute('aria-pressed', 'false'); });
    }
  }
  buttons.forEach(b => b.addEventListener('click', () => run(b.dataset.run)));
  fresh(); render();
  log('5 units in stock. Pick a scenario.', 'note');
})();
