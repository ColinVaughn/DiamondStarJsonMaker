(() => {
  'use strict';

  const SCHEMA = window.PRESET_SCHEMA;

  const form = document.getElementById('presetForm');
  const rail = document.getElementById('sectionRail');
  const preview = document.getElementById('jsonPreview');
  const searchBox = document.getElementById('searchBox');
  const downloadBtn = document.getElementById('downloadBtn');
  const uploadInput = document.getElementById('uploadInput');

  let uid = 0;
  const onChange = () => { updatePreview(); updateVisibility(); };

  function el(tag, props = {}, ...kids) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'className') node.className = v;
      else if (k === 'innerHTML') node.innerHTML = v;
      else if (k === 'textContent') node.textContent = v;
      else if (k in node) node[k] = v;
      else node.setAttribute(k, v);
    }
    kids.flat().forEach(c => {
      if (c == null || c === false) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function setNested(obj, path, value) {
    const keys = path.split('.');
    let node = obj;
    keys.forEach((key, i) => {
      if (i === keys.length - 1) {
        node[key] = value;
      } else {
        if (typeof node[key] !== 'object' || node[key] === null) node[key] = {};
        node = node[key];
      }
    });
  }

  function getNested(obj, path) {
    return path.split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
  }

  function toNumber(raw, required) {
    if (raw === '') return required ? 0 : undefined;
    const n = Number(raw);
    return Number.isNaN(n) ? raw : n;
  }

  function makeControl(field) {
    switch (field.type) {
      case 'vec3': return makeVec3(field);
      case 'object': return makeObject(field);
      case 'array': return makeArray(field);
      case 'kvlist': return makeKvlist(field);
      default: return makeScalar(field, false);
    }
  }

  function makeScalar(field, bare) {
    let input;
    if (field.type === 'checkbox') {
      input = el('input', { type: 'checkbox' });
      input.checked = Boolean(field.default);
    } else if (field.type === 'select') {
      input = el('select');
      (field.options || []).forEach(opt => {
        const o = el('option', { value: opt, textContent: opt });
        if (field.default === opt) o.selected = true;
        input.appendChild(o);
      });
    } else {
      input = el('input', { type: field.type === 'number' ? 'number' : 'text' });
      if (field.type === 'number') input.step = 'any';
      if (field.default !== undefined) input.value = field.default;
      if (field.required) input.required = true;
      if (bare && field.label) input.placeholder = field.label;
    }
    input.id = `f${uid++}`;

    const read = () => {
      if (field.type === 'checkbox') return input.checked;
      if (field.type === 'select') return input.value;
      if (field.type === 'number') return toNumber(input.value, field.required);
      const v = input.value;
      return v.trim() === '' ? (field.required ? '' : undefined) : v;
    };
    const write = value => {
      if (field.type === 'checkbox') input.checked = Boolean(value);
      else if (field.type === 'select') input.value = value != null ? value : (field.default ?? '');
      else input.value = value != null ? value : '';
    };

    if (bare) return { el: input, read, write };

    const inner = field.type === 'checkbox'
      ? el('div', { className: 'checkbox-wrapper' }, input)
      : input;
    return { el: fieldWrapper(field, inner, input.id), read, write };
  }

  function makeVec3(field) {
    const inputs = ['x', 'y', 'z'].map(axis =>
      el('input', { type: 'number', step: 'any', placeholder: axis, className: 'vec3-axis' }));
    const row = el('div', { className: 'vec3-row' }, ...inputs);

    const read = () => {
      const raw = inputs.map(i => i.value);
      if (raw.every(v => v === '') && !field.required) return undefined;
      const n = v => (v === '' ? 0 : (Number.isNaN(Number(v)) ? 0 : Number(v)));
      return { x: n(raw[0]), y: n(raw[1]), z: n(raw[2]) };
    };
    const write = value => {
      if (value && typeof value === 'object') {
        inputs[0].value = value.x ?? '';
        inputs[1].value = value.y ?? '';
        inputs[2].value = value.z ?? '';
      } else {
        inputs.forEach(i => (i.value = ''));
      }
    };
    return { el: fieldWrapper(field, row), read, write };
  }

  function makeObject(field, opts = {}) {
    const children = (field.fields || []).map(f => ({ def: f, ctrl: makeControl(f) }));
    const grid = el('div', { className: 'obj-fields' }, ...children.map(c => c.ctrl.el));
    const block = el('div', { className: 'field obj-block' });
    if (field.label && !opts.noHeader) block.appendChild(el('div', { className: 'block-caption' }, captionText(field)));
    block.appendChild(grid);

    const read = () => {
      const obj = {};
      children.forEach(c => { const v = c.ctrl.read(); if (v !== undefined) obj[c.def.name] = v; });
      return Object.keys(obj).length ? obj : undefined;
    };
    const write = value => children.forEach(c => c.ctrl.write(value ? value[c.def.name] : undefined));
    return { el: block, read, write };
  }

  function makeArray(field) {
    const isObjectItem = Boolean(field.item && field.item.fields);
    const itemsWrap = el('div', { className: 'array-items' });
    const addBtn = el('button', { type: 'button', className: 'add-btn', textContent: field.addLabel || 'Add' });
    const block = el('div', { className: 'field array-block' },
      el('div', { className: 'block-caption' }, captionText(field)), itemsWrap, addBtn);

    const entries = [];
    const makeItemControl = () =>
      isObjectItem ? makeObject({ fields: field.item.fields }, { noHeader: true }) : makeScalar(field.item, true);

    function addItem() {
      const ctrl = makeItemControl();
      const remove = el('button', { type: 'button', className: 'remove-btn', textContent: '✕', title: 'Remove' });
      const row = el('div', { className: 'array-item' }, ctrl.el, remove);
      const entry = { ctrl, row };
      remove.addEventListener('click', () => {
        const i = entries.indexOf(entry);
        if (i >= 0) entries.splice(i, 1);
        row.remove();
        onChange();
      });
      itemsWrap.appendChild(row);
      entries.push(entry);
      return ctrl;
    }

    addBtn.addEventListener('click', () => { addItem(); onChange(); });

    const read = () => {
      const arr = entries.map(e => e.ctrl.read()).filter(v => v !== undefined);
      return arr.length ? arr : undefined;
    };
    const write = value => {
      entries.length = 0;
      itemsWrap.innerHTML = '';
      if (Array.isArray(value)) value.forEach(v => addItem().write(v));
    };
    return { el: block, read, write };
  }

  function makeKvlist(field) {
    const rowsWrap = el('div', { className: 'array-items' });
    const addBtn = el('button', { type: 'button', className: 'add-btn', textContent: field.addLabel || 'Add' });
    const block = el('div', { className: 'field kv-block' },
      el('div', { className: 'block-caption' }, captionText(field)), rowsWrap, addBtn);

    const rows = [];
    function addRow(key = '', value = '') {
      const keyI = el('input', { type: 'text', value: key, placeholder: field.keyPlaceholder || 'key' });
      const valI = el('input', { type: 'text', value: value, placeholder: field.valuePlaceholder || 'value' });
      const remove = el('button', { type: 'button', className: 'remove-btn', textContent: '✕', title: 'Remove' });
      const row = el('div', { className: 'kv-row' }, keyI, valI, remove);
      const entry = { keyI, valI };
      remove.addEventListener('click', () => {
        const i = rows.indexOf(entry);
        if (i >= 0) rows.splice(i, 1);
        row.remove();
        onChange();
      });
      rowsWrap.appendChild(row);
      rows.push(entry);
    }

    addBtn.addEventListener('click', () => { addRow(); onChange(); });
    if (field.default) Object.entries(field.default).forEach(([k, v]) => addRow(k, String(v)));

    const read = () => {
      const obj = {};
      rows.forEach(r => { const k = r.keyI.value.trim(); if (k) obj[k] = r.valI.value; });
      return Object.keys(obj).length ? obj : undefined;
    };
    const write = value => {
      rows.length = 0;
      rowsWrap.innerHTML = '';
      if (value && typeof value === 'object') Object.entries(value).forEach(([k, v]) => addRow(k, String(v)));
    };
    return { el: block, read, write };
  }

  function captionText(field) {
    return `${field.label}${field.required ? '' : ' (optional)'}`;
  }

  function fieldWrapper(field, inner, forId) {
    const wrap = el('div', { className: 'field' });
    if (field.label) {
      const label = el('label', {
        innerHTML: `${field.label}${field.required ? '' : ' <span class="optional">(optional)</span>'}`,
      });
      if (forId) label.htmlFor = forId;
      if (field.description) {
        label.classList.add('tooltip');
        label.setAttribute('data-tooltip', field.description);
      }
      wrap.appendChild(label);
    }
    wrap.appendChild(inner);
    return wrap;
  }

  let activeSection = null;

  function activateSection(section) {
    if (!section) return;
    activeSection = section;
    sections.forEach(s => {
      const on = s === section;
      s.sectionEl.classList.toggle('active', on);
      s.railBtn.classList.toggle('active', on);
      s.railBtn.setAttribute('aria-current', on ? 'true' : 'false');
    });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  const sections = SCHEMA.map(group => {
    const title = group.label || group.group;
    const fields = (group.children || []).map(def => ({ def, control: makeControl(def) }));

    const railBtn = el('button', { type: 'button', className: 'rail-item' },
      el('span', { className: 'rail-dot' }),
      el('span', { className: 'rail-label', textContent: title }),
      el('span', { className: 'rail-count', textContent: String(fields.length) }));

    const titleEl = el('h2', { className: 'section-title', textContent: title });
    if (group.description) {
      titleEl.appendChild(el('span', { className: 'info-icon', textContent: 'ⓘ', title: group.description }));
    }
    const grid = el('div', { className: 'fields-grid' }, ...fields.map(f => f.control.el));
    const sectionEl = el('section', { className: 'section' }, titleEl, grid);
    form.appendChild(sectionEl);

    const section = { group, railBtn, sectionEl, fields };
    railBtn.addEventListener('click', () => activateSection(section));
    rail.appendChild(railBtn);
    return section;
  });

  function readAll(target) {
    sections.forEach(s => s.fields.forEach(fc => {
      const v = fc.control.read();
      if (v !== undefined) setNested(target, fc.def.name, v);
    }));
  }

  function buildData() {
    const ctx = {};
    readAll(ctx);

    const out = {};
    sections.forEach(s => {
      if (s.group.showIf && !s.group.showIf(ctx)) return;
      s.fields.forEach(fc => {
        if (fc.def.showIf && !fc.def.showIf(ctx)) return;
        const v = fc.control.read();
        if (v !== undefined) setNested(out, fc.def.name, v);
      });
    });
    return out;
  }

  function updatePreview() {
    preview.textContent = JSON.stringify(buildData(), null, 2);
  }

  function updateVisibility() {
    const ctx = {};
    readAll(ctx);
    sections.forEach(s => {
      if (s.group.showIf) s.railBtn.classList.toggle('hidden', !s.group.showIf(ctx));
      s.fields.forEach(fc => {
        if (fc.def.showIf) fc.control.el.classList.toggle('hidden', !fc.def.showIf(ctx));
      });
    });
    if (!activeSection || activeSection.railBtn.classList.contains('hidden')) {
      activateSection(sections.find(s => !s.railBtn.classList.contains('hidden')));
    }
  }

  function downloadPreset() {
    const blob = new Blob([JSON.stringify(buildData(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: 'preset.json' });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        loadFormData(JSON.parse(e.target.result));
      } catch (err) {
        alert('Error parsing JSON file: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  function loadFormData(root) {
    sections.forEach(s => s.fields.forEach(fc => fc.control.write(getNested(root, fc.def.name))));
    searchBox.value = '';
    clearSearch();
    updateVisibility();
    updatePreview();
  }

  function clearSearch() {
    form.querySelectorAll('.search-hidden').forEach(node => node.classList.remove('search-hidden'));
    sections.forEach(s => s.railBtn.classList.remove('rail-nomatch'));
  }

  function updateSearch() {
    const term = searchBox.value.toLowerCase().trim();
    if (term === '') {
      clearSearch();
      if (activeSection) activateSection(activeSection);
      return;
    }
    let firstMatch = null;
    sections.forEach(s => {
      let any = false;
      s.fields.forEach(fc => {
        const match = (fc.def.label || '').toLowerCase().includes(term);
        fc.control.el.classList.toggle('search-hidden', !match);
        if (match) any = true;
      });
      s.railBtn.classList.toggle('rail-nomatch', !any);
      if (any && !firstMatch) firstMatch = s;
    });
    if (firstMatch) activateSection(firstMatch);
  }

  form.addEventListener('input', onChange);
  form.addEventListener('change', onChange);
  downloadBtn.addEventListener('click', downloadPreset);
  uploadInput.addEventListener('change', handleUpload);
  searchBox.addEventListener('input', updateSearch);

  const MISSING = Symbol('missing');
  function hasPath(obj, dotted) {
    return dotted.split('.').reduce(
      (acc, k) => (acc && typeof acc === 'object' && k in acc ? acc[k] : MISSING),
      obj,
    ) !== MISSING;
  }

  function applyPartial(partial) {
    sections.forEach(s => s.fields.forEach(fc => {
      if (hasPath(partial, fc.def.name)) fc.control.write(getNested(partial, fc.def.name));
    }));
    updateVisibility();
    updatePreview();
  }

  window.PresetForm = { applyPartial, getData: () => buildData() };

  activateSection(sections[0]);
  updatePreview();
  updateVisibility();
})();
