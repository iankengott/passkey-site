/* Passkey concept site, N28 presentation with the V1 hero video. Offline progressive enhancement.
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
    dispatchEvent(new Event('passkey-motion'));
  }
  if (motionBtn) motionBtn.addEventListener('click', () => {
    if (media.matches) return;
    userReduce = !userReduce;
    try { localStorage.setItem('passkey-reduce-motion', userReduce ? '1' : '0'); } catch (err) { /* not kept */ }
    applyMotion();
  });
  media.addEventListener('change', applyMotion);

  // ------------------------------------------------------------ scroll reveal and counters
  // Counters show their final number at once; only the charts around them animate.
  function count(el) { el.textContent = el.dataset.count; }
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
    let id = '';
    try { id = decodeURIComponent(location.hash.slice(1)); } catch (err) { return; }   // a malformed fragment such as #% is ignored
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

  // ------------------------------------------------------------ hero: V1 video, then "Take control" plugs the key in and signs in
  // Fake demo data only. The continuation is a rendered video; nothing here touches credentials, devices, USB or the network.
  // States: intro (main video) -> poised (key waits at the port, popup, indefinitely) -> taking (continuation) -> signed.
  // error: a play or media failure shows the still with "Video could not play" and Try again, never the signed end.
  // The key goes in only from the Take control button. Replay returns to intro; the popup always comes back before insertion.
  const product = $('product');
  const main = $('hero-video');
  const cont = $('hero-cont');
  if (product && main && cont) {
    const V = JSON.parse(product.dataset.video);
    const stage = $('stage');
    const hero = product.closest('.hero') || product;
    const start = $('start');
    const startLabel = start.querySelector('span');
    const startIcon = start.querySelector('use');
    const take = $('take');
    const takeBtn = $('take-control');
    const errBox = $('v-error');
    const retryBtn = $('v-retry');
    const cap = $('hero-cap');   // only present when the published video has page captions; V1 has none
    const capT = cap && cap.querySelector('.hcap-t');
    const capS = cap && cap.querySelector('.hcap-s');
    const bPlay = $('v-play'), bSkip = $('v-skip'), bReplay = $('v-replay'), bSound = $('v-sound');
    const status = $('hero-status');
    let state = 'intro';
    let played = false;          // the main video has played at least once
    let failedPart = '';         // 'main' or 'cont' while state is 'error'
    let waiting = false;         // opened at another section: no autoplay or fetch until the hero is seen or play is pressed
    // Sound is on by default (Ian, 11 November). A browser that refuses unmuted autoplay gets a muted start with a
    // "Turn on sound" cue. Only the sound control or a tap or click on the video itself then turns the sound on;
    // clicks and key presses elsewhere on the page never do. A viewer who mutes keeps that choice.
    let soundOn = true;
    try { if (localStorage.getItem('passkey-hero-sound') === '0') soundOn = false; } catch (err) { /* storage blocked: default */ }
    let soundWaiting = false;    // the browser made us start muted; waiting for the sound control or a tap on the video
    const sndLabel = bSound.querySelector('.snd-l');
    function applySound() {
      const audible = soundOn && !soundWaiting;
      main.muted = cont.muted = !audible;
      bSound.setAttribute('aria-pressed', String(audible));
      bSound.dataset.wait = String(soundWaiting);
      sndLabel.textContent = soundWaiting ? 'Turn on sound' : 'Sound';
    }
    function soundFromVideo() {
      if (!soundWaiting) return false;
      const v = state === 'taking' ? cont : main, wasPlaying = !v.paused;
      soundWaiting = false;
      applySound();
      // Some browsers pause a video unmuted without a user activation; fall back to muted and keep waiting.
      if (wasPlaying && v.paused) { soundWaiting = true; applySound(); v.play().catch(() => null); }
      return true;
    }
    applySound();
    let offscreenPaused = false;
    main.removeAttribute('controls');
    const quietTracks = () => { for (const t of main.textTracks) t.mode = 'disabled'; };
    quietTracks();
    main.textTracks.addEventListener && main.textTracks.addEventListener('addtrack', quietTracks);
    // Where and how big the 16:10 picture is drawn inside the stage, for any object-fit and object-position.
    function picture() {
      const r = stage.getBoundingClientRect(), cs = getComputedStyle(main);
      const s = (cs.objectFit === 'cover' ? Math.max : Math.min)(r.width / 1920, r.height / 1200);
      const [px, py] = cs.objectPosition.split(' ').map(v => parseFloat(v) / 100);
      const w = 1920 * s, h = 1200 * s;
      return { r, w, h, x: (r.width - w) * (isNaN(px) ? 0.5 : px), y: (r.height - h) * (isNaN(py) ? 0.5 : py) };
    }
    // The 960 px files are the default. The 1920 px masters load only on genuinely large displays, where the picture is
    // drawn at least 1200 CSS px wide (a screen about 2100 px wide), and only when the browser has not asked to save data.
    // Pixel density alone does not count: a 1440 px wide laptop at 2x gets 960.
    const saveData = () => { const c = navigator.connection; return !!(c && (c.saveData || /(^|-)2g$|^3g$/.test(c.effectiveType || ''))); };
    const width = () => (!saveData() && picture().w >= 1200 ? '1920' : '960');
    function load(v, part, preload) {
      if (v.dataset.src) return;
      const files = V[part].src;
      v.dataset.src = files[width()] || files['960'] || Object.values(files)[0];   // a draft encode has only one size
      v.src = v.dataset.src;
      v.preload = preload;
      v.load();
    }
    // Forget a failed file so Try again fetches it afresh; the element shows its poster meanwhile.
    function unload(v) {
      delete v.dataset.src;
      v.removeAttribute('src');
      v.preload = 'none';
      try { v.load(); } catch (err) { /* nothing loaded */ }
    }
    // The poised still must be decoded before the continuation layer covers the main video, so the swap never flashes.
    const poisedImg = new Image();
    poisedImg.src = V.posters.poised;
    const poisedReady = poisedImg.decode().catch(() => null);
    new Image().src = V.posters.signed;

    // captions: page text, synced to the playing part; the latest caption holds until the next one
    let capKey = '';
    function caption(part, t) {
      const caps = V[part].caps;
      if (!cap || !caps.length) return;
      let c = caps[0];
      for (const x of caps) if (t >= x.start) c = x;
      const key = part + c.start;
      if (key === capKey) return;
      capKey = key;
      capT.textContent = c.title;
      capS.textContent = c.sub;
      cap.classList.remove('swap'); void cap.offsetWidth; cap.classList.add('swap');
    }
    function tick() {
      if (state === 'intro') caption('main', main.currentTime || 0);
      else if (state === 'taking' || state === 'signed') caption('cont', state === 'signed' ? V.cont.dur : cont.currentTime || 0);
      if (!main.paused || !cont.paused) requestAnimationFrame(tick);
    }

    // where the popup goes on the desktop stage: left of the poised key, mapped through the picture's drawn box
    function place() {
      if (getComputedStyle(take).position !== 'absolute') { take.style.removeProperty('--tx'); take.style.removeProperty('--ty'); return; }
      const { r, w: dw, h: dh, x: ox, y: oy } = picture();
      const pts = ['key_tip', 'key_centre', 'key_rear', 'port'].map(k => [ox + V.anchor[k][0] * dw, oy + V.anchor[k][1] * dh]);
      const card = take.getBoundingClientRect();
      const left = Math.max(ox, 0) + 16;                              // inside the picture
      const minX = Math.min(...pts.map(p => p[0])), minY = Math.min(...pts.map(p => p[1]));
      const cy = oy + V.anchor.key_centre[1] * dh;
      if (minX - 28 - card.width >= left) {                          // room beside the key: to its left
        take.dataset.place = 'left';
        take.style.setProperty('--tx', (minX - 28).toFixed(1) + 'px');
        take.style.setProperty('--ty', Math.min(Math.max(cy, card.height / 2 + 16), r.height - card.height / 2 - 16).toFixed(1) + 'px');
      } else {                                                       // otherwise above the key and the port
        take.dataset.place = 'above';
        const cx = ox + V.anchor.key_centre[0] * dw;
        take.style.setProperty('--tx', Math.min(Math.max(cx, left + card.width / 2), r.width - card.width / 2 - 16).toFixed(1) + 'px');
        take.style.setProperty('--ty', Math.max(minY - 28, card.height + 16).toFixed(1) + 'px');
      }
    }
    addEventListener('resize', () => { if (state === 'poised') place(); });

    function render() {
      product.dataset.state = state;
      take.hidden = state !== 'poised';
      errBox.hidden = state !== 'error';
      const playing = (state === 'intro' && !main.paused) || (state === 'taking' && !cont.paused);
      bPlay.hidden = !(state === 'intro' || state === 'taking');
      bPlay.dataset.paused = String(!playing);
      bPlay.setAttribute('aria-label', playing ? 'Pause the video' : 'Play the video');
      bSkip.hidden = state !== 'intro';
      bReplay.hidden = state === 'intro' || state === 'error';
      // "Restart demo" while the main video plays; "Watch again" once it has played through to the key at the port, or beyond.
      const again = played && (state === 'poised' || state === 'taking' || state === 'signed');
      const restart = state === 'intro' && !main.paused;
      startLabel.textContent = again ? 'Watch again' : restart ? 'Restart demo' : 'Watch demo';
      startIcon.setAttribute('href', again || restart ? '#i-replay' : '#i-play');
      if (state === 'poised') requestAnimationFrame(place);
    }
    function say(text) { status.textContent = ''; setTimeout(() => { status.textContent = text; }, 60); }

    // A play or media failure: the still, a short message and Try again. Never the signed end state.
    function failed(part) {
      if (state === 'error') return;
      failedPart = part;
      state = 'error';
      main.pause();
      cont.pause();
      unload(part === 'cont' ? cont : main);
      if (part === 'cont') { cont.poster = V.posters.poised; cont.hidden = false; }
      else cont.hidden = true;
      render();
      say('The video could not play. Try again.');
    }
    // Autoplay refused by browser policy is not a failure: the poised still and popup wait for the viewer instead.
    const refused = (err, part) => {
      if (err && err.name === 'AbortError') return;   // a newer load or pause replaced this play request
      if (part === 'main' && err && err.name === 'NotAllowedError') toPoised(false);
      else failed(part);
    };

    function playMain(fromStart) {
      waiting = false;
      load(main, 'main', 'auto');
      state = 'intro';
      cont.pause();
      cont.hidden = true;
      if (fromStart) { try { main.currentTime = 0; } catch (err) { /* not seekable yet: starts at 0 anyway */ } }
      applySound();
      capKey = '';
      caption('main', fromStart ? 0 : main.currentTime || 0);
      render();
      const ok = () => { played = true; render(); requestAnimationFrame(tick); };
      const p = main.play();
      if (p) p.then(ok).catch(err => {
        // Unmuted autoplay refused: start muted with the sound cue. Any other refusal: see refused().
        if (!main.muted && err && err.name === 'NotAllowedError' && state === 'intro') {
          soundWaiting = true;
          applySound();
          main.play().then(ok).catch(e2 => { if (state === 'intro') refused(e2, 'main'); });
        } else if (state === 'intro') refused(err, 'main');
      });
    }
    async function toPoised(focus) {
      if (state === 'poised') return;
      state = 'poised';
      main.pause();
      // Show the poised frame: the continuation layer, still at its first frame or poster, which is the same picture.
      try { if (cont.dataset.src && cont.readyState >= 1) cont.currentTime = 0; } catch (err) { /* poster shows instead */ }
      cont.poster = V.posters.poised;
      await poisedReady;
      if (state !== 'poised') return;
      cont.hidden = false;
      render();
      say('The key is ready at the port. Take control to plug it in.');
      if (focus) {
        // After a viewer action, bring the popup into view on stacked layouts, below the sticky header. A natural end never scrolls.
        const r = take.getBoundingClientRect(), head = document.querySelector('.top');
        if (r.bottom > innerHeight || r.top < (head ? head.getBoundingClientRect().bottom : 0)) take.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'instant' : 'smooth' });
        takeBtn.focus({ preventScroll: true });
      }
    }
    function showSigned() {
      state = 'signed';
      cont.hidden = false;
      cont.pause();
      if (cont.readyState >= 1 && isFinite(cont.duration)) { try { cont.currentTime = Math.max(0, cont.duration - 0.05); } catch (err) { cont.poster = V.posters.signed; } }
      else cont.poster = V.posters.signed;
      capKey = '';
      caption('cont', V.cont.dur);
      render();
      say('Signed in to the demo computer.');
    }
    async function takeControl() {
      if (state !== 'poised') return;
      applySound();
      // Reduce motion: the signed-in frame by design, without playing. Not a failure path.
      if (reduced()) { showSigned(); bReplay.focus({ preventScroll: true }); return; }
      load(cont, 'cont', 'auto');
      state = 'taking';
      capKey = '';
      caption('cont', 0);
      render();
      bPlay.focus({ preventScroll: true });
      say('Plugging in the key. The screen asks for approval, then signs in to the demo account.');
      try { await cont.play(); requestAnimationFrame(tick); render(); }
      catch (err) { if (state === 'taking' && !(err && err.name === 'AbortError')) { failed('cont'); retryBtn.focus({ preventScroll: true }); } }
    }
    // The continuation downloads only when the viewer shows intent: hover, focus or a press on Take control.
    const intent = () => { if (state === 'poised' && !reduced()) load(cont, 'cont', 'auto'); };
    ['pointerenter', 'focus', 'pointerdown', 'touchstart'].forEach(ev => takeBtn.addEventListener(ev, intent, { passive: true }));

    main.addEventListener('ended', () => { if (state === 'intro') toPoised(false); });
    main.addEventListener('error', () => { if (state === 'intro' && main.dataset.src) failed('main'); }, true);
    cont.addEventListener('ended', () => { if (state === 'taking') { showSigned(); if (document.activeElement === bPlay || document.activeElement === document.body) bReplay.focus({ preventScroll: true }); } });
    cont.addEventListener('error', () => { if (state === 'taking' && cont.dataset.src) failed('cont'); }, true);
    ['play', 'pause'].forEach(ev => { main.addEventListener(ev, render); cont.addEventListener(ev, render); });
    main.addEventListener('playing', () => { played = true; });

    takeBtn.addEventListener('click', takeControl);
    bSkip.addEventListener('click', () => toPoised(true));
    bReplay.addEventListener('click', () => { offscreenPaused = false; playMain(true); bPlay.focus({ preventScroll: true }); });
    bPlay.addEventListener('click', () => {
      const v = state === 'taking' ? cont : main;
      offscreenPaused = false;
      if (state === 'intro' && !main.dataset.src) { playMain(false); return; }   // first play after a deferred start
      if (v.paused) { v.play().then(() => requestAnimationFrame(tick)).catch(err => refused(err, v === cont ? 'cont' : 'main')); } else v.pause();
    });
    retryBtn.addEventListener('click', () => {
      if (state !== 'error') return;
      const part = failedPart;
      failedPart = '';
      if (part === 'cont') { state = 'poised'; takeControl(); }
      else { playMain(true); bPlay.focus({ preventScroll: true }); }
    });
    // A tap or click on the video: turns the sound on while the cue shows; otherwise pauses or plays the intro.
    main.addEventListener('click', () => { if (!soundFromVideo() && state === 'intro') bPlay.click(); });
    cont.addEventListener('click', () => { soundFromVideo(); });
    bSound.addEventListener('click', () => {
      if (soundWaiting) { soundWaiting = false; soundOn = true; }
      else soundOn = !soundOn;
      try { localStorage.setItem('passkey-hero-sound', soundOn ? '1' : '0'); } catch (err) { /* not kept */ }
      applySound();
    });
    const toStage = () => { if (stage.getBoundingClientRect().top > innerHeight * 0.6) stage.scrollIntoView({ block: 'center', behavior: reduced() ? 'instant' : 'smooth' }); };
    start.addEventListener('click', () => {
      if (state === 'error') { retryBtn.click(); return; }
      if (state === 'intro') { playMain(!main.paused); toStage(); return; }   // playing: restart from the beginning; paused: play
      playMain(true);
      toStage();
    });
    // Pause while the hero is scrolled away, resume when it returns (unless the viewer paused it).
    if ('IntersectionObserver' in window) new IntersectionObserver(([en]) => {
      const v = state === 'taking' ? cont : state === 'intro' ? main : null;
      if (!v) return;
      if (!en.isIntersecting && !v.paused) { offscreenPaused = true; v.pause(); }
      else if (en.isIntersecting && offscreenPaused) { offscreenPaused = false; v.play().then(() => requestAnimationFrame(tick)).catch(() => null); }
    }, { threshold: 0.25 }).observe(stage);
    // Turning Reduce motion on stops the video where it is; the viewer can still press play.
    addEventListener('passkey-motion', () => { if (reduced()) { if (!main.paused) main.pause(); if (!cont.paused) cont.pause(); } });

    // A page opened at a link such as #buy does not autoplay or fetch the main video until the hero is in view
    // or the viewer presses play. The browser's own jump to the anchor can be a smooth scroll that starts after the load
    // event and passes over the hero, so watching starts only once scrolling has been still for 300 ms, and the hero
    // must then stay in view for half a second.
    let target = null;
    try { target = location.hash.length > 1 && document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (err) { target = null; }   // malformed fragment: play as normal
    waiting = !!target && !target.contains(product) && !hero.contains(target);
    function startWhenSeen() {
      if (!('IntersectionObserver' in window)) return;   // without it, the viewer presses play
      let dwell = 0;
      const seen = new IntersectionObserver(([en]) => {
        clearTimeout(dwell);
        if (!waiting) { seen.disconnect(); return; }
        if (en.isIntersecting) dwell = setTimeout(() => { if (waiting && state === 'intro' && !main.dataset.src) { seen.disconnect(); playMain(false); } }, 500);
      }, { threshold: 0.25 });
      seen.observe(stage);
    }
    function armAfterScroll() {
      let idle = 0;
      const still = () => { clearTimeout(idle); idle = setTimeout(() => { removeEventListener('scroll', still); startWhenSeen(); }, 300); };
      addEventListener('scroll', still, { passive: true });
      still();
    }
    // Start: autoplay with sound (muted if the browser insists), unless motion is reduced, the page opened at another
    // section, or the browser blocks it; then the poised still and popup.
    if (reduced()) toPoised(false);
    else if (waiting) {
      render();
      if (document.readyState === 'complete') armAfterScroll(); else addEventListener('load', armAfterScroll, { once: true });
    } else playMain(false);
  }

  // ------------------------------------------------------------ Reserve: copy the address for people without an email app
  // A press on Reserve yours still opens the email link; the help line is emphasised in case no email app opened.
  const reserveBtn = $('reserve'), nudge = $('addr-nudge');
  if (reserveBtn && nudge) reserveBtn.addEventListener('click', () => { nudge.hidden = false; $('addr-help').classList.add('nudged'); });
  const copyBtn = $('copy-address');
  if (copyBtn) copyBtn.addEventListener('click', async () => {
    const out = $('copy-status');
    let ok = false;
    try { await navigator.clipboard.writeText(copyBtn.dataset.copy); ok = true; } catch (err) { /* fall back to selecting the address */ }
    if (!ok) {
      const range = document.createRange();
      range.selectNodeContents($('reserve-address'));
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
    }
    out.textContent = ok ? 'Address copied.' : 'The address is selected. Copy it with your keyboard or menu.';
  });

  applyMotion();
  root.classList.add('enhanced');
  revealTarget();
})();
