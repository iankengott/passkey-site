/* Passkey concept site, round two. Offline progressive enhancement.
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
      const items = all('button,a[href]', d).filter(x => x.getClientRects().length);
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
    const scope = pick.classList.contains('sec-pick') ? pick.parentElement : pick.closest('.spectrum, .home-works, .compat-works, .threat-wrap, details, .band');
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

  // ------------------------------------------------------------ spectrum markers explain their place
  all('.spectrum').forEach(sp => {
    const out = sp.querySelector('.spec-reason');
    const marks = all('.spec-mark', sp);
    marks.forEach(m => m.addEventListener('click', () => {
      const on = m.getAttribute('aria-expanded') !== 'true';
      marks.forEach(x => x.setAttribute('aria-expanded', 'false'));
      m.setAttribute('aria-expanded', String(on));
      out.querySelector('.sr-title').textContent = on ? m.dataset.name : 'Why each one sits where it does';
      out.querySelector('.sr-text').textContent = on ? m.dataset.reason : 'Tap or select a marker to see the reason for its place.';
      out.classList.remove('flash'); void out.offsetWidth; out.classList.add('flash');
      const bounds = out.getBoundingClientRect();
      if (on && (bounds.top < 0 || bounds.bottom > innerHeight)) {
        out.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'instant' : 'smooth' });
      }
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
      b.setAttribute('aria-label', 'Show item ' + (i + 1) + ' of ' + slides.length);
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

  // ------------------------------------------------------------ hero: turnable key, hotspots, plug-in sign-in demo
  const viewer = $('viewer');
  const demo = document.querySelector('.demo');
  if (viewer && demo) {
    const ORDER = ['iso', 'under', 'side'];
    const views = all('.view', viewer);
    const info = $('hotspot-info');
    let mode = 'password', state = 'ready';
    const DEFAULT = {
      iso: ['Try it', 'Tap a gold point to learn what it is. Drag to turn the key. Plug it in to sign in.'],
      under: ['Underside', 'Flat base with a recessed service well. Tap the gold point.'],
      side: ['Profile', '3.5 mm thin. Tap a gold point for the dimensions.']
    };
    // The info card follows the demo state; the view text applies only before a sign-in starts.
    function stateInfo() {
      const pw = mode === 'password';
      return {
        review: ['Plugged in', 'The key is connected. Approve in the prompt on screen. The key itself has no button.'],
        released: ['Approved', pw ? 'The password travelled from the key, through the computer, to the exact saved site.' : 'The site sent a challenge. The key signed it and the signature went back.'],
        complete: ['Signed in', 'Demo complete. Replay to try again, or switch between Password and Passkey.'],
        cancelled: ['Cancelled', 'Nothing left the key. Replay to try again.'],
        excluded: ['Refused', 'This site asks for a PIN or fingerprint. The key has neither, so nothing is released.']
      }[state] || DEFAULT[viewer.dataset.view];
    }
    function setInfo(title, text) {
      info.querySelector('.hi-title').textContent = title;
      info.querySelector('.hi-text').textContent = text;
      info.classList.remove('flash'); void info.offsetWidth; info.classList.add('flash');
    }
    function clearSpots() { all('.hs', viewer).forEach(h => h.setAttribute('aria-expanded', 'false')); delete viewer.dataset.focus; info.classList.remove('on'); }
    function setView(v) {
      const vi = ORDER.indexOf(v);
      // Keep keyboard focus: a focused hotspot in the old view is about to become inert.
      if (viewer.contains(document.activeElement) && document.activeElement.closest('.view')) viewer.focus({ preventScroll: true });
      viewer.dataset.view = v;
      views.forEach(el => {
        const active = el.dataset.v === v;
        el.classList.toggle('is-active', active);
        el.classList.toggle('before', ORDER.indexOf(el.dataset.v) < vi);
        el.style.transform = '';
        el.inert = !active;
      });
      all('[data-goto]', viewer).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.goto === v)));
      clearSpots();
      setInfo(...stateInfo());
    }
    const turn = d => { viewer.classList.add('touched'); setView(ORDER[(ORDER.indexOf(viewer.dataset.view) + d + ORDER.length) % ORDER.length]); };
    all('[data-turn]', viewer).forEach(b => b.addEventListener('click', () => turn(Number(b.dataset.turn))));
    all('[data-goto]', viewer).forEach(b => b.addEventListener('click', () => { viewer.classList.add('touched'); setView(b.dataset.goto); }));
    viewer.addEventListener('keydown', ev => {
      if (ev.target.closest('.seg')) return;
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') { ev.preventDefault(); turn(ev.key === 'ArrowRight' ? 1 : -1); }
    });
    all('.hs', viewer).forEach(h => h.addEventListener('click', () => {
      viewer.classList.add('touched');
      const was = h.getAttribute('aria-expanded') === 'true';
      clearSpots();
      if (was) { setInfo(...stateInfo()); return; }
      h.setAttribute('aria-expanded', 'true');
      viewer.dataset.focus = h.dataset.hs;
      info.classList.add('on');
      setInfo(h.dataset.title, h.dataset.text);
    }));
    // Drag to turn. A press without movement on the key plugs it in.
    let drag = null;
    viewer.addEventListener('pointerdown', ev => {
      if (ev.button !== 0 || ev.target.closest('button,a')) return;
      drag = { x: ev.clientX, y: ev.clientY, id: ev.pointerId, moved: false, onKey: !!ev.target.closest('.key') };
    });
    viewer.addEventListener('pointermove', ev => {
      if (!drag || ev.pointerId !== drag.id) return;
      const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
      if (!drag.moved && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
        drag.moved = true;
        viewer.classList.add('dragging', 'touched');
        try { viewer.setPointerCapture(ev.pointerId); } catch (err) { /* ignore */ }
      }
      if (drag.moved) {
        const active = viewer.querySelector('.view.is-active');
        if (!reduced()) active.style.transform = 'rotateY(' + Math.max(-45, Math.min(45, dx * 0.28)) + 'deg)';
      }
    });
    const endDrag = ev => {
      if (!drag || ev.pointerId !== drag.id) return;
      const dx = ev.clientX - drag.x;
      const d = drag;
      drag = null;
      viewer.classList.remove('dragging');
      const active = viewer.querySelector('.view.is-active');
      active.style.transform = '';
      if (d.moved && ev.type === 'pointerup' && Math.abs(dx) > 50) turn(dx < 0 ? 1 : -1);
      else if (!d.moved && ev.type === 'pointerup' && d.onKey && viewer.dataset.view === 'iso' && state === 'ready') plug();
    };
    viewer.addEventListener('pointerup', endDrag);
    viewer.addEventListener('pointercancel', endDrag);

    // Sign-in state machine. Nothing here touches real credentials, devices or the network.
    const route = $('route');
    const ROUTE = {
      password: { key: 'Holds the password', pc: 'Helper and on-screen prompt', site: 'Gets the password' },
      passkey: { key: 'Holds the passkey', pc: 'Helper and on-screen prompt', site: 'Checks a signature' }
    };
    const MESSAGES = {
      ready: 'Plug in the key to start. The add-on and helper would need to be installed first.',
      review: 'The key is in. Check the site and account in the prompt, then approve or cancel.',
      released: { password: 'Filled. Nothing was submitted. Press Sign in on the site yourself.', passkey: 'Signed. The site checks the signature. Press Continue.' },
      complete: 'Signed in to the demo. No real account, key or network was used.',
      cancelled: 'Cancelled. Nothing was released.',
      excluded: 'Refused. This site requires a PIN or fingerprint, and the key has neither.'
    };
    function runRoute(cls) {
      route.classList.remove('go', 'go2', 'gopk');
      if (reduced()) return;
      void route.offsetWidth;
      route.classList.add(cls);
    }
    function render() {
      const pw = mode === 'password';
      const inKey = ['review', 'released', 'complete'].includes(state);
      const overlay = state === 'review' || state === 'excluded';
      demo.dataset.state = state;
      demo.dataset.mode = mode;
      viewer.classList.toggle('plugged', inKey);
      if (inKey && viewer.dataset.view !== 'iso') setView('iso');
      // Hidden hotspots and the hidden plug pill leave the tab order while the key is in.
      all('.hs', viewer).forEach(h => { h.inert = inKey; });
      viewer.classList.toggle('idle', state === 'ready');
      $('plug').inert = state !== 'ready';
      $('review').hidden = state !== 'review';
      $('refusal').hidden = state !== 'excluded';
      // Controls under an open prompt are hidden, so nothing shows through or stays focusable.
      all('.site > :not(.prompt):not(.site-brand):not(.site-title)', demo).forEach(el => { el.classList.toggle('under-prompt', overlay); el.inert = overlay; });
      $('review-action').textContent = pw ? 'Fill the password for alex@demo.example on demo.example?' : 'Sign in to demo.example as alex@demo.example with your passkey?';
      $('credential-label').textContent = pw ? 'Password' : 'Passkey';
      const values = { ready: 'Waiting for the key', review: 'Waiting for your approval', released: pw ? '•••••••••••• (demo)' : 'Challenge signed (demo)', cancelled: 'Nothing released', excluded: 'Refused' };
      values.complete = values.released;
      $('credential').textContent = values[state];
      const submit = $('submit');
      submit.disabled = state !== 'released';
      submit.textContent = state === 'complete' ? 'Signed in (demo)' : pw ? 'Sign in' : 'Continue';
      $('start').hidden = state !== 'ready';
      $('start').textContent = pw ? 'Plug in and sign in' : 'Plug in and use a passkey';
      $('replay').hidden = state === 'ready' || state === 'review';
      $('exclude').hidden = state === 'review' || state === 'excluded';
      const msg = MESSAGES[state];
      $('demo-status').textContent = typeof msg === 'string' ? msg : msg[mode];
      all('button[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
      Object.entries(ROUTE[mode]).forEach(([k, v]) => { const el = route.querySelector('[data-r=' + k + ']'); if (el) el.textContent = v; });
      route.querySelector('.n-key').classList.toggle('lit', inKey);
      route.querySelector('.n-pc').classList.toggle('lit', inKey);
      route.querySelector('.w1').classList.toggle('lit', inKey);
      route.querySelector('.n-site').classList.toggle('lit', state === 'released' || state === 'complete');
      route.querySelector('.w2').classList.toggle('lit', state === 'released' || state === 'complete');
      if (!inKey) route.classList.remove('go', 'go2', 'gopk');
      clearSpots();
      setInfo(...stateInfo());
    }
    function set(next) { state = next; render(); }
    function plug() {
      if (state !== 'ready') return;
      viewer.classList.add('touched');
      set('review');
      runRoute('go');
      $('approve').focus({ preventScroll: true });
      // On a phone the prompt sits below the key: bring it into view once the key is in.
      const card = demo.getBoundingClientRect();
      if (card.bottom > innerHeight) setTimeout(() => demo.scrollIntoView({ block: 'end', behavior: reduced() ? 'instant' : 'smooth' }), reduced() ? 0 : 750);
    }
    $('plug').addEventListener('click', plug);
    $('start').addEventListener('click', plug);
    $('approve').addEventListener('click', () => {
      set('released');
      runRoute(mode === 'password' ? 'go2' : 'gopk');
      const field = demo.querySelector('.cred');
      field.classList.remove('filled'); void field.offsetWidth; field.classList.add('filled');
      $('submit').focus({ preventScroll: true });
    });
    $('cancel').addEventListener('click', () => { set('cancelled'); $('replay').focus({ preventScroll: true }); });
    $('submit').addEventListener('click', () => { if (state === 'released') { set('complete'); $('replay').focus({ preventScroll: true }); } });
    $('replay').addEventListener('click', () => { set('ready'); $('start').focus({ preventScroll: true }); });
    $('exclude').addEventListener('click', () => { mode = 'passkey'; set('excluded'); $('fallback').focus({ preventScroll: true }); });
    $('fallback').addEventListener('click', () => { mode = 'password'; set('ready'); $('start').focus({ preventScroll: true }); });
    all('button[data-mode]').forEach(b => b.addEventListener('click', () => { mode = b.dataset.mode; set('ready'); }));
    setView('iso');
    render();
  }

  applyMotion();
  root.classList.add('enhanced');
  revealTarget();
})();
