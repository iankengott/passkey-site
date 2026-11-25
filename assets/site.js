/* Passkey concept site, N38 interactive demo. Offline progressive enhancement.
   The Store sends reservation details to its configured endpoint. One stored preference: the Reduce motion choice. */
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

  // Keep old home-page links working after moving content to its own page.
  if ($('px-hero')) {
    const moved = new Map([
      ['#buy', 'store.html#buy'],
      ['#position', 'security.html#position'],
      ['#glance', 'compatibility.html#works'],
      ['#features', 'compatibility.html#details'],
    ]);
    const target = moved.get(location.hash);
    if (target) {
      location.replace(target);
      return;
    }
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

  // Match the hero shader's four amber tones and ordered dithering.
  const photo = $('about-photo');
  if (photo) {
    const pixels = $('about-pixels');
    const context = pixels.getContext('2d');
    if (context) {
      function renderPortrait() {
        if (!photo.naturalWidth) return;
        const { width, height } = pixels;
        const css = getComputedStyle(root);
        const palette = ['--a0', '--a1', '--a2', '--a3'].map(name => {
          const hex = css.getPropertyValue(name).trim();
          return [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
        });
        const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
        context.imageSmoothingQuality = 'high';
        context.drawImage(photo, 0, 0, width, height);
        const image = context.getImageData(0, 0, width, height);
        const data = image.data;
        const backdrop = data.slice(0, 3);
        const background = new Uint8Array(width * height);
        for (let i = 0; i < background.length; i++) {
          const offset = i * 4;
          background[i] = backdrop.every((v, channel) => Math.abs(data[offset + channel] - v) <= 18);
        }
        for (let i = 0; i < background.length; i++) {
          const offset = i * 4;
          if (background[i]) { data[offset + 3] = 0; continue; }
          const x = i % width, y = Math.floor(i / width);
          const light = (.299 * data[offset] + .587 * data[offset + 1] + .114 * data[offset + 2]) / 255;
          const dither = (bayer[(y % 4) * 4 + (x % 4)] + .5) / 16 - .5;
          const tone = Math.round(Math.min(3, Math.max(0, (light - .15) * 4.2 + dither)));
          const rim = (x > 0 && background[i - 1]) || (y > 0 && background[i - width]);
          data.set(palette[rim ? Math.max(2, tone) : tone], offset);
        }
        context.putImageData(image, 0, 0);
        pixels.hidden = false;
        photo.hidden = true;
        floatPortraitPixels($('about-particles'));
      }
      if (photo.complete) renderPortrait();
      else photo.addEventListener('load', renderPortrait, { once: true });
    }
  }

  function floatPortraitPixels(canvas) {
    const context = canvas.getContext('2d');
    if (!context) return;
    const css = getComputedStyle(root);
    const amber = css.getPropertyValue('--a3').trim();
    const light = css.getPropertyValue('--pen').trim();
    const shade = css.getPropertyValue('--a0').trim();
    const points = [
      [8, 16], [23, 7], [41, 4], [70, 8], [90, 14], [96, 37],
      [91, 68], [96, 85], [76, 94], [47, 94], [23, 92], [6, 76],
      [7, 54], [13, 32], [31, 25], [53, 19], [63, 33], [39, 40],
      [70, 49], [48, 55], [34, 66], [60, 69], [71, 77], [52, 82],
    ];
    let elapsed = 0;
    let previous = 0;
    let request = null;
    let visible = !('IntersectionObserver' in window);

    function draw() {
      const size = canvas.width;
      context.clearRect(0, 0, size, size);
      points.forEach(([x, y], i) => {
        // Treat each square as a point at a different depth and project it onto the portrait.
        const phase = i * 2.39996 + elapsed * (.38 + i % 5 * .065);
        const depth = Math.sin(phase * .73);
        const scale = 1 / (1 - depth * .16);
        const px = size * (.5 + ((x - 50) / 100 + Math.cos(phase) * .016) * scale);
        const py = size * (.5 + ((y - 50) / 100 + Math.sin(phase) * .019) * scale);
        const crossesPortrait = x > 25 && x < 80 && y > 18 && y < 85;
        const side = (crossesPortrait || i % 4 === 0 ? 3 : 2) * scale;
        const opacity = (crossesPortrait ? .48 : .34) + (depth + 1) * .23;
        context.globalAlpha = opacity * .85;
        context.fillStyle = shade;
        context.fillRect(px - .6, py - .6, side + 1.2, side + 1.2);
        context.globalAlpha = opacity;
        context.fillStyle = crossesPortrait ? light : amber;
        context.fillRect(px, py, side, side);
      });
      context.globalAlpha = 1;
    }

    function tick(now) {
      if (previous) elapsed += Math.min(now - previous, 40) / 1000;
      previous = now;
      draw();
      request = requestAnimationFrame(tick);
    }

    function sync() {
      if (visible && !document.hidden && !reduced()) {
        if (request === null) request = requestAnimationFrame(tick);
      } else if (request !== null) {
        cancelAnimationFrame(request);
        request = null;
        previous = 0;
      }
    }
    draw();
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        sync();
      }).observe(canvas);
    }
    addEventListener('passkey-motion', sync);
    document.addEventListener('visibilitychange', sync);
    sync();
  }

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
  // Finish a deep link after images and layout settle if its target is still off screen.
  addEventListener('load', () => {
    let t = null;
    try { t = location.hash.length > 1 && document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (err) { t = null; }
    if (t && !t.closest('dialog') && Math.abs(t.getBoundingClientRect().top) > innerHeight) t.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, { once: true });

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
  all('[data-open]').forEach(b => b.addEventListener('click', ev => {
    const dialog = $(b.dataset.open);
    if (typeof dialog.showModal !== 'function') return;
    ev.preventDefault();
    opener = b;
    dialog.showModal();
    dispatchEvent(new Event('resize'));
  }));
  all('dialog').forEach(d => {
    d.querySelector('[data-close]').addEventListener('click', () => closeDialog(d));
    d.addEventListener('cancel', ev => { ev.preventDefault(); closeDialog(d); });
    d.addEventListener('click', ev => { if (ev.target === d) closeDialog(d); });
    d.addEventListener('close', () => { if (opener) opener.focus(); });
    d.addEventListener('keydown', ev => {
      if (ev.key !== 'Tab') return;
      const items = all('button:enabled,input:enabled,select:enabled,a[href],summary', d).filter(x => x.getClientRects().length);
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

  // ------------------------------------------------------------ Reserve
  const reserveForm = $('reserve-form');
  if (reserveForm) {
    const contact = $('reserve-contact'), phoneField = $('reserve-phone-field');
    const phone = reserveForm.elements.namedItem('phone');
    const submit = reserveForm.querySelector('[type=submit]');
    const error = $('reserve-error');
    const dialog = $('reserve-dialog');
    function updateContact() {
      const texting = contact.value === 'text';
      phoneField.hidden = !texting;
      phone.disabled = !texting;
      phone.required = texting;
    }
    contact.addEventListener('change', updateContact);
    updateContact();
    reserveForm.addEventListener('submit', async event => {
      event.preventDefault();
      if (submit.disabled || !reserveForm.dataset.endpoint) return;
      error.hidden = true;
      submit.disabled = true;
      submit.textContent = 'Submitting…';
      try {
        const response = await fetch(reserveForm.dataset.endpoint, {
          method: 'POST',
          credentials: 'omit',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(Object.fromEntries(new FormData(reserveForm))),
          signal: AbortSignal.timeout(12000),
        });
        const result = await response.json();
        if (!response.ok || !result.accepted) {
          error.textContent = typeof result.error === 'string' ? result.error : 'The reservation could not be submitted. Try again.';
          error.hidden = false;
          return;
        }
        $('reserve-status').textContent = 'Reservation saved. Look for a confirmation from passkey186@gmail.com. If it hasn’t arrived, check Spam.';
        reserveForm.reset();
        updateContact();
        closeDialog(dialog);
      } catch {
        error.textContent = 'Couldn’t reach the reservation service. You can try again.';
        error.hidden = false;
      } finally {
        submit.disabled = false;
        submit.textContent = 'Confirm reservation';
      }
    });
  }

  applyMotion();
  root.classList.add('enhanced');
  revealTarget();
})();
