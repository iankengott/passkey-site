/* N39 key editor. Two modes. Demo mode (the public page with no Passkey software): fake sites and accounts, Update only exports a file, nothing is sent anywhere.
   Key mode: the Passkey browser extension is present (or a test bridge is given with ?bridge=), the editor reads the key's settings through the helper, and Update
   asks the extension to write them. The extension confirms in its own window and the key asks for its own press. The page never talks to the key itself.
   The settings object follows settings-schema.json (as schema-data.js). validate.js decides what is allowed.
   Everything the owner writes is data: numbers, short words, short plain text. Text reaches the page only through textContent. */
(function () {
  'use strict';
  const SCHEMA = window.PK_SCHEMA, THEMES = window.PK_THEMES, ORDER = window.PK_THEME_ORDER, V = window.PKV;
  const $ = (s, r) => (r || document).querySelector(s);
  const clone = o => JSON.parse(JSON.stringify(o));

  function el(tag, props, ...kids) {
    const e = document.createElement(tag);
    if (props) for (const k of Object.keys(props)) {
      const v = props[k];
      if (v === false || v == null) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else if (v === true) e.setAttribute(k, '');
      else e.setAttribute(k, v);
    }
    for (const c of kids.flat(Infinity)) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
    return e;
  }
  let uidn = 0; const uid = () => 'f' + (++uidn);

  // ---------------------------------------------------------------- fake catalogue (the real one lives on the PC and holds no secrets)
  function fnv(s) { let h = 0xcbf29ce484222325n; for (const ch of new TextEncoder().encode(s)) { h ^= BigInt(ch); h = (h * 0x100000001b3n) & 0xffffffffffffffffn; } return h.toString(16).padStart(16, '0'); }
  // The real site key is the first 8 bytes of SHA-256 of the origin. FNV stands in here so the page works without a secure context.
  const CATALOGUE = [
    { origin: 'https://signin.example.test', accounts: ['alex@example.test', 'alex.work@example.test'], used: '2 days ago', date: '23 Nov 2026', nick: 'Work sign in' },
    { origin: 'https://mail.example.test', accounts: ['alex@example.test'], used: 'today', date: '25 Nov 2026', nick: '' },
    { origin: 'https://chat.example.test', accounts: ['alex@example.test'], used: '5 days ago', date: '20 Nov 2026', nick: 'Team chat' },
    { origin: 'https://shop.example.test', accounts: ['alex.shop@example.test'], used: '3 weeks ago', date: '4 Nov 2026', nick: '' },
    { origin: 'https://git.example.test', accounts: ['alex-dev'], used: 'yesterday', date: '24 Nov 2026', nick: '' },
    { origin: 'https://news.example.test', accounts: ['alex@example.test'], used: '2 months ago', date: '9 Sep 2026', nick: '' },
  ];
  CATALOGUE.forEach(c => { c.key = fnv(c.origin); });
  const FONTS = {
    'system-sans': 'Arial,"Liberation Sans",Helvetica,sans-serif',
    'system-mono': 'ui-monospace,"DejaVu Sans Mono",Menlo,Consolas,monospace',
    'departure-mono': '"Departure Mono",ui-monospace,monospace',
    'system-serif': 'Georgia,"Liberation Serif",serif',
  };
  // Locked texts, copied from the shipped wording (analysis/prompt-design/wording.json and the N14 reason table). Owners cannot change them.
  const LOCKED_TEXT = {
    get: 'This form uses GET. Its password may appear in the address after submit.',
    position: 'The username field was chosen by its position.',
    allowOpen: 'Allow this login inside ', allowClose: '? Approving remembers these sites.',
    cancelled: 'Cancelled. Nothing was released.', refused: 'Request refused. Nothing was released.', expired: 'Request expired. No approval was sent.',
    tooMany: 'Too many sites to list in full. Nothing will be filled.', noRoom: 'There is no room for the full prompt here. Nothing will be filled.',
    unverified: 'This approval frame could not be verified.', noRelease: 'No credentials were released.',
    // Proposed for the preview. Today the browser shows the code, for example "Refused: ContextChanged". Plain sentences are a proposal for the N19 table.
    wrong: 'Refused. This page is not the site your saved login belongs to. Nothing was released.',
    frame: 'Refused. This login is inside a frame that is not allowed. Nothing was released.',
  };
  const REASONS = { none: '', settle: 'One moment, checking the prompt', moving: 'Waiting for the login box to stop moving', overflow: 'The prompt does not fit here' };

  // ---------------------------------------------------------------- state
  // ---------------------------------------------------------------- the link to the key (key mode)
  const keyInfo = { mode: 'demo', supported: false, state: null, generation: 0, safe: false, corrupt: false, summary: '' };
  const Bridge = (() => {
    const bridgeUrl = new URLSearchParams(location.search).get('bridge'); // a test server stands in for the extension
    if (bridgeUrl) return { available: () => true, call: (op, doc) => fetch(bridgeUrl.replace(/\/$/, '') + '/' + op, { method: 'POST', body: JSON.stringify({ document: doc }) }).then(r => r.json()).catch(() => ({ error: 'NoAnswer' })) };
    let n = 0; const pend = {};
    window.addEventListener('message', e => { if (e.source !== window || !e.data || e.data.channel !== 'pk-editor-reply') return; const f = pend[e.data.id]; if (f) { delete pend[e.data.id]; f(e.data.result); } });
    return {
      available: () => document.documentElement.getAttribute('data-passkey-editor-bridge') === '1',
      call: (op, doc) => new Promise(res => { const id = 'r' + (++n); pend[id] = res; window.postMessage({ channel: 'pk-editor', id, op, document: doc }, window.location.origin); setTimeout(() => { if (pend[id]) { delete pend[id]; res({ error: 'NoAnswer' }); } }, 200000); }),
    };
  })();
  const FACTORY = () => clone(THEMES['classic-blue']);
  function withSites(s, keepNicknames) {
    const have = new Set(s.sites.items.map(i => i.siteKey));
    for (const c of CATALOGUE) if (!have.has(c.key)) s.sites.items.push({ siteKey: c.key, nickname: keepNicknames ? c.nick : '', pinned: false });
    return s;
  }
  let S = withSites(FACTORY(), true), BASE = clone(S);
  let result = V.validate(S, SCHEMA), lastGood = clone(S);
  const ui = { tab: 'colours', state: 'fill', variant: 'wrong', surface: 'browser', width: 'wide', site: 0, framed: false, get: false, update: true, reason: 'none', locks: false, shade: null, shadeKey: '', ledOne: false, imported: null };
  const DRAFT_KEY = 'pk-n39-draft';
  function saveDraft() { try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ S, BASE })); } catch (e) { /* storage may be blocked */ } }
  function loadDraft() {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      if (!d || !d.S || !d.BASE) return false;
      if (V.validate(d.S, SCHEMA).errors.some(e => e.rule === 'R-SCHEMA') || V.validate(d.BASE, SCHEMA).errors.some(e => e.rule === 'R-SCHEMA')) return false;
      S = withSites(d.S, true); BASE = withSites(d.BASE, true); return true;
    } catch (e) { return false; }
  }

  const getp = p => p.split('.').reduce((o, k) => o[k], S);
  function setp(p, v) { const k = p.split('.'); let o = S; for (const x of k.slice(0, -1)) o = o[x]; o[k[k.length - 1]] = v; }
  function nodeAt(path) { let n = SCHEMA; for (const k of path.split('.')) { n = n.properties && n.properties[k]; if (!n) return null; } return n; }

  // ---------------------------------------------------------------- toasts
  let toastTimer = 0;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 5000); }

  // ---------------------------------------------------------------- fields
  let FIELDS = [], HOOKS = [];
  const badge = cls => el('span', { class: 'badge b-' + cls, text: cls });
  function limitText(n) {
    if (!n) return '';
    if (n.type === 'integer' || n.type === 'number') return 'Limit: ' + n.minimum + ' to ' + n.maximum + '.';
    if (n.type === 'string' && n.maxLength && !n.enum) return 'Limit: up to ' + n.maxLength + ' characters.';
    return '';
  }
  function shell(path, label, node, control, forId) {
    const cls = (node && node['x-class']) || 'editable';
    const lim = limitText(node), why = node && node['x-why'] || '';
    const root = el('div', { class: 'field' },
      el('label', { for: forId }, el('span', { text: label }), badge(cls)),
      control,
      (lim || why) ? el('div', { class: 'hint' }, lim ? el('span', { class: 'lim', text: lim + ' ' }) : null, why) : null,
      el('div', { class: 'err', role: 'alert' }));
    FIELDS.push({ path, root });
    return root;
  }
  function numField(path, label) {
    const n = nodeAt(path), id = uid(), step = n.type === 'number' ? 0.05 : 1;
    const range = el('input', { type: 'range', id, min: n.minimum, max: n.maximum, step });
    const num = el('input', { type: 'number', step, 'aria-label': label + ', typed value' });
    range.value = num.value = getp(path);
    range.addEventListener('input', () => { setp(path, Number(range.value)); num.value = range.value; changed(); });
    num.addEventListener('input', () => { if (num.value === '') return; const v = Number(num.value); setp(path, v); range.value = v; changed(); });
    return shell(path, label, n, el('div', { class: 'row' }, range, num), id);
  }
  function textField(path, label) {
    const n = nodeAt(path), id = uid();
    const inp = el('input', { type: 'text', id, value: getp(path), autocomplete: 'off', spellcheck: 'false' });
    inp.addEventListener('input', () => { setp(path, inp.value); changed(); });
    return shell(path, label, n, inp, id);
  }
  function selectField(path, label) {
    const n = nodeAt(path), id = uid();
    const sel = el('select', { id }, n.enum.map(o => el('option', { value: o, text: o })));
    sel.value = getp(path);
    sel.addEventListener('change', () => { setp(path, sel.value); changed(); });
    return shell(path, label, n, sel, id);
  }
  function colourField(path, label) {
    const n = nodeAt(path), id = uid();
    const txt = el('input', { type: 'text', id, value: getp(path), maxlength: '9', spellcheck: 'false', 'aria-label': label + ', hex' });
    const pick = el('input', { type: 'color', 'aria-label': label + ', picker' });
    const sync = () => { const v = getp(path); if (/^#[0-9A-Fa-f]{6}$/.test(v)) pick.value = v.toLowerCase(); };
    sync();
    txt.addEventListener('input', () => { setp(path, txt.value); sync(); changed(); });
    pick.addEventListener('input', () => { const v = pick.value.toUpperCase(); setp(path, v); txt.value = v; changed(); });
    return shell(path, label, n, el('div', { class: 'row' }, pick, txt), id);
  }
  function toggleField(path, label) {
    const n = nodeAt(path), id = uid();
    const cb = el('input', { type: 'checkbox', id });
    cb.checked = !!getp(path);
    cb.addEventListener('change', () => { setp(path, cb.checked); changed(); });
    return shell(path, label, n, el('div', { class: 'tog' }, cb, el('span', { text: 'On' })), id);
  }
  const group = (title, ...kids) => el('div', { class: 'group' }, title ? el('h3', { text: title }) : null, kids);

  // ---------------------------------------------------------------- drag to sort (pointer events, so touch works too)
  function sortable(list, onDrop) {
    list.addEventListener('pointerdown', e => {
      const h = e.target.closest('.handle'); if (!h || !list.contains(h)) return;
      e.preventDefault();
      const items = [...list.children], li = h.closest('li'), from = items.indexOf(li);
      let target = from; li.classList.add('drag'); h.setPointerCapture(e.pointerId);
      const mark = () => { items.forEach(i => i.classList.remove('drop-before', 'drop-after')); if (target >= items.length) items[items.length - 1].classList.add('drop-after'); else items[target].classList.add('drop-before'); };
      const move = ev => { target = items.length; for (let i = 0; i < items.length; i++) { const r = items[i].getBoundingClientRect(); if (ev.clientY < r.top + r.height / 2) { target = i; break; } } mark(); };
      const up = () => {
        h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up);
        items.forEach(i => i.classList.remove('drag', 'drop-before', 'drop-after'));
        const to = target > from ? target - 1 : target;
        if (to !== from) onDrop(from, to, li);
      };
      h.addEventListener('pointermove', move); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
    });
  }

  // ---------------------------------------------------------------- panels
  const TABS = [['colours', 'Colours'], ['look', 'Look'], ['layout', 'Layout'], ['wording', 'Wording'], ['details', 'Details'], ['led', 'Key LED'], ['sounds', 'Sounds'], ['timing', 'Timing'], ['sites', 'Sites'], ['themes', 'Themes'], ['locked', 'Locked']];

  function panelColours() {
    const box = [];
    for (const [ch, name] of [['r', 'Red'], ['g', 'Green'], ['b', 'Blue']]) for (const [i, end] of [[0, 'low'], [1, 'high']]) {
      const p = 'theme.shade.' + ch, id = uid();
      const range = el('input', { type: 'range', min: 0, max: 255, step: 1, id, 'aria-label': name + ' ' + end });
      const num = el('input', { type: 'number', min: 0, max: 255, step: 1, 'aria-label': name + ' ' + end + ', typed value' });
      range.value = num.value = getp(p)[i];
      const put = v => { const a = getp(p).slice(); a[i] = v; setp(p, a); changed(); };
      range.addEventListener('input', () => { num.value = range.value; put(Number(range.value)); });
      num.addEventListener('input', () => { if (num.value === '') return; range.value = num.value; put(Number(num.value)); });
      box.push(el('span', { class: 'rowlbl', text: name + ' ' + end }), el('div', { class: 'row' }, range, num));
    }
    const grid = el('div', { class: 'shade-grid', style: null }, box);
    grid.style.gridTemplateColumns = 'auto 1fr';
    const sw = el('div', { class: 'swatches', 'aria-hidden': 'true' });
    const stats = el('div', { class: 'stats' });
    const shadeField = shell('theme.shade', 'Random shade box', nodeAt('theme.shade.r'), el('div', { class: 'stack' }, grid, sw, stats), null);
    shadeField.querySelector('.hint').replaceChildren(el('span', { class: 'lim', text: 'Every approval card draws one shade at random from this box. ' }), 'A lookalike on the page cannot guess it. The box needs at least about 100,000 usable shades.');
    const refresh = () => {
      const t = S.theme, ok = [0, 1, 2].every(k => [t.shade.r, t.shade.g, t.shade.b][k][0] <= [t.shade.r, t.shade.g, t.shade.b][k][1]);
      sw.replaceChildren();
      if (ok) {
        let seed = 7; const rand = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
        for (let i = 0; i < 12; i++) { const c = V.pickShade(t.shade, t.ink, t.labelAlpha, rand) || [60, 60, 60]; const d = el('div', {}); d.style.background = 'rgb(' + c.join(',') + ')'; sw.append(d); }
        const st = V.shadeStats(t.shade, t.ink, t.labelAlpha);
        stats.textContent = 'About ' + st.count.toLocaleString('en') + ' usable shades. ' + Math.round(st.fraction * 100) + ' percent of the box carries this text colour. Website name reads at ' + (st.minSite ? st.minSite.toFixed(1) : 'n/a') + ' to 1 on the weakest shade. Needs 100,000, 50 percent, 5.5 to 1.';
      } else stats.textContent = 'Fix the range first.';
    };
    refresh(); HOOKS.push(refresh);
    return [
      group('Background', shadeField),
      group('Text', colourField('theme.ink', 'Text colour'), numField('theme.labelAlpha', 'Label strength'), colourField('theme.accent', 'Accent colour'),
        el('p', { class: 'note', text: 'The browser prompt shows white text and no accent colour for now, because its screenshot check accepts only the shade and white. Login screens use your colours. The preview toolbar switches between the two.' })),
    ];
  }
  function panelLook() {
    return [
      group('Type', selectField('theme.font', 'Font'), numField('theme.fontSize', 'Text size'), numField('theme.smallSize', 'Small print size'), numField('theme.siteSize', 'Website name size')),
      group('Shape', numField('theme.radius', 'Corner roundness'), numField('theme.lineWidth', 'Line width'), selectField('theme.density', 'Spacing')),
      group('Marks and motion', selectField('theme.tagGlyph', 'Mark beside the title'), selectField('theme.motion', 'Motion')),
    ];
  }
  const PART_LABEL = { reason: 'Reason line', title: 'Title', question: 'Question', action: 'Action', destination: 'Website name', name: 'Your nickname', account: 'Account', scope: 'Scope', after: 'After approval', safety: 'Safety note', lastUsed: 'Last used', time: 'Time', expiry: 'Expiry line', buttons: 'Buttons', fallback: 'Other sign in options', update: 'Key update line' };
  function tryParts(newParts) {
    const was = new Set(V.checkOrder(S.layout.parts).map(e => e.rule)), now = V.checkOrder(newParts).filter(e => !was.has(e.rule));
    if (now.length) { toast('Not allowed. ' + now[0].message); return false; }
    S.layout.parts = newParts; changed(true); return true;
  }
  function panelLayout() {
    const list = el('ol', { class: 'parts', 'aria-label': 'Parts of the card, top to bottom' });
    const build = () => {
      list.replaceChildren(...S.layout.parts.map((p, i) => {
        const hide = V.HIDEABLE.includes(p.id);
        const up = el('button', { type: 'button', class: 'small', 'aria-label': 'Move ' + PART_LABEL[p.id] + ' up', text: 'Up', onclick: () => { if (i > 0) { const a = clone(S.layout.parts); a.splice(i - 1, 0, a.splice(i, 1)[0]); if (!tryParts(a)) shake(list.children[i]); else build(); } } });
        const dn = el('button', { type: 'button', class: 'small', 'aria-label': 'Move ' + PART_LABEL[p.id] + ' down', text: 'Down', onclick: () => { if (i < S.layout.parts.length - 1) { const a = clone(S.layout.parts); a.splice(i + 1, 0, a.splice(i, 1)[0]); if (!tryParts(a)) shake(list.children[i]); else build(); } } });
        const cb = hide ? el('label', {}, el('input', { type: 'checkbox', checked: p.visible, onchange: e => { const a = clone(S.layout.parts); a[i].visible = e.target.checked; if (!tryParts(a)) { e.target.checked = !e.target.checked; } else build(); } }), 'shown') : el('span', { class: 'badge b-locked', text: 'always shown' });
        return el('li', { class: (hide ? '' : 'fixed') + (p.visible ? '' : ' hid') },
          el('button', { type: 'button', class: 'handle', 'aria-label': 'Drag ' + PART_LABEL[p.id], text: '::' }),
          el('span', { class: 'pname' }, PART_LABEL[p.id]),
          el('span', { class: 'pctl' }, cb, up, dn));
      }));
    };
    const shake = li => { if (!li) return; li.classList.add('shake'); setTimeout(() => li.classList.remove('shake'), 350); };
    sortable(list, (from, to, li) => { const a = clone(S.layout.parts); a.splice(to, 0, a.splice(from, 1)[0]); if (tryParts(a)) build(); else shake(li); });
    build();
    FIELDS.push({ path: 'layout.parts', root: list.parentNode || list });
    const box = el('div', { class: 'field' }, el('div', { class: 'lbl' }, el('span', { text: 'Parts, top to bottom' }), badge('limited')), list,
      el('div', { class: 'hint' }, el('span', { class: 'lim', text: 'Drag, or use Up and Down. ' }), 'The website name stays above the buttons. Warnings and the account stay above the buttons. The other sign in options stay below them. A move that breaks a rule is refused.'),
      el('div', { class: 'err', role: 'alert' }));
    FIELDS[FIELDS.length - 1].root = box;
    return [
      group('Order', box),
      group('Buttons', selectField('layout.buttons.placement', 'Where the buttons sit'), toggleField('layout.buttons.swap', 'Cancel before Approve'), numField('layout.buttons.height', 'Button height')),
      group('Header', toggleField('layout.compactHeader', 'Title and question on one line')),
    ];
  }
  function panelWording() {
    const w = k => textField('wording.' + k, nodeAt('wording.' + k).title);
    const ls = el('details', {}, el('summary', { text: 'Texts you cannot change' }),
      el('ul', { class: 'locked-list' }, [
        ['Cannot be changed', 'The real website name. It comes from the page itself.'], ['GET form warning', LOCKED_TEXT.get], ['Field chosen by position', LOCKED_TEXT.position],
        ['Frame', LOCKED_TEXT.allowOpen + '(site)' + LOCKED_TEXT.allowClose], ['Cancelled', LOCKED_TEXT.cancelled], ['Refused', LOCKED_TEXT.refused], ['Expired', LOCKED_TEXT.expired],
        ['Too many sites', LOCKED_TEXT.tooMany], ['No room', LOCKED_TEXT.noRoom], ['Unverified', LOCKED_TEXT.unverified], ['The nine disabled reasons', 'For example: One moment, checking the prompt.'],
      ].map(([a, b]) => el('li', {}, el('b', { text: a + ': ' }), b, ' ', badge('locked')))));
    return [
      group('Title and question', w('title'), w('question')),
      group('What the action says', w('actionFill'), w('actionPasskey'), w('actionFillUsername'), w('actionFillPassword'), w('actionCreatePasskey')),
      group('Help text', w('afterFill'), w('afterPasskey'), w('pressPrompt'), w('fallback'), w('expiry')),
      group('Buttons', selectField('wording.approveLabel', 'Approve button says'), selectField('wording.cancelLabel', 'Cancel button says')),
      group('Labels', selectField('wording.labelFor', 'Website label'), w('labelAction'), w('labelAccount'), w('labelScope'), w('labelAfter'), w('labelName'), w('labelLastUsed'), w('labelTime'), w('labelFallback')),
      group(null, ls),
    ];
  }
  function panelDetails() {
    const rows = S.layout.parts.filter(p => V.HIDEABLE.includes(p.id)).map(p => {
      const id = uid(), cb = el('input', { type: 'checkbox', id });
      cb.checked = p.visible;
      cb.addEventListener('change', () => { const a = clone(S.layout.parts); a.find(x => x.id === p.id).visible = cb.checked; if (!tryParts(a)) cb.checked = !cb.checked; });
      return el('div', { class: 'field' }, el('div', { class: 'tog' }, cb, el('label', { for: id, text: PART_LABEL[p.id] }), badge(p.id === 'account' ? 'limited' : 'editable')),
        p.id === 'account' ? el('div', { class: 'hint', text: 'Ignored whenever more than one account matches. The chooser then always shows.' }) : null);
    });
    const always = ['Website name', 'Action', 'Scope when in a frame', 'Safety notes', 'Expiry line', 'Both buttons', 'Reason line'];
    return [
      group('Which details appear', rows),
      group('Always shown', el('ul', { class: 'locked-list' }, always.map(a => el('li', {}, el('b', { text: a + ' ' }), badge('locked'))))),
      group('How they look', selectField('details.siteTile', 'Tile for the website'), selectField('details.timeFormat', 'Time format'), selectField('details.lastUsedStyle', 'Last used shown as'),
        el('p', { class: 'note', text: 'Real website icons (favicons) are not offered in version 1. A page can serve any picture as its icon, and the card draws only the shade and the text colour.' })),
    ];
  }
  const LED_NAMES = { notEnumerated: 'Not seen by the PC', idle: 'Idle', waiting: 'Waiting for a press', updateWaiting: 'Waiting: key update', approved: 'Approved', refused: 'Refused or timed out', setup: 'Setup drive showing', quietOn: 'Quiet mode on', quietOff: 'Quiet mode off' };
  function ledEl(color, pattern) {
    const one = ui.ledOne;
    const d = el('span', { class: 'led pat-' + pattern, 'aria-hidden': 'true' });
    d.style.setProperty('--c', one ? '#2bd45a' : color);
    d.style.setProperty('--glow', String(Math.round(S.led.brightness / 6)));
    return d;
  }
  function panelLed() {
    const rows = Object.keys(LED_NAMES).map(k => {
      const path = 'led.states.' + k;
      const dot = ledEl(getp(path + '.color'), getp(path + '.pattern'));
      const txt = el('input', { type: 'text', value: getp(path + '.color'), maxlength: '9', 'aria-label': LED_NAMES[k] + ', colour hex', spellcheck: 'false' });
      const pick = el('input', { type: 'color', 'aria-label': LED_NAMES[k] + ', colour picker' });
      const sel = el('select', { 'aria-label': LED_NAMES[k] + ', pattern' }, nodeAt(path).properties.pattern.enum.map(o => el('option', { value: o, text: o })));
      sel.value = getp(path + '.pattern');
      const sync = () => { const v = getp(path + '.color'); if (/^#[0-9A-Fa-f]{6}$/.test(v)) pick.value = v.toLowerCase(); const nd = ledEl(getp(path + '.color'), getp(path + '.pattern')); dot.className = nd.className; dot.style.cssText = ''; dot.style.setProperty('--c', nd.style.getPropertyValue('--c')); dot.style.setProperty('--glow', nd.style.getPropertyValue('--glow')); };
      sync();
      pick.addEventListener('input', () => { const v = pick.value.toUpperCase(); setp(path + '.color', v); txt.value = v; sync(); changed(); });
      txt.addEventListener('input', () => { setp(path + '.color', txt.value); sync(); changed(); });
      sel.addEventListener('change', () => { setp(path + '.pattern', sel.value); sync(); changed(); });
      const row = el('div', { class: 'field' }, el('div', { class: 'led-row' }, dot, el('span', { class: 'nm', text: LED_NAMES[k] }), pick, sel), el('div', { class: 'row' }, txt), el('div', { class: 'err', role: 'alert' }));
      FIELDS.push({ path, root: row });
      HOOKS.push(sync);
      return row;
    });
    const one = el('input', { type: 'checkbox', id: 'ck-one' }); one.checked = ui.ledOne;
    one.addEventListener('change', () => { ui.ledOne = one.checked; buildPanel(); });
    const fault = el('div', { class: 'field' }, el('div', { class: 'row' }, el('span', { class: 'led pat-fast5', 'aria-hidden': 'true' }), el('span', { class: 'nm', text: 'Fault: fast5, red' }), badge('locked')),
      el('div', { class: 'hint', text: 'Cannot be changed. A fault and a wait for a press must always be visible.' }));
    fault.querySelector('.led').style.setProperty('--c', '#ff0000');
    return [
      group('Brightness', numField('led.brightness', 'LED brightness, percent')),
      group('Colour and pattern for each state', el('label', { class: 'tog', for: 'ck-one' }, one, 'Preview as a board with one LED (colour is ignored)'), rows, fault,
        el('p', { class: 'note', text: 'The four states that ask for something or report a result (waiting, update, approved, refused) must differ in pattern and in colour. Waiting must blink. None of them may be dark or off.' })),
    ];
  }
  const TONE = { none: [], tick: [[1200, .03]], chime: [[880, .12], [1320, .18]], rise: [[660, .1], [880, .1], [1100, .16]], fall: [[880, .1], [660, .1], [440, .16]], low: [[220, .26]] };
  let actx = null;
  function playTone(name) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      let t = actx.currentTime + 0.02;
      const vol = S.sound.volume / 100 * 0.25;
      for (const [f, d] of TONE[name] || []) {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = 'square'; o.frequency.value = f; g.gain.value = vol; o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + d); t += d;
      }
    } catch (e) { toast('This browser cannot play the preview sound.'); }
  }
  function panelSounds() {
    const cues = ['shown', 'press', 'approved', 'refused', 'update'].map(k => {
      const f = selectField('sound.cues.' + k, { shown: 'Prompt shown', press: 'Press the key', approved: 'Approved', refused: 'Refused', update: 'Update waiting' }[k]);
      f.querySelector('select').after(el('button', { type: 'button', class: 'small', text: 'Play', onclick: () => playTone(getp('sound.cues.' + k)) }));
      return f;
    });
    cues.forEach(f => { const s = f.querySelector('select'); const wrap = el('div', { class: 'row' }); s.replaceWith(wrap); wrap.append(s, f.querySelector('button')); });
    return [
      group('Sounds on the PC', toggleField('sound.enabled', 'Play sounds'), numField('sound.volume', 'Volume, percent'),
        el('p', { class: 'note', text: 'The key has no speaker. These sounds play on the PC from a fixed list of short tones. Custom sound files are not allowed.' })),
      group('One sound for each event', cues),
    ];
  }
  function panelTiming() {
    return [
      group('Time limits', numField('behaviour.approvalSeconds', 'Seconds to approve on screen'), numField('behaviour.pressWaitSeconds', 'Seconds the key waits for a press'),
        el('p', { class: 'note', text: 'Holding the key button for 1.2 seconds refuses. That, and the need for a press, cannot be changed.' })),
      group('Shortcuts', textField('behaviour.keyApprove', 'Approve'), textField('behaviour.keyCancel', 'Cancel'), textField('behaviour.keyUpdate', 'Review key update')),
      group('Key', selectField('behaviour.setupDrive', 'Setup drive'), selectField('language', 'Language'), textField('name', 'Name of this settings set')),
    ];
  }
  function siteView() {
    const items = S.sites.items.map(i => ({ i, c: CATALOGUE.find(c => c.key === i.siteKey) })).filter(x => x.c);
    if (S.sites.sort === 'name') items.sort((a, b) => a.c.origin.localeCompare(b.c.origin));
    if (S.sites.sort === 'recent') items.sort((a, b) => CATALOGUE.indexOf(a.c) - CATALOGUE.indexOf(b.c) - 0);
    return items;
  }
  function panelSites() {
    const list = el('ul', { class: 'sites', 'aria-label': 'Sites on this key (fake)' });
    const build = () => {
      const manual = S.sites.sort === 'manual';
      list.replaceChildren(...siteView().map(({ i, c }) => {
        const idx = S.sites.items.indexOf(i);
        const nick = el('input', { type: 'text', value: i.nickname, maxlength: '40', placeholder: 'Nickname (optional)', 'aria-label': 'Nickname for ' + c.origin, spellcheck: 'false' });
        const err = el('div', { class: 'err', role: 'alert' });
        nick.addEventListener('input', () => { i.nickname = nick.value; changed(); });
        const pin = el('label', {}, el('input', { type: 'checkbox', checked: i.pinned, onchange: e => { i.pinned = e.target.checked; changed(); } }), 'pin');
        const move = d => () => { const j = idx + d; if (j < 0 || j >= S.sites.items.length) return; S.sites.items.splice(j, 0, S.sites.items.splice(idx, 1)[0]); changed(); build(); };
        const li = el('li', {},
          el('button', { type: 'button', class: 'handle', 'aria-label': 'Drag ' + c.origin, text: '::', disabled: !manual }),
          el('div', { class: 'real' }, c.origin, el('small', { text: 'real name, always shown' })),
          el('div', { class: 'pctl' }, pin, el('button', { type: 'button', class: 'small', text: 'Up', disabled: !manual, onclick: move(-1) }), el('button', { type: 'button', class: 'small', text: 'Down', disabled: !manual, onclick: move(1) })),
          el('div', { class: 'nick' }, nick), err,
          el('div', { class: 'acc', text: c.accounts.join(', ') + '  |  last used ' + c.used }));
        li.dataset.key = i.siteKey; return li;
      }));
    };
    sortable(list, (from, to) => { const v = siteView(); const a = v[from].i, b = v[to].i; const x = S.sites.items.indexOf(a), y = S.sites.items.indexOf(b); S.sites.items.splice(y, 0, S.sites.items.splice(x, 1)[0]); changed(); build(); });
    build();
    const sort = selectField('sites.sort', 'Sort sites by');
    sort.querySelector('select').addEventListener('change', build);
    FIELDS.push({ path: 'sites.items', root: list });
    HOOKS.push(() => {
      const res = result.errors.filter(e => e.path.indexOf('sites.items[') === 0);
      list.querySelectorAll('li').forEach(li => {
        const idx = S.sites.items.findIndex(x => x.siteKey === li.dataset.key), er = res.find(e => e.path.indexOf('sites.items[' + idx + ']') === 0), box = li.querySelector('.err');
        box.style.display = er ? 'block' : 'none'; box.textContent = er ? er.message : '';
      });
    });
    return [
      group('Nickname and order', sort, list,
        el('p', { class: 'note', text: 'A nickname appears beside the real website name in the prompt and never replaces it. These sites and accounts are made up.' })),
    ];
  }
  function loadSettings(next, msg) {
    const keep = clone(S.sites);
    S = clone(next); if (!S.sites.items.length) S.sites = keep;
    withSites(S, false);
    ui.shade = null; buildPanel(); changed(true); if (msg) toast(msg);
  }
  function panelThemes() {
    const cards = ORDER.map(id => {
      const t = THEMES[id], c = t.theme.shade, mid = [0, 1, 2].map(k => Math.round(([c.r, c.g, c.b][k][0] + [c.r, c.g, c.b][k][1]) / 2));
      const sw = el('span', { class: 'sw' }, el('span', { text: 'Passkey' }));
      sw.style.background = 'rgb(' + mid.join(',') + ')'; sw.style.color = t.theme.ink; sw.style.fontFamily = FONTS[t.theme.font]; sw.style.borderRadius = t.theme.radius + 'px';
      return el('button', { type: 'button', class: 'theme-card', 'aria-pressed': S.theme.base === id ? 'true' : 'false', onclick: () => loadSettings(t, 'Loaded the theme: ' + t.name + '. Your site nicknames were kept.') }, sw, el('span', { text: t.name }), el('small', { text: id === 'classic-blue' ? 'factory default in this prototype' : id === 'classic-blue' ? 'what the browser card looks like today' : id === 'light' ? 'login screens only for now' : id === 'high-contrast' ? 'larger text, full strength labels' : 'the site look, in the card' }));
    });
    return [group('Example themes', el('div', { class: 'themes' }, cards), el('p', { class: 'note', text: 'A theme is a full settings file, so it passes the same checks as your own. Load one, then change what you like.' }))];
  }
  function panelLocked() {
    return [
      group('Cannot be edited', el('p', { class: 'intro', text: 'These are not settings. A settings file has no place to write them, so no theme, import or edit can change them.' }),
        el('ul', { class: 'locked-list' }, SCHEMA['x-locked'].map(x => el('li', {}, el('b', { text: x.what + ' ' }), badge('locked'), el('br'), x.why)))),
    ];
  }
  const PANELS = { colours: panelColours, look: panelLook, layout: panelLayout, wording: panelWording, details: panelDetails, led: panelLed, sounds: panelSounds, timing: panelTiming, sites: panelSites, themes: panelThemes, locked: panelLocked };

  function buildTabs() {
    const t = $('#tabs'); t.replaceChildren(...TABS.map(([id, label]) => el('button', { type: 'button', role: 'tab', id: 'tab-' + id, 'aria-selected': ui.tab === id ? 'true' : 'false', onclick: () => { ui.tab = id; buildTabs(); buildPanel(); } }, label)));
  }
  function buildPanel() {
    FIELDS = []; HOOKS = [];
    const p = $('#panel'); p.replaceChildren(...PANELS[ui.tab]());
    p.setAttribute('aria-labelledby', 'tab-' + ui.tab);
    paintErrors();
  }

  // ---------------------------------------------------------------- the card
  const rgb = c => 'rgb(' + c.join(',') + ')';
  function ensureShade(T) {
    const k = JSON.stringify([T.shade, T.ink, T.labelAlpha]);
    if (!ui.shade || ui.shadeKey !== k || ui.redraw) {
      ui.shade = V.pickShade(T.shade, T.ink, T.labelAlpha, Math.random) || [60, 60, 70]; ui.shadeKey = k; ui.redraw = false;
    }
    return ui.shade;
  }
  function glyph(kind) { return kind === 'none' ? null : el('i', { class: 'pk-g pk-g-' + kind, 'aria-hidden': 'true' }); }
  function buildCard(E, shade) {
    const T = E.theme, W = E.wording, B = E.behaviour, D = E.details, L = E.layout;
    const cat = CATALOGUE[ui.site], entry = S.sites.items.find(x => x.siteKey === cat.key), nick = (entry && entry.nickname) || '';
    const st = ui.state, refused = st === 'refused', press = st === 'press', approval = st === 'fill' || st === 'passkey';
    const wrong = refused && ui.variant === 'wrong', frameBad = refused && ui.variant === 'frame', expired = refused && ui.variant === 'expired';
    const framed = ui.framed || frameBad;
    const origin = wrong ? 'https://signin.examp1e.test' : cat.origin;
    const kindPasskey = st === 'passkey';
    const card = el('div', { class: 'pk' + (L.buttons.placement === 'side' ? ' side' : '') + (T.motion === 'fade' ? ' fade' : '') + (ui.locks ? ' locks' : '') + (result.ok ? '' : ' invalid'), role: 'group', 'aria-label': 'Approval card preview' });
    const set = (k, v) => card.style.setProperty(k, v);
    const ink = V.hexToRgb(T.ink), hex = V.rgbToHex;
    set('--bg', rgb(shade)); set('--ink', T.ink); set('--label', hex(V.blend(ink, shade, T.labelAlpha))); set('--hair', hex(V.blend(ink, shade, 0.5))); set('--soft', hex(V.blend(ink, shade, 0.65))); set('--accent', T.accent);
    set('--fs', T.fontSize + 'px'); set('--fsm', T.smallSize + 'px'); set('--fsite', T.siteSize + 'px'); set('--rad', T.radius + 'px'); set('--lw', T.lineWidth + 'px');
    const dens = { compact: 0.75, normal: 1, roomy: 1.4 }[T.density]; set('--pad', (9 * dens) + 'px'); set('--gap', (3 * dens) + 'px'); set('--bh', L.buttons.height + 'px'); set('--ff', FONTS[T.font]);
    const fact = (cls, label, value, lock) => el('div', { class: 'pk-fact ' + cls, 'data-lock': lock || null }, el('b', { text: label }), el('span', {}, value));
    const outcome = wrong ? LOCKED_TEXT.wrong : frameBad ? LOCKED_TEXT.frame : expired ? LOCKED_TEXT.expired : LOCKED_TEXT.refused;
    const qText = refused ? outcome : press ? W.pressPrompt : W.question;
    const reasonText = approval ? REASONS[ui.reason] : '';
    const two = cat.accounts.length > 1;
    const make = {
      reason: () => el('small', { class: 'pk-reason', 'data-lock': 'first', text: reasonText }),
      title: () => el('div', { class: 'pk-title' }, glyph(T.tagGlyph), W.title),
      question: () => el('div', { class: 'pk-q', text: qText }),
      action: () => fact('', W.labelAction, kindPasskey ? W.actionPasskey : W.actionFill),
      destination: () => {
        const tile = D.siteTile === 'letter' ? el('i', { class: 'pk-tile', 'aria-hidden': 'true', text: origin.replace('https://', '').charAt(0).toUpperCase() }) : null;
        return fact('site', W.labelFor, [tile, origin], 'website');
      },
      name: () => nick ? fact('name', W.labelName, '“' + nick + '”') : null,
      account: () => {
        if (two && approval) {
          const sel = el('select', { 'aria-label': W.labelAccount }, cat.accounts.map(a => el('option', { text: a })));
          return el('div', { class: 'pk-fact' }, el('b', { text: W.labelAccount }), sel);
        }
        return fact('', W.labelAccount, cat.accounts[0]);
      },
      scope: () => framed ? fact('', W.labelScope, 'Frame inside https://portal.example.test via https://ads.example.test', 'locked') : null,
      after: () => approval ? el('div', { class: 'pk-sup pk-fact' }, el('b', { text: W.labelAfter }), el('span', { text: kindPasskey ? W.afterPasskey : W.afterFill })) : null,
      safety: () => {
        const lines = [];
        if (framed && approval) lines.push(LOCKED_TEXT.allowOpen + 'https://ads.example.test' + LOCKED_TEXT.allowClose);
        if (ui.get && approval) lines.push(LOCKED_TEXT.get);
        if (wrong) lines.push('Your saved login belongs to ' + cat.origin + '.');
        if (!lines.length) return null;
        return el('div', { class: 'pk-safety', 'data-lock': 'locked text', text: lines.join(' ') });
      },
      lastUsed: () => fact('', W.labelLastUsed, D.lastUsedStyle === 'relative' ? cat.used : cat.date),
      time: () => fact('', W.labelTime, D.timeFormat === '24h' ? '14:32' : '2:32 PM'),
      expiry: () => {
        if (refused) return null;
        const t = press ? 'The key waits ' + B.pressWaitSeconds + ' seconds for your press.' : W.expiry.replace('{seconds}', String(B.approvalSeconds));
        return el('div', { class: 'pk-sup', 'data-lock': 'always shown', text: t });
      },
      buttons: () => {
        if (refused) return null;
        const ap = el('button', { type: 'button', class: 'ap', disabled: !!reasonText || press }, el('span', { text: W.approveLabel }), el('kbd', { text: B.keyApprove.toUpperCase() }));
        const ca = el('button', { type: 'button', class: 'ca' }, el('span', { text: W.cancelLabel }), el('kbd', { text: B.keyCancel.toUpperCase() }));
        const kids = press ? [ca] : (L.buttons.swap ? [ca, ap] : [ap, ca]);
        return el('div', { class: 'pk-btns', 'data-lock': 'meaning' }, kids);
      },
      fallback: () => el('div', { class: 'pk-sup' }, el('b', { text: W.labelFallback }), W.fallback),
      update: () => (ui.update && approval) ? el('div', { class: 'pk-upd' }, el('span', { text: 'Key update 1.0 available.' }), el('button', { type: 'button' }, el('span', { text: 'Review update' }), el('kbd', { text: B.keyUpdate.toUpperCase() }))) : null,
    };
    const parts = L.parts.filter(p => p.visible || (p.id === 'account' && two));
    const ids = parts.map(p => p.id);
    const built = [];
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (L.compactHeader && id === 'title' && ids[i + 1] === 'question') {
        built.push({ id: 'title', node: el('div', { class: 'pk-q pk-head' }, el('span', { class: 't' }, glyph(T.tagGlyph), W.title + ': '), qText) }); i++;
        if (press) built[built.length - 1].node.append(); continue;
      }
      const node = make[id](); if (node) built.push({ id, node });
    }
    if (press) {
      const k = el('div', { class: 'pk-keyline' }, el('span', { class: 'pk-keyglyph', 'aria-hidden': 'true' }, ledEl(S.led.states.waiting.color, S.led.states.waiting.pattern)), el('small', { text: 'The LED on the key blinks while it waits.' }));
      const qi = built.findIndex(b => b.id === 'question' || b.id === 'title' && L.compactHeader);
      built.splice(qi < 0 ? 0 : qi + 1, 0, { id: 'keyline', node: k });
    }
    for (const b of built) card.append(b.node);
    if (L.buttons.placement === 'side') {
      const bi = built.findIndex(b => b.id === 'buttons');
      if (bi >= 0) {
        const factIds = ['action', 'destination', 'name', 'account', 'scope'];
        const first = built.findIndex(b => factIds.includes(b.id));
        if (first >= 0 && first < bi) {
          for (let i = first; i < bi; i++) built[i].node.style.gridColumn = '1';
          built[bi].node.style.gridColumn = '2'; built[bi].node.style.gridRow = (first + 1) + ' / span ' + (bi - first);
        }
      }
    }
    return card;
  }

  function buildStage() {
    const stage = $('#stage'); stage.replaceChildren();
    const hardErr = result.errors.some(e => e.rule === 'R-SCHEMA');
    if (!hardErr) lastGood = clone(S);
    const eff = V.effective(lastGood, ui.surface), E = eff.settings;
    if (hardErr) stage.append(el('div', { class: 'banner', text: 'One value is outside its limit. The preview shows your last valid settings until you fix it.' }));
    else if (!result.ok) stage.append(el('div', { class: 'banner', text: 'These settings break a rule. A real prompt would ignore them and use the shipped defaults. The preview shows them so you can see why.' }));
    const shade = ensureShade(E.theme);
    const card = buildCard(E, shade);
    const wrap = el('div', { class: 'cardwrap' }, card); wrap.style.setProperty('--cw', ui.width === 'wide' ? '410px' : '300px');
    if (ui.surface === 'browser') {
      stage.append(el('div', { class: 'win' },
        el('div', { class: 'win-bar' }, el('i'), el('i'), el('i'), el('span', { class: 'win-url', text: ui.state === 'refused' && ui.variant === 'wrong' ? 'https://signin.examp1e.test' : CATALOGUE[ui.site].origin })),
        el('div', { class: 'page' }, el('h4', { text: 'Sign in' }), el('div', { class: 'fi on', text: 'Username' }), wrap, el('div', { class: 'fi', text: 'Password' }))));
    } else {
      stage.append(el('div', { class: 'login' }, el('div', { class: 'av', text: 'A' }), el('div', { text: 'alex' }), wrap, el('div', { class: 'fi', text: 'Password' })));
    }
    $('#shade-cap').replaceChildren(el('i', {}), 'This card\'s shade: ' + rgb(shade) + '. Every request draws a new one.');
    $('#shade-cap i').style.background = rgb(shade);
    const notes = $('#notes'); notes.replaceChildren(...eff.notes.map(n => el('p', { text: n })));
    if (ui.surface === 'login') notes.append(el('p', { text: 'Login screens: the card draws your text colour, accent and line width.' }));
    $('#prev-sub').textContent = ui.surface === 'browser' ? 'browser prompt' : 'login screen';
  }

  // ---------------------------------------------------------------- checks
  const TAB_OF = [[/^theme\.(shade|ink|labelAlpha|accent)/, 'colours'], [/^theme\./, 'look'], [/^layout/, 'layout'], [/^wording/, 'wording'], [/^details/, 'details'], [/^led/, 'led'], [/^sound/, 'sounds'], [/^(behaviour|name|language)/, 'timing'], [/^sites/, 'sites']];
  const tabOf = p => (TAB_OF.find(([r]) => r.test(p)) || [0, 'colours'])[1];
  function paintErrors() {
    for (const f of FIELDS) {
      const errs = result.errors.filter(e => e.path === f.path || e.path.indexOf(f.path + '.') === 0 || e.path.indexOf(f.path + '[') === 0);
      f.root.classList.toggle('bad', errs.length > 0);
      const box = f.root.querySelector('.err'); if (box) box.textContent = errs.map(e => e.message).join(' ');
    }
    for (const h of HOOKS) h();
  }
  function buildChecks() {
    const box = $('#checks'); box.replaceChildren();
    const n = result.errors.length, w = result.warnings.length;
    $('#chip-state').textContent = n ? 'Checks: ' + n + ' problem' + (n === 1 ? '' : 's') : 'Checks: all pass';
    $('#chip-state').className = 'chip' + (n ? ' warn' : ' fill');
    $('#check-sub').textContent = n ? n + ' to fix' : w ? w + ' note' + (w === 1 ? '' : 's') : 'all pass';
    if (!n && !w) box.append(el('p', { class: 'ok-line', text: 'Every rule passes. The settings are ' + V.byteLength(V.canonical(S)).toLocaleString('en') + ' bytes of 8,192.' }));
    const list = el('ul', { class: 'vlist' });
    for (const e of result.errors) list.append(el('li', {}, el('span', { class: 'rid', text: e.rule + (e.path ? '  at ' + e.path : '') }), el('span', { text: e.message }),
      el('button', { type: 'button', class: 'small', text: 'Go to the setting', onclick: () => { ui.tab = tabOf(e.path); buildTabs(); buildPanel(); const f = FIELDS.find(x => e.path === x.path || e.path.indexOf(x.path + '.') === 0 || e.path.indexOf(x.path + '[') === 0); const t = f && f.root.querySelector('input,select,button'); if (t) t.focus(); } })));
    for (const e of result.warnings) list.append(el('li', { class: 'warn' }, el('span', { class: 'rid', text: 'NOTE  ' + e.rule }), el('span', { text: e.message })));
    if (list.children.length) box.append(list);
    const dirty = V.diff(BASE, S).length;
    $('#btn-revert').disabled = !dirty;
    const u = $('#btn-update'); u.setAttribute('aria-disabled', n ? 'true' : 'false'); u.textContent = dirty ? 'Update (' + dirty + ' change' + (dirty === 1 ? '' : 's') + ')' : 'Update';
  }
  let pending = 0;
  function changed(rebuildPanel) {
    result = V.validate(S, SCHEMA);
    buildChecks(); buildStage(); paintErrors(); saveDraft();
    if (rebuildPanel) buildPanel();
    cancelAnimationFrame(pending);
  }

  // ---------------------------------------------------------------- Update (export only)
  async function sha256hex(str) { try { if (!(window.crypto && crypto.subtle)) return null; const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)); return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join(''); } catch (e) { return null; } }
  async function openUpdate() {
    if (result.errors.length) { toast('Fix the ' + result.errors.length + ' problem' + (result.errors.length === 1 ? '' : 's') + ' first. The first one is in the Checks list.'); $('#checks').scrollIntoView({ block: 'nearest' }); return; }
    const text = V.canonical(S), bytes = V.byteLength(text), hash = await sha256hex(text), rows = V.diff(BASE, S);
    const d = $('#dlg-update');
    d.replaceChildren(
      el('h2', { id: 'dlg-h', text: 'Update the key' }),
      el('p', { class: 'big', text: keyInfo.mode === 'key' ? 'Nothing is written yet. Write opens a window of your Passkey software. Check the fingerprint there, click Write, then press the key.' : 'Demo mode: nothing was written and nothing is sent anywhere. This only makes the file the real editor would send.' }),
      el('dl', {}, el('dt', { text: 'Settings' }), el('dd', { text: S.name }), el('dt', { text: 'Size' }), el('dd', { text: bytes.toLocaleString('en') + ' bytes of 8,192' }),
        el('dt', { text: 'SHA-256' }), el('dd', { text: hash || 'not available in this browser context' }), el('dt', { text: 'Key' }), el('dd', { text: keyInfo.mode === 'key' ? keyInfo.summary : 'Demo key 0000-DEMO (made up)' }), el('dt', { text: 'Changes' }), el('dd', { text: String(rows.length) })),
      el('p', { text: 'What the real Update would do next:' }),
      el('ol', {}, ['Check the settings again in the helper, with the same rules.', 'Show this change list on a screen the web page cannot draw on.', 'The key blinks its own pattern and waits up to 7 seconds for a press.', 'Write to the spare slot, read it back, check the hash.', 'Commit last, then confirm after the PC has drawn a test card from it.', 'If anything fails, the key keeps the last good settings.'].map(x => el('li', { text: x }))),
      rows.length ? el('details', { open: rows.length < 12 }, el('summary', { text: 'Changed settings (' + rows.length + ')' }), el('table', {}, rows.slice(0, 60).map(r => el('tr', {}, el('td', { text: r.path }), el('td', { text: (r.from === undefined ? '(none)' : r.from) + '  ->  ' + (r.to === undefined ? '(none)' : r.to) }))))) : el('p', { text: 'No changes from the settings you loaded.' }),
      el('div', { class: 'btnrow' },
        keyInfo.mode === 'key' ? el('button', { type: 'button', class: 'primary', text: 'Write to the key', onclick: async () => { d.close(); toast('Go to the Passkey window, then press the key.'); await afterWrite(await Bridge.call('apply', S)); } }) : null,
        el('button', { type: 'button', class: keyInfo.mode === 'key' ? '' : 'primary', text: 'Download settings file', onclick: () => { const url = URL.createObjectURL(new Blob([text], { type: 'application/json' })); const a = el('a', { href: url, download: 'passkey-settings-' + S.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.json' }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); } }),
        el('button', { type: 'button', text: 'Close', onclick: () => d.close() })));
    if (!d.open) d.showModal();
  }

  // ---------------------------------------------------------------- toolbar
  function seg(id, items, key) {
    const box = $(id); box.replaceChildren(...items.map(([v, label]) => el('button', { type: 'button', 'aria-pressed': ui[key] === v ? 'true' : 'false', onclick: () => { ui[key] = v; ui.redraw = false; seg(id, items, key); if (key === 'state') $('#sel-variant').hidden = ui.state !== 'refused'; buildStage(); } }, label)));
  }
  function buildToolbar() {
    seg('#seg-state', [['fill', 'Password fill'], ['passkey', 'Passkey sign in'], ['press', 'Press the key'], ['refused', 'Refused']], 'state');
    seg('#seg-surface', [['browser', 'Browser prompt'], ['login', 'Login screen']], 'surface');
    seg('#seg-width', [['wide', 'Wide'], ['narrow', 'Narrow']], 'width');
    const v = $('#sel-variant'); v.replaceChildren(...[['wrong', 'Wrong site'], ['frame', 'Frame not allowed'], ['expired', 'Request expired']].map(([a, b]) => el('option', { value: a, text: b }))); v.value = ui.variant; v.hidden = ui.state !== 'refused';
    v.onchange = () => { ui.variant = v.value; buildStage(); };
    const s = $('#sel-site'); s.replaceChildren(...CATALOGUE.map((c, i) => el('option', { value: String(i), text: c.origin.replace('https://', '') }))); s.value = String(ui.site); s.onchange = () => { ui.site = Number(s.value); buildStage(); };
    const r = $('#sel-reason'); r.replaceChildren(...Object.keys(REASONS).map(k => el('option', { value: k, text: k === 'none' ? 'it is not' : REASONS[k] }))); r.value = ui.reason; r.onchange = () => { ui.reason = r.value; buildStage(); };
    for (const [id, key] of [['#ck-frame', 'framed'], ['#ck-get', 'get'], ['#ck-update', 'update'], ['#ck-locks', 'locks']]) { const c = $(id); c.checked = ui[key]; c.onchange = () => { ui[key] = c.checked; buildStage(); }; }
    $('#btn-shade').onclick = () => { ui.redraw = true; buildStage(); };
  }

  // ---------------------------------------------------------------- actions
  function doReset() { S = withSites(FACTORY(), false); ui.shade = null; buildPanel(); changed(true); toast('Reset to the factory settings. Press Update to send them to a key.'); }
  function importFile(file) {
    const r = new FileReader();
    r.onload = () => {
      let data; try { data = JSON.parse(String(r.result)); } catch (e) { toast('Import refused. That file is not valid JSON.'); return; }
      const res = V.validate(data, SCHEMA), hard = res.errors.filter(e => e.rule === 'R-SCHEMA');
      if (hard.length) { result = res; buildChecks(); $('#chip-state').textContent = 'Import refused'; toast('Import refused. ' + hard.length + ' value' + (hard.length === 1 ? ' is' : 's are') + ' outside the schema: ' + hard[0].message); return; }
      S = withSites(data, false); ui.shade = null; buildPanel(); changed(true); toast(res.ok ? 'Imported.' : 'Imported, with rule problems. Fix them before you can Update.');
    };
    r.readAsText(file);
  }

  // ---------------------------------------------------------------- scenes, for screenshots and quick links
  const SCENES = [
    ['editor', 'Editor, default amber'], ['passkey', 'Passkey sign in'], ['press', 'Press the key'], ['refused', 'Refused, wrong site'],
    ['custom', 'A custom theme'], ['light', 'Light theme, login screen'], ['error', 'A validation error'], ['layout', 'Layout panel'],
  ];
  function applyScene(name) {
    S = withSites(FACTORY(), true); BASE = clone(S); ui.shade = null;
    Object.assign(ui, { tab: 'colours', state: 'fill', surface: 'browser', width: 'wide', site: 0, framed: false, get: false, update: true, reason: 'none', locks: false, ledOne: false });
    if (name === 'passkey') { ui.state = 'passkey'; ui.site = 1; ui.tab = 'wording'; }
    if (name === 'press') { ui.state = 'press'; ui.tab = 'led'; }
    if (name === 'refused') { ui.state = 'refused'; ui.variant = 'wrong'; ui.tab = 'wording'; }
    if (name === 'layout') { ui.tab = 'layout'; ui.get = true; ui.locks = true; }
    if (name === 'custom') {
      S = withSites(clone(THEMES['amber-pixel']), true); S.name = 'My pixel key'; S.wording.question = 'Let this one in?'; S.wording.approveLabel = 'Allow'; S.wording.cancelLabel = 'Stop';
      S.layout.buttons.placement = 'side'; S.theme.siteSize = 13; S.theme.density = 'roomy'; S.layout.parts.find(p => p.id === 'lastUsed').visible = true;
      BASE = withSites(FACTORY(), true); ui.surface = 'login'; ui.tab = 'look'; ui.site = 0;
    }
    if (name === 'light') { S = withSites(clone(THEMES.light), true); BASE = withSites(FACTORY(), true); ui.surface = 'login'; ui.tab = 'colours'; ui.state = 'fill'; }
    if (name === 'error') {
      S.theme.ink = '#8A5F12'; S.wording.actionPasskey = 'Sign in to paypal.com'; ui.tab = 'colours';
      const parts = S.layout.parts; parts.splice(parts.length - 1, 0, parts.splice(parts.findIndex(p => p.id === 'buttons'), 1)[0]); parts.splice(3, 0, parts.splice(parts.findIndex(p => p.id === 'fallback'), 1)[0]);
    }
    result = V.validate(S, SCHEMA); lastGood = clone(S);
    buildTabs(); buildToolbar(); buildPanel(); changed();
  }
  function routeScene() { const m = /scene=([a-z]+)/.exec(location.hash); if (m && SCENES.some(s => s[0] === m[1])) { applyScene(m[1]); return true; } return false; }

  // ---------------------------------------------------------------- start
  function describeKey(r) {
    keyInfo.mode = 'key'; keyInfo.supported = true; keyInfo.state = r.state; keyInfo.generation = r.generation; keyInfo.safe = r.safeMode === true; keyInfo.corrupt = r.corrupt === true;
    keyInfo.summary = r.state + ', generation ' + r.generation + (keyInfo.safe ? ', SAFE MODE' : '') + (keyInfo.corrupt ? ', a damaged copy was ignored' : '');
    $('#chip-key').textContent = 'Key: ' + keyInfo.summary;
    $('.chip.warn').textContent = keyInfo.safe ? 'Key is in safe mode' : 'Connected to your key';
    $('#btn-rollback').hidden = r.state !== 'candidate';
  }
  // Read the key's settings and sites through the bridge. Anything but a clear answer leaves demo mode on.
  async function connect() {
    const r = await Bridge.call('state');
    if (!r || r.error || r.errorCode || r.supported !== true) { toast(r && r.supported === false ? 'This key has no settings area (firmware 0.10 or later needed). Demo mode.' : 'The key did not answer. Demo mode.'); return false; }
    if (Array.isArray(r.sites)) { CATALOGUE.length = 0; for (const x of r.sites) CATALOGUE.push({ origin: x.origin, key: x.siteKey, accounts: x.accounts && x.accounts.length ? x.accounts : ['(account)'], used: '', date: '', nick: '' }); }
    S = withSites(r.document ? clone(r.document) : FACTORY(), false); BASE = clone(S); ui.shade = null; ui.site = 0;
    describeKey(r); $('#chip-state').textContent = 'Checks: starting';
    return true;
  }
  async function afterWrite(res) {
    if (res && res.ok) { toast('Written. The key holds the new settings (generation ' + res.generation + ').'); const ok = await connect(); buildTabs(); buildPanel(); changed(); return ok; }
    const word = res && (res.errorCode || res.error) || 'no answer';
    toast({ REFUSED: 'The key refused: the button was held. Nothing was written.', TIMEOUT: 'No press in time. Nothing was written.', CANCELLED: 'Cancelled in the Passkey window. Nothing was written.', INVALID_SETTINGS: 'The software refused the settings: they break a rule.' }[word] || 'Not written: ' + word + '.');
    return false;
  }

  function init() {
    $('#btn-update').addEventListener('click', openUpdate);
    $('#btn-rollback').addEventListener('click', async () => { toast('Go to the Passkey window, then press the key.'); await afterWrite(await Bridge.call('revert')); });
    $('#btn-reset').addEventListener('click', () => $('#dlg-reset').showModal());
    $('#reset-yes').addEventListener('click', async () => { $('#dlg-reset').close(); if (keyInfo.mode === 'key') { toast('Go to the Passkey window, then press the key.'); await afterWrite(await Bridge.call('reset')); } else doReset(); });
    $('#reset-no').addEventListener('click', () => $('#dlg-reset').close());
    $('#btn-revert').addEventListener('click', () => { S = clone(BASE); ui.shade = null; buildPanel(); changed(true); toast('Back to the settings you loaded.'); });
    $('#btn-import').addEventListener('click', () => $('#file-import').click());
    $('#file-import').addEventListener('change', e => { if (e.target.files[0]) importFile(e.target.files[0]); e.target.value = ''; });
    $('#scenes').replaceChildren(el('span', { text: 'Quick scenes:' }), ...SCENES.map(([id, label]) => el('a', { href: '#scene=' + id, text: label })));
    window.addEventListener('hashchange', routeScene);
    if (routeScene()) return;
    const start = () => { result = V.validate(S, SCHEMA); lastGood = clone(S); buildTabs(); buildToolbar(); buildPanel(); changed(); };
    if (Bridge.available()) connect().then(ok => { if (!ok) loadDraft(); start(); });
    else { loadDraft(); start(); }
  }
  init();
  window.PKEditor = { get settings() { return S; }, validate: () => V.validate(S, SCHEMA) };
})();
