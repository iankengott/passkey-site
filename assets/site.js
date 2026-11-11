/* Passkey concept site, N28 presentation. Offline progressive enhancement.
   No credentials, network, device or USB APIs. One stored preference: the Reduce motion choice. */
(() => {
  'use strict';
  const root = document.documentElement;
  const $ = id => document.getElementById(id);
  const all = (sel, scope = document) => [...scope.querySelectorAll(sel)];

  // Old entry pages forward to the current page and keep row anchors such as results.html#R110.
  const redirect = document.body.dataset.redirect;
  if (redirect) {
    const hash = location.hash;
    const target = hash && /^#R\d+$/.test(hash) ? 'security.html' + hash : redirect;
    location.replace(target);
    return;
  }

  // ------------------------------------------------------------ motion
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const motionBtn = $('motion');
  const motionNote = $('motion-note');
  let userReduce = false;
  try { userReduce = localStorage.getItem('passkey-reduce-motion') === '1'; } catch (err) { /* storage blocked: default */ }
  const reduced = () => userReduce || media.matches;
  function applyMotion() {
    root.classList.toggle('motion-off', reduced());
    if (motionBtn) {
      motionBtn.disabled = media.matches;
      motionBtn.setAttribute('aria-pressed', String(reduced()));
      motionBtn.title = media.matches ? 'Your system setting already reduces motion' : '';
      if (motionNote) motionNote.hidden = !media.matches;
    }
    if (reduced()) revealAll();
  }
  if (motionBtn) motionBtn.addEventListener('click', () => {
    if (media.matches) return;
    userReduce = !userReduce;
    try { localStorage.setItem('passkey-reduce-motion', userReduce ? '1' : '0'); } catch (err) { /* not kept */ }
    applyMotion();
  });
  media.addEventListener('change', applyMotion);

  // ------------------------------------------------------------ scroll reveal, counting numbers
  function count(el) {
    const end = Number(el.dataset.count);
    if (reduced() || !end) { el.textContent = String(end); return; }
    const t0 = performance.now(), dur = 1100;
    const step = now => {
      const p = Math.min(1, (now - t0) / dur);
      el.textContent = String(Math.round(end * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(step);
    };
    el.textContent = '0';
    requestAnimationFrame(step);
  }
  function show(section) {
    if (section.classList.contains('in')) return;
    section.classList.add('in');
    all('[data-count]', section).forEach(count);
  }
  function revealAll() { all('.reveal').forEach(s => { s.classList.add('in'); all('[data-count]', s).forEach(el => { el.textContent = el.dataset.count; }); }); }
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(en => { if (en.isIntersecting) { show(en.target); io.unobserve(en.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }) : null;
  all('.reveal').forEach(s => io ? io.observe(s) : show(s));
  addEventListener('beforeprint', revealAll);

  // ------------------------------------------------------------ tabs, with arrows, Home, End, deep links and Back
  all('[data-tabs]').forEach(group => {
    const list = group.querySelector('.tab-buttons');
    const buttons = all('[data-tab]', list);
    const panels = all('[data-panel]', group);
    list.setAttribute('role', 'tablist');
    function select(id, update = false, focus = false) {
      if (!buttons.some(b => b.dataset.tab === id)) return;
      buttons.forEach(b => {
        const active = b.dataset.tab === id;
        b.setAttribute('aria-selected', String(active));
        b.tabIndex = active ? 0 : -1;
        if (active && focus) b.focus();
      });
      panels.forEach(p => { p.hidden = p.id !== id; });
      if (update && location.hash !== '#' + id) history.pushState(null, '', '#' + id);
    }
    buttons.forEach((b, i) => {
      b.id = 'tab-' + b.dataset.tab;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-controls', b.dataset.tab);
      const p = panels.find(x => x.id === b.dataset.tab);
      p.setAttribute('role', 'tabpanel');
      p.setAttribute('aria-labelledby', b.id);
      p.tabIndex = 0;
      b.addEventListener('click', () => select(b.dataset.tab, true));
      b.addEventListener('keydown', ev => {
        let index;
        if (ev.key === 'ArrowRight') index = (i + 1) % buttons.length;
        if (ev.key === 'ArrowLeft') index = (i - 1 + buttons.length) % buttons.length;
        if (ev.key === 'Home') index = 0;
        if (ev.key === 'End') index = buttons.length - 1;
        if (index !== undefined) { ev.preventDefault(); select(buttons[index].dataset.tab, true, true); }
      });
    });
    const fromHash = () => {
      const id = location.hash.slice(1);
      select(buttons.some(b => b.dataset.tab === id) ? id : buttons[0].dataset.tab);
    };
    addEventListener('hashchange', fromHash);
    addEventListener('popstate', fromHash);
    fromHash();
  });

  // ------------------------------------------------------------ register: filters, search, deep links
  const list = $('register-list');
  const search = $('result-search');
  let filter = 'all';
  function applyFilter() {
    if (!list) return;
    const q = search ? search.value.trim().toLowerCase() : '';
    const rows = all('.reg', list);
    rows.forEach(r => { r.hidden = !((filter === 'all' || r.dataset.status === filter) && (!q || r.dataset.search.includes(q))); });
    const shown = rows.filter(r => !r.hidden).length;
    $('filter-count').textContent = shown + ' of ' + rows.length + ' rows';
    const empty = $('reg-empty');
    if (empty) empty.hidden = shown > 0;
  }
  all('[data-filter]').forEach(b => b.addEventListener('click', () => {
    filter = b.dataset.filter;
    all('[data-filter]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    applyFilter();
  }));
  if (search) search.addEventListener('input', applyFilter);
  function revealTarget() {
    const id = decodeURIComponent(location.hash.slice(1));
    const target = id && document.getElementById(id);
    if (!target) return;
    for (let p = target.parentElement; p; p = p.parentElement) if (p.tagName === 'DETAILS') p.open = true;
    if (target.tagName === 'DETAILS' && !target.classList.contains('reg')) { target.open = true; requestAnimationFrame(() => target.scrollIntoView({ block: 'start', behavior: 'instant' })); }
    if (list && list.contains(target)) {
      filter = 'all';
      all('[data-filter]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.filter === 'all')));
      if (search) search.value = '';
      applyFilter();
      target.open = true;
      const section = $('register');
      if (section) show(section);
      // Position after the browser's own fragment scroll, which can land later than one frame.
      const place = () => {
        list.scrollTo({ top: target.offsetTop - 8, behavior: 'instant' });
        (section || list).scrollIntoView({ block: 'start', behavior: 'instant' });
      };
      requestAnimationFrame(place);
      setTimeout(place, 120);
      target.classList.remove('flash'); void target.offsetWidth; target.classList.add('flash');
    }
  }
  addEventListener('hashchange', revealTarget);

  // ------------------------------------------------------------ dialogs
  let opener;
  function closeDialog(d) {
    if (!d.open) return;
    if (reduced()) { d.close(); return; }
    d.classList.add('closing');
    setTimeout(() => { d.classList.remove('closing'); d.close(); }, 200);
  }
  all('[data-open]').forEach(b => b.addEventListener('click', () => { opener = b; $(b.dataset.open).showModal(); dispatchEvent(new Event('resize')); }));
  all('dialog').forEach(d => {
    d.querySelector('[data-close]').addEventListener('click', () => closeDialog(d));
    d.addEventListener('cancel', ev => { ev.preventDefault(); closeDialog(d); });
    d.addEventListener('click', ev => { if (ev.target === d) closeDialog(d); });
    d.addEventListener('close', () => { if (opener) opener.focus(); });
    d.addEventListener('keydown', ev => {
      if (ev.key !== 'Tab') return;
      const items = all('button,a[href],summary', d).filter(x => x.getClientRects().length);
      const first = items[0], last = items[items.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    });
    all('[data-view]', d).forEach(b => b.addEventListener('click', () => {
      const img = d.querySelector('.dialog-figure img');
      img.src = 'assets/' + b.dataset.view;
      img.alt = b.dataset.alt;
      d.querySelector('.dialog-figure figcaption').textContent = b.dataset.caption;
      const link = d.querySelector('.dialog-links a');
      if (link) link.href = 'assets/' + b.dataset.view;
      all('[data-view]', d).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      img.classList.remove('swap'); void img.offsetWidth; img.classList.add('swap');
    }));
  });

  // ------------------------------------------------------------ column pickers for phone tables
  all('.col-pick').forEach(pick => {
    const scope = pick.classList.contains('sec-pick') ? pick.parentElement : pick.closest('.home-works, .compat-works, .threat-wrap, details, .band');
    const table = scope && scope.querySelector('[data-active]');
    if (!table) return;
    all('[data-pick]', pick).forEach(b => b.addEventListener('click', () => {
      table.dataset.active = b.dataset.pick;
      all('[data-pick]', pick).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    }));
  });

  // ------------------------------------------------------------ phone: threat rows open to show their reasons
  // Rows with a reason toggle (threats on every width, ease rows on phones).
  all('.row-toggle').forEach(b => b.addEventListener('click', () => {
    const tr = b.closest('tr');
    const open = !tr.classList.contains('open');
    tr.classList.toggle('open', open);
    b.setAttribute('aria-expanded', String(open));
  }));
  all('[data-expand-all]').forEach(btn => btn.addEventListener('click', () => {
    const table = document.getElementById(btn.dataset.expandAll);
    const open = btn.getAttribute('aria-expanded') !== 'true';
    all('tbody tr', table).forEach(tr => { tr.classList.toggle('open', open); const t = tr.querySelector('.row-toggle'); if (t) t.setAttribute('aria-expanded', String(open)); });
    btn.setAttribute('aria-expanded', String(open));
    btn.textContent = open ? 'Hide all reasons' : 'Show all reasons';
  }));

  // ------------------------------------------------------------ position curves: each name explains its place
  all('.curve').forEach(fig => {
    const out = fig.querySelector('.curve-why');
    const marks = all('.cm-label', fig);
    marks.forEach(m => m.addEventListener('click', () => {
      const on = m.getAttribute('aria-expanded') !== 'true';
      marks.forEach(x => { x.setAttribute('aria-expanded', 'false'); x.parentElement.classList.remove('on'); });
      m.setAttribute('aria-expanded', String(on));
      m.parentElement.classList.toggle('on', on);
      out.querySelector('strong').textContent = on ? m.dataset.name : 'Why here?';
      out.querySelector('span').textContent = on ? m.dataset.reason : 'Select a name to see the reason for its place.';
      out.classList.remove('flash'); void out.offsetWidth; out.classList.add('flash');
      const b = out.getBoundingClientRect();
      if (on && (b.top < 0 || b.bottom > innerHeight)) out.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'instant' : 'smooth' });
    }));
  });

  // ------------------------------------------------------------ carousels
  all('[data-carousel]').forEach((car, ci) => {
    const track = car.querySelector('.track');
    const slides = [...track.children];
    const dots = car.querySelector('.car-dots');
    const scope = car.closest('dialog, .band, .card');
    const prev = scope.querySelector('[data-car=prev]');
    const next = scope.querySelector('[data-car=next]');
    const gap = () => parseFloat(getComputedStyle(track).columnGap) || 0;
    const stepW = () => slides[0].getBoundingClientRect().width + gap();
    const dotBtns = slides.map((s, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      if (s.dataset.label) { b.textContent = s.dataset.label; b.className = 'lbl'; b.setAttribute('aria-label', 'Show ' + s.dataset.label); }
      else b.setAttribute('aria-label', 'Show item ' + (i + 1) + ' of ' + slides.length);
      b.addEventListener('click', () => go(i));
      dots.appendChild(b);
      return b;
    });
    slides.forEach((s, i) => { s.setAttribute('aria-roledescription', 'slide'); s.setAttribute('aria-label', (i + 1) + ' of ' + slides.length); });
    function go(i) {
      const max = track.scrollWidth - track.clientWidth;
      track.scrollTo({ left: Math.max(0, Math.min(max, i * stepW())), behavior: reduced() ? 'auto' : 'smooth' });
    }
    function sync() {
      const w = stepW();
      const idx = Math.round(track.scrollLeft / w);
      const visible = Math.max(1, Math.round((track.clientWidth + gap()) / w));
      const atEnd = track.scrollLeft >= track.scrollWidth - track.clientWidth - 4;
      slides.forEach((s, i) => s.classList.toggle('on', atEnd ? i >= slides.length - visible : i >= idx && i < idx + visible));
      dotBtns.forEach((b, i) => b.setAttribute('aria-current', String(atEnd ? i === slides.length - visible : i === idx)));
      dotBtns.forEach((b, i) => { b.hidden = i > slides.length - visible; });
      if (prev) prev.disabled = track.scrollLeft <= 4;
      if (next) next.disabled = atEnd;
      car.dataset.index = String(atEnd ? slides.length - visible : idx);
      // One slide per view: the hidden one leaves the tab order until it is shown.
      if (track.classList.contains('one')) slides.forEach(s => { s.inert = !s.classList.contains('on'); });
    }
    let raf = 0;
    track.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(sync); });
    addEventListener('resize', sync);
    if (prev) prev.addEventListener('click', () => go(Number(car.dataset.index) - 1));
    if (next) next.addEventListener('click', () => go(Number(car.dataset.index) + 1));
    track.addEventListener('keydown', ev => {
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') { ev.preventDefault(); go(Number(car.dataset.index) + (ev.key === 'ArrowRight' ? 1 : -1)); }
    });
    sync();
  });

  // ------------------------------------------------------------ security flow route
  const FLOW = {
    password: ['The computer and page see the password', 'Gets a reusable password', 'Password mode: after you approve, the password goes through the computer to the exact saved site. You press Sign in yourself.'],
    passkey: ['The computer still shows the prompt', 'Gets a one-time signature', 'Passkey mode: the site sends a challenge, the key signs it after you approve, and the site checks the signature. No reusable secret reaches the page.']
  };
  function setFlow(mode) {
    all('.flow').forEach(f => {
      f.dataset.flow = mode;
      const z = f.querySelector('[data-flow-zone]'); if (z) z.textContent = FLOW[mode][0];
      const end = f.querySelector('[data-flow-end]'); if (end) end.textContent = FLOW[mode][1];
      const note = f.querySelector('[data-flow-note]'); if (note) note.textContent = FLOW[mode][2];
    });
    all('[data-route]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.route === mode)));
  }
  all('[data-route]').forEach(b => b.addEventListener('click', () => setFlow(b.dataset.route)));

  // ------------------------------------------------------------ hero: rendered plug-in, one approval, the user submits
  // Fake data only. Nothing here touches real credentials, devices, USB or the network.
  const product = $('product');
  const frameImg = $('plug-frame');
  const demo = $('demo');
  if (product && frameImg && demo) {
    const N = Number(frameImg.dataset.frames);
    const DUR = Number(frameImg.dataset.duration);
    const start = $('start');
    const startLabel = start.querySelector('span');
    const frameSrc = i => 'assets/hero/plug-' + String(i).padStart(2, '0') + '.webp';
    let warm = null;
    const preload = () => warm || (warm = Promise.all(Array.from({ length: N }, (_, i) => {
      const im = new Image();
      im.src = frameSrc(i);
      return im.decode().catch(() => null);
    })));
    // Warm the frames once the page is idle, so the first plug-in plays without gaps.
    addEventListener('load', () => (window.requestIdleCallback ? requestIdleCallback(preload, { timeout: 2500 }) : setTimeout(preload, 1500)));
    function showFrame(i) {
      if (frameImg.dataset.frame === String(i)) return;
      frameImg.dataset.frame = String(i);
      frameImg.src = frameSrc(i);
    }
    // The frame follows a Web Animation clock, so it can be paused and seeked like a CSS transition.
    let motion = null;
    function play(forward) {
      const last = forward ? N - 1 : 0;
      if (motion) { motion.cancel(); motion = null; }
      if (reduced()) { showFrame(last); return Promise.resolve(); }
      const anim = frameImg.animate([{ opacity: 1 }, { opacity: 1 }], { duration: DUR, easing: 'linear' });
      anim.id = forward ? 'plug-in' : 'unplug';
      motion = anim;
      const tick = () => {
        if (motion !== anim) return;
        const t = Math.min(1, Math.max(0, (anim.currentTime || 0) / DUR));
        showFrame(Math.round((forward ? t : 1 - t) * (N - 1)));
        if (anim.playState !== 'finished') requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      return anim.finished.then(() => { if (motion === anim) { motion = null; showFrame(last); } });
    }

    let state = 'ready';
    const MESSAGES = {
      review: 'Check the site and account, then approve.',
      released: 'Filled. Nothing was submitted. Press Sign in yourself.',
      complete: 'Signed in to demo.example.',
      cancelled: 'Cancelled. Nothing left the key.'
    };
    const VALUES = { review: 'Waiting for your approval', released: '•••••••••••• (demo)', complete: '•••••••••••• (demo)', cancelled: 'Nothing released' };
    function render() {
      product.dataset.state = state;
      demo.dataset.state = state;
      demo.hidden = state === 'ready' || state === 'plugging';
      $('review').hidden = state !== 'review';
      // Fields under the open prompt leave the tab order and stay hidden behind it.
      all('.site > :not(.prompt):not(.site-brand):not(.site-title)', demo).forEach(el => { el.classList.toggle('under-prompt', state === 'review'); el.inert = state === 'review'; });
      $('credential').textContent = VALUES[state] || 'Waiting for the key';
      const submit = $('submit');
      submit.disabled = state !== 'released';
      submit.textContent = state === 'complete' ? 'Signed in' : 'Sign in';
      start.disabled = state === 'plugging';
      startLabel.textContent = state === 'ready' || state === 'plugging' ? 'Plug in and sign in' : 'Unplug';
      start.setAttribute('aria-expanded', String(!demo.hidden));
      $('demo-status').textContent = MESSAGES[state] || '';
    }
    function set(next) { state = next; render(); }
    start.setAttribute('aria-controls', 'demo');
    async function plug() {
      if (state !== 'ready') return;
      set('plugging');
      await play(true);
      if (state !== 'plugging') return;
      set('review');
      $('approve').focus({ preventScroll: true });
      // On a phone the prompt sits below the key: bring it into view.
      const r = demo.getBoundingClientRect();
      if (r.bottom > innerHeight || r.top < 0) demo.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'instant' : 'smooth' });
    }
    function unplug() {
      set('ready');
      play(false);
    }
    start.addEventListener('click', () => (state === 'ready' ? plug() : state !== 'plugging' && unplug()));
    frameImg.addEventListener('click', () => { if (state === 'ready') plug(); });
    $('approve').addEventListener('click', () => {
      set('released');
      const field = demo.querySelector('.cred');
      field.classList.remove('filled'); void field.offsetWidth; field.classList.add('filled');
      $('submit').focus({ preventScroll: true });
    });
    $('cancel').addEventListener('click', () => { set('cancelled'); start.focus({ preventScroll: true }); });
    $('submit').addEventListener('click', () => { if (state === 'released') { set('complete'); start.focus({ preventScroll: true }); } });
    render();
  }

  applyMotion();
  root.classList.add('enhanced');
  revealTarget();
})();
