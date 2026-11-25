/* N39 settings validator. One file, used by the editor page and by the node tests. Plain data in, a list of problems out.
   It reads limits from settings-schema.json (as schema-data.js) and applies the cross field rules the schema cannot say.
   Production note: the browser prompt picks its random shade with the exact integer table of N29. This file uses the plain
   WCAG formula in floating point, which is close enough to give the owner a warning and not close enough to be a safety gate.
   The safety gate in a real prompt is the prompt's own check of every settings document it loads. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PKV = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------------------------------------------------------- colour maths
  const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lum = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const hexToRgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const rgbToHex = c => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();
  const blend = (ink, shade, a) => ink.map((v, i) => Math.round(v * a + shade[i] * (1 - a)));

  // Limits in one place, each named after its rule.
  const LIMITS = {
    minShadeCount: 100000,      // R-SHADE-SIZE: shades a request can draw. The shipped box gives about 700000. 100000 is a proposal for review.
    minAcceptedFraction: 0.5,   // R-SHADE-CONTRAST: the picker redraws a shade whose labels read under 4.5 to 1; half the box must pass.
    labelContrast: 4.5,         // R-LABEL-CONTRAST
    siteContrast: 5.5,          // R-SITE-CONTRAST: the shipped card gives the website name 5.96 to 1 on its worst accepted shade.
    maxBytes: 8192,             // R-SIZE: the key's settings slot
    ledColourDistance: 120,     // R-LED-DISTINCT, in RGB steps
    ledVisible: 128,            // R-LED-WAIT-VISIBLE: brightest channel of a state that awaits a press or reports a result
  };
  let CLASSIC_SHADE = { r: [10, 109], g: [30, 129], b: [80, 179] };
  // The limits live in the schema (x-limits), shared with the helper's Go validator. These values are the same ones, used before a schema is given.
  function setSchema(schema) {
    const x = schema && schema['x-limits'];
    if (!x) return;
    for (const k of Object.keys(LIMITS)) if (k in x) LIMITS[k] = x[k];
    if (x.classicShade) CLASSIC_SHADE = x.classicShade;
    if (x.hideable) { HIDEABLE.length = 0; for (const h of x.hideable) HIDEABLE.push(h); }
    if (x.blinking) { BLINKING.length = 0; for (const b of x.blinking) BLINKING.push(b); }
  }

  // Shades in the box, sampled on a grid. A shade is accepted when the label colour reads on it.
  function shadeStats(shade, ink, alpha) {
    const n = 12, inkRgb = hexToRgb(ink);
    const vol = (shade.r[1] - shade.r[0] + 1) * (shade.g[1] - shade.g[0] + 1) * (shade.b[1] - shade.b[0] + 1);
    let acc = 0, tot = 0, minSite = Infinity, minLabel = Infinity;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
      const s = [shade.r[0] + (shade.r[1] - shade.r[0]) * i / (n - 1), shade.g[0] + (shade.g[1] - shade.g[0]) * j / (n - 1), shade.b[0] + (shade.b[1] - shade.b[0]) * k / (n - 1)].map(Math.round);
      tot++;
      const label = contrast(blend(inkRgb, s, alpha), s);
      if (label >= LIMITS.labelContrast) { acc++; minSite = Math.min(minSite, contrast(inkRgb, s)); minLabel = Math.min(minLabel, label); }
    }
    return { fraction: acc / tot, count: Math.round(vol * acc / tot), volume: vol, minSite: acc ? minSite : 0, minLabel: acc ? minLabel : 0 };
  }

  // ---------------------------------------------------------------- defaults and plain helpers
  function defaults(node) {
    if ('const' in node) return node.const;
    if ('default' in node) return JSON.parse(JSON.stringify(node.default));
    if (node.type === 'object') { const o = {}; for (const k of Object.keys(node.properties)) o[k] = defaults(node.properties[k]); return o; }
    throw new Error('no default');
  }
  function canonical(v) {
    if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
    return JSON.stringify(v);
  }
  const byteLength = s => new TextEncoder().encode(s).length;
  function flatten(v, prefix, out) {
    out = out || {};
    if (Array.isArray(v) && v.every(x => typeof x !== 'object' || x === null)) out[prefix] = JSON.stringify(v);
    else if (Array.isArray(v)) v.forEach((x, i) => flatten(x, prefix + '[' + (x && x.id ? x.id : x && x.siteKey ? x.siteKey : i) + ']', out));
    else if (v && typeof v === 'object') for (const k of Object.keys(v)) flatten(v[k], prefix ? prefix + '.' + k : k, out);
    else out[prefix] = JSON.stringify(v);
    return out;
  }
  function diff(a, b) {
    const x = flatten(a, '', {}), y = flatten(b, '', {}), rows = [];
    for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) if (x[k] !== y[k]) rows.push({ path: k, from: x[k], to: y[k] });
    return rows;
  }

  // ---------------------------------------------------------------- JSON Schema subset
  function typeOk(t, v) {
    if (t === 'string') return typeof v === 'string';
    if (t === 'integer') return Number.isInteger(v);
    if (t === 'number') return typeof v === 'number' && isFinite(v);
    if (t === 'boolean') return typeof v === 'boolean';
    if (t === 'array') return Array.isArray(v);
    if (t === 'object') return v !== null && typeof v === 'object' && !Array.isArray(v);
    return false;
  }
  function checkSchema(node, v, path, errs) {
    const label = node.title || path || 'value';
    const bad = (msg, rule) => errs.push({ rule: rule || 'R-SCHEMA', path, message: msg });
    if ('const' in node) { if (v !== node.const) bad(label + ' must be ' + JSON.stringify(node.const) + '.'); return; }
    if (node.type && !typeOk(node.type, v)) { bad(label + ' must be a ' + node.type + '.'); return; }
    if (node.enum && !node.enum.includes(v)) bad(label + ' must be one of: ' + node.enum.join(', ') + '.');
    if (typeof v === 'number') {
      if ('minimum' in node && v < node.minimum) bad(label + ' must be at least ' + node.minimum + '.');
      if ('maximum' in node && v > node.maximum) bad(label + ' must be at most ' + node.maximum + '.');
    }
    if (typeof v === 'string') {
      if ('minLength' in node && v.length < node.minLength) bad(label + ' needs at least ' + node.minLength + ' character' + (node.minLength === 1 ? '' : 's') + '.');
      if ('maxLength' in node && v.length > node.maxLength) bad(label + ' is ' + v.length + ' characters. The most is ' + node.maxLength + '.');
      if (node.pattern && !new RegExp(node.pattern).test(v)) bad(label + ' is not in the right form.');
    }
    if (Array.isArray(v)) {
      if ('minItems' in node && v.length < node.minItems) bad(label + ' needs at least ' + node.minItems + ' items.');
      if ('maxItems' in node && v.length > node.maxItems) bad(label + ' has ' + v.length + ' items. The most is ' + node.maxItems + '.');
      if (node.items) v.forEach((x, i) => checkSchema(node.items, x, path + '[' + i + ']', errs));
    }
    if (node.type === 'object' && v && typeof v === 'object') {
      for (const k of node.required || []) if (!(k in v)) errs.push({ rule: 'R-SCHEMA', path: path ? path + '.' + k : k, message: 'Missing: ' + k + '.' });
      for (const k of Object.keys(v)) {
        const sub = node.properties && node.properties[k];
        if (!sub) { if (node.additionalProperties === false) errs.push({ rule: 'R-SCHEMA', path: path ? path + '.' + k : k, message: 'Unknown setting: ' + k + '. Unknown settings are refused.' }); continue; }
        checkSchema(sub, v[k], path ? path + '.' + k : k, errs);
      }
    }
  }

  // ---------------------------------------------------------------- text rules
  const ADDRESS = /(https?:|ftp:|www\.|\/\/|@|\b[a-z0-9][a-z0-9-]*\.(?:[a-z]{2,})\b)/i;
  const LATIN = /^[\x20-\x7E -ɏ’]*$/;
  function textRules(label, path, value, errs) {
    if (typeof value !== 'string') return;
    if (!LATIN.test(value)) errs.push({ rule: 'R-TEXT-CHARS', path, message: label + ' uses letters from outside the Latin set, or hidden characters. They can pass for other letters, so they are not allowed.' });
    if (ADDRESS.test(value)) errs.push({ rule: 'R-TEXT-NO-ADDRESS', path, message: label + ' looks like it contains a web address, a domain or an email address. Your own words may not name a site, because the real website name is shown from the page itself.' });
  }

  // ---------------------------------------------------------------- layout rules
  const PART_NAMES = { reason: 'the reason line', title: 'the title', question: 'the question', action: 'the action', destination: 'the website name', name: 'your nickname', account: 'the account', scope: 'the scope', after: 'the after approval text', safety: 'the safety note', lastUsed: 'last used', time: 'the time', expiry: 'the expiry line', buttons: 'the buttons', fallback: 'the other sign in options', update: 'the update line' };
  const HIDEABLE = ['name', 'account', 'after', 'lastUsed', 'time', 'fallback', 'update'];
  const BLINKING = ['blink2', 'triple', 'fast5', 'double'];
  function checkOrder(parts) {
    const errs = [], ids = parts.map(p => p.id);
    const vis = parts.filter(p => p.visible).map(p => p.id);
    const at = id => vis.indexOf(id);
    const e = (rule, message) => errs.push({ rule, path: 'layout.parts', message });
    const need = Object.keys(PART_NAMES);
    if (ids.length !== need.length || need.some(n => !ids.includes(n)) || new Set(ids).size !== ids.length) { e('R-LAYOUT-REQUIRED', 'Every part must be listed exactly once.'); return errs; }
    for (const p of parts) if (!p.visible && !HIDEABLE.includes(p.id)) e('R-LAYOUT-HIDE', 'You cannot hide ' + PART_NAMES[p.id] + '. It is part of what you decide on.');
    if (at('reason') !== 0 && at('reason') !== -1) e('R-LAYOUT-REASON-FIRST', 'The reason line must stay first, so a disabled Approve button always explains itself at the top.');
    const free = ['reason', 'title', 'question', 'action', 'destination'];
    for (const id of vis) if (!free.includes(id) && at('destination') > at(id)) { e('R-LAYOUT-SITE-BEFORE-REST', 'The website name must come before ' + PART_NAMES[id] + '. Only the title, the question and the action may sit above it.'); break; }
    for (const id of ['destination', 'action', 'name', 'account', 'scope', 'safety']) if (vis.includes(id) && vis.includes('buttons') && at('buttons') < at(id)) { e('R-LAYOUT-BUTTONS-AFTER-FACTS', 'The buttons must come after ' + PART_NAMES[id] + '. You may not be asked to approve before you can read it.'); break; }
    if (vis.includes('fallback') && at('fallback') < at('buttons')) e('R-LAYOUT-FALLBACK-AFTER-BUTTONS', 'The other sign in options must stay below the buttons.');
    if (at('title') > at('question')) e('R-LAYOUT-TITLE-BEFORE-QUESTION', 'The title must stay above the question.');
    return errs;
  }

  // ---------------------------------------------------------------- the rules
  function validate(s, schema) {
    setSchema(schema);
    const errs = [], warns = [];
    checkSchema(schema, s, '', errs);
    const structural = errs.length > 0;
    const E = (rule, path, message) => errs.push({ rule, path, message });
    const W = (rule, path, message) => warns.push({ rule, path, message });
    if (structural) return { ok: false, errors: errs, warnings: warns };

    // Shade box and contrast
    const t = s.theme, sh = t.shade;
    for (const c of ['r', 'g', 'b']) if (sh[c][0] > sh[c][1]) E('R-SHADE-SIZE', 'theme.shade.' + c, 'The low end of the ' + { r: 'red', g: 'green', b: 'blue' }[c] + ' range is above its high end.');
    if (!errs.length) {
      const st = shadeStats(sh, t.ink, t.labelAlpha);
      if (st.fraction < LIMITS.minAcceptedFraction) E('R-SHADE-CONTRAST', 'theme.ink', 'Only ' + Math.round(st.fraction * 100) + ' percent of the shades in this box can carry this text colour. At least ' + Math.round(LIMITS.minAcceptedFraction * 100) + ' percent must read at 4.5 to 1 or better. Make the text and the shade further apart.');
      else {
        if (st.count < LIMITS.minShadeCount) E('R-SHADE-SIZE', 'theme.shade', 'This box allows about ' + st.count.toLocaleString('en') + ' usable shades. At least ' + LIMITS.minShadeCount.toLocaleString('en') + ' are needed, so a lookalike cannot guess the shade. Widen a range.');
        if (st.minSite < LIMITS.siteContrast) E('R-SITE-CONTRAST', 'theme.labelAlpha', 'On the weakest usable shade the website name reads at ' + st.minSite.toFixed(1) + ' to 1. It must reach ' + LIMITS.siteContrast.toFixed(1) + ' to 1. Lower the label strength or move the shade box.');
      }
    }
    if (t.siteSize < t.fontSize) E('R-FONT-SITE', 'theme.siteSize', 'The website name (' + t.siteSize + ') may not be smaller than the other text (' + t.fontSize + ').');
    if (t.lineWidth > 1) W('R-SURFACE', 'theme.lineWidth', 'The browser prompt draws lines 1 wide. Login screens use ' + t.lineWidth + '.');
    if (t.ink.toUpperCase() !== '#FFFFFF') W('R-SURFACE', 'theme.ink', 'The browser prompt shows white text until its screenshot check is widened. Login screens use your colour.');

    // Layout
    for (const x of checkOrder(s.layout.parts)) errs.push(x);
    if (s.layout.buttons.height < 26) E('R-BUTTON-SIZE', 'layout.buttons.height', 'Buttons must be at least 26 tall.');

    // Text
    const w = s.wording;
    const labels = { title: 'Title', question: 'Question', actionFill: 'Action: fill both', actionFillUsername: 'Action: fill username', actionFillPassword: 'Action: fill password', actionPasskey: 'Action: passkey', actionCreatePasskey: 'Action: create passkey', afterFill: 'After approval text', afterPasskey: 'After approval text for a passkey', pressPrompt: 'Press the key line', fallback: 'Other sign in options text', expiry: 'Expiry line', labelAction: 'Action label', labelAccount: 'Account label', labelScope: 'Scope label', labelAfter: 'After approval label', labelName: 'Nickname label', labelLastUsed: 'Last used label', labelTime: 'Time label', labelFallback: 'Other options label' };
    for (const k of Object.keys(labels)) textRules(labels[k], 'wording.' + k, w[k], errs);
    textRules('Settings name', 'name', s.name, errs);
    if (!/passkey/i.test(w.title)) E('R-TEXT-TITLE', 'wording.title', 'The title must contain the word Passkey, so the card cannot pass for a system prompt.');
    const marks = (w.expiry.match(/\{seconds\}/g) || []).length;
    if (marks !== 1 || /[{}]/.test(w.expiry.replace('{seconds}', ''))) E('R-TEXT-EXPIRY', 'wording.expiry', 'The expiry line needs {seconds} exactly once, and no other braces. The software puts the real number there.');
    if (w.approveLabel === w.cancelLabel) E('R-BUTTON-WORDS', 'wording.cancelLabel', 'The two buttons cannot use the same word.');

    // Shortcuts
    const keys = [s.behaviour.keyApprove, s.behaviour.keyCancel, s.behaviour.keyUpdate].map(k => k.toUpperCase());
    if (new Set(keys).size !== 3) E('R-KEYS-DISTINCT', 'behaviour.keyApprove', 'The three shortcut letters must all be different.');

    // LED
    const L = s.led.states, press = ['waiting', 'updateWaiting', 'approved', 'refused'], blinking = BLINKING;
    for (const st of ['waiting', 'updateWaiting']) if (!blinking.includes(L[st].pattern)) E('R-LED-WAIT-VISIBLE', 'led.states.' + st + '.pattern', 'A key waiting for a press must blink. A steady light means done, and off means nothing is happening.');
    for (const st of press) {
      const rgb = hexToRgb(L[st].color);
      if (L[st].pattern === 'off' || Math.max(...rgb) < LIMITS.ledVisible) E('R-LED-WAIT-VISIBLE', 'led.states.' + st + '.color', 'The ' + st + ' state may not be dark or off.');
    }
    for (let i = 0; i < press.length; i++) for (let j = i + 1; j < press.length; j++) {
      const a = L[press[i]], b = L[press[j]];
      if (a.pattern === b.pattern) E('R-LED-DISTINCT', 'led.states.' + press[j] + '.pattern', 'The ' + press[i] + ' and ' + press[j] + ' states use the same pattern. A board with one LED could not tell them apart.');
      else {
        const A = hexToRgb(a.color), B = hexToRgb(b.color), d = Math.sqrt(A.reduce((n, v, k) => n + (v - B[k]) * (v - B[k]), 0));
        if (d < LIMITS.ledColourDistance) E('R-LED-DISTINCT', 'led.states.' + press[j] + '.color', 'The ' + press[i] + ' and ' + press[j] + ' colours are too close. They must be at least ' + LIMITS.ledColourDistance + ' apart.');
      }
    }

    // Sound
    const c = s.sound.cues;
    if (c.approved === c.refused && c.approved !== 'none') E('R-SOUND-DISTINCT', 'sound.cues.refused', 'Approved and refused cannot make the same sound.');

    // Sites
    const seen = new Set();
    s.sites.items.forEach((it, i) => {
      if (seen.has(it.siteKey)) E('R-SITES-UNIQUE', 'sites.items[' + i + ']', 'A site is listed twice.');
      seen.add(it.siteKey);
      textRules('Nickname', 'sites.items[' + i + '].nickname', it.nickname, errs);
    });

    // Size, last
    const bytes = byteLength(canonical(s));
    if (bytes > LIMITS.maxBytes) E('R-SIZE', '', 'The settings are ' + bytes + ' bytes. The most is ' + LIMITS.maxBytes + '.');
    return { ok: errs.length === 0, errors: errs, warnings: warns, bytes };
  }

  // What a surface really draws. The browser prompt can show white text only, one pixel lines, and the shade box only if white text reads on it.
  function effective(s, surface) {
    const e = JSON.parse(JSON.stringify(s)), notes = [];
    if (surface === 'browser') {
      if (e.theme.ink.toUpperCase() !== '#FFFFFF') { notes.push('Text colour shown white here. The browser prompt only allows white until its screenshot check is widened.'); e.theme.ink = '#FFFFFF'; }
      if (e.theme.accent.toUpperCase() !== '#FFFFFF') { e.theme.accent = '#FFFFFF'; notes.push('Accent colour is not used in the browser prompt.'); }
      if (e.theme.lineWidth > 1) { e.theme.lineWidth = 1; notes.push('Lines drawn 1 wide here.'); }
      const st = shadeStats(e.theme.shade, '#FFFFFF', e.theme.labelAlpha);
      if (st.fraction < LIMITS.minAcceptedFraction || st.count < LIMITS.minShadeCount || st.minSite < LIMITS.siteContrast) {
        e.theme.shade = JSON.parse(JSON.stringify(CLASSIC_SHADE));
        notes.push('This shade box does not carry white text, so the browser prompt uses the shipped shade box instead.');
      }
    }
    return { settings: e, notes };
  }

  // Draw one shade from the box the way the picker does: uniform, draw again when labels would read under 4.5 to 1.
  function pickShade(shade, ink, alpha, rand) {
    const inkRgb = hexToRgb(ink);
    for (let i = 0; i < 1000; i++) {
      const s = [0, 1, 2].map(k => { const [lo, hi] = [shade.r, shade.g, shade.b][k]; return lo + Math.floor(rand() * (hi - lo + 1)); });
      if (contrast(blend(inkRgb, s, alpha), s) >= LIMITS.labelContrast) return s;
    }
    return null;
  }

  return { setSchema, LIMITS, get CLASSIC_SHADE() { return CLASSIC_SHADE; }, HIDEABLE, PART_NAMES, lin, lum, contrast, hexToRgb, rgbToHex, blend, shadeStats, defaults, canonical, byteLength, flatten, diff, checkSchema, checkOrder, validate, effective, pickShade, ADDRESS };
});
