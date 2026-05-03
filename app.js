/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   CONSTANTS & STATE
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
const API = '/api/logs';
const $ = id => document.getElementById(id);
const fmt = v => 'â‚¹' + Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

const TYPEMETA = {
  'single-estate': { label: 'Single Estate', cls: '' },
  'blend': { label: 'Blend', cls: '' },
  'micro-lot': { label: 'Micro Lot', cls: '' },
  'nano-lot': { label: 'Nano Lot', cls: '' }
};
const BREW_OPTS = ['French Press', 'Cafflano Kompresso', 'Moka Pot', 'V60', 'AeroPress', 'Espresso Machine', 'Cold Brew', 'Siphon'];
const SIZE_OPTS = ['100g', '200g', '250g', '500g', '1kg'];

// Process detection â€” maps keywords in name/notes â†’ canonical process
const PROCESS_MAP = [
  { key: 'natural', label: 'Natural', icon: 'ðŸ’', hint: 'sun-dried, dry process' },
  { key: 'washed', label: 'Washed', icon: 'ðŸ’§', hint: 'wet process, fully washed' },
  { key: 'honey', label: 'Honey', icon: 'ðŸ¯', hint: 'pulped natural, honey process' },
  { key: 'anaerobic', label: 'Anaerobic', icon: 'âš—ï¸', hint: 'fermentation, carbonic maceration' },
  { key: 'wet-hulled', label: 'Wet Hulled', icon: 'ðŸŒ¾', hint: 'giling basah' },
  { key: 'experimental', label: 'Experimental', icon: 'ðŸ§ª', hint: 'infused, experimental, barrel aged' },
];

let logs = [], orders = [];
let currentFilter = 'all';
let editingId = null;
let itemCount = 0;

// Shelf & journal â€” all synced to D1, no localStorage
let finishedBags = [];  // derived from bagMeta
let bagMeta = {};       // keyed by log_id (number), loaded from /api/shelf
let journal = [];       // loaded from /api/journal
let jRating = 0;
let jEditId = null;

let pieInst, barInst, lineInst;


/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   LOAD DATA FROM API
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
async function loadData() {
  // Fetch logs (critical) â€” always renders whatever succeeds
  try {
    const res = await fetch(API);
    const data = await res.json();
    logs = data.logs || [];
    orders = data.orders || [];
  } catch (e) {
    console.error('Logs fetch error:', e);
  }

  // Fetch journal (non-critical)
  try {
    const res = await fetch(API + '?route=journal');
    const data = await res.json();
    journal = (data.journal || []).map(j => ({
      ...j,
      beanId: j.beanId || j.bean_id,
      beanLabel: j.beanLabel || j.bean_label,
      tastes: typeof j.tastes === 'string' ? JSON.parse(j.tastes || '[]') : (j.tastes || []),
    }));
  } catch (e) {
    console.error('Journal fetch error:', e);
  }

  // Fetch shelf meta (non-critical)
  try {
    const res = await fetch(API + '?route=shelf');
    const data = await res.json();
    bagMeta = {};
    (data.shelf || []).forEach(s => {
      const id = s.log_id;
      bagMeta[id] = {
        roastDate: s.roast_date || '',
        deliveredDate: s.delivered_date || '',
        openedDate: s.opened_date || '',
        finishedDate: s.finished_date || '',
        isFinished: !!s.is_finished,
        restDays: s.rest_days != null ? Number(s.rest_days) : null,
        gramEntries: typeof s.gram_entries === 'string'
          ? JSON.parse(s.gram_entries || '[]')
          : (s.gram_entries || []),
      };
    });
    finishedBags = Object.entries(bagMeta)
      .filter(([, m]) => m.isFinished)
      .map(([id]) => Number(id));
  } catch (e) {
    console.error('Shelf fetch error:', e);
  }
  // Data loaded — page-specific render is called by init()
}

// Helper: persist a bag's meta to D1
async function _syncShelf(id) {
  const m = bagMeta[id] || {};
  await fetch(API + '?route=shelf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      log_id: id,
      roastDate: m.roastDate || '',
      deliveredDate: m.deliveredDate || '',
      openedDate: m.openedDate || '',
      finishedDate: m.finishedDate || '',
      isFinished: !!m.isFinished,
      restDays: m.restDays != null ? m.restDays : null,
      gramEntries: m.gramEntries || [],
    }),
  });
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   ITEM ROW BUILDER
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function addItemRow(prefill = {}) {
  itemCount++;
  const n = itemCount;
  const isCombo = $('inp-combo').checked;
  let existingBrew = [];
  try { existingBrew = JSON.parse(prefill.brew_equip || '[]'); } catch {
    existingBrew = typeof prefill.brew_equip === 'string' ? prefill.brew_equip.split(',').filter(Boolean) : [];
  }
  const sizeInOpts = SIZE_OPTS.includes(prefill.size);
  const div = document.createElement('div');
  div.className = 'item-row'; div.id = `item-${n}`;
  div.innerHTML = `
    <div class="item-row-head">
      <span class="item-num">Item ${n}</span>
      <button class="btn-rm" onclick="removeItem(${n})">âœ•</button>
    </div>
    <div class="form-row full"><div class="field">
      <label class="form-label">Product Name</label>
      <input type="text" id="item-name-${n}" value="${esc(prefill.name || '')}" placeholder="e.g. Baarbara Washed AA">
    </div></div>
    <div class="form-row">
      <div class="field">
        <label class="form-label">Category</label>
        <select id="item-cat-${n}" onchange="toggleBeansFields(${n})">
          <option value="beans" ${(prefill.category || 'beans') === 'beans' ? 'selected' : ''}>Beans</option>
          <option value="gears" ${prefill.category === 'gears' ? 'selected' : ''}>Gears</option>
          <option value="accessories" ${prefill.category === 'accessories' ? 'selected' : ''}>Accessories</option>
        </select>
      </div>
      <div class="field" id="item-price-wrap-${n}" style="${isCombo ? 'display:none' : ''}">
        <label class="form-label">Price (â‚¹)</label>
        <input type="number" id="item-price-${n}" value="${prefill.price || ''}" placeholder="0" step="0.01">
      </div>
    </div>
    <div class="beans-only" id="beans-fields-${n}">
      <div class="form-row three">
        <div class="field">
          <label class="form-label">Roaster</label>
          <input type="text" id="item-roaster-${n}" value="${esc(prefill.roaster || '')}" placeholder="e.g. Blue Tokai">
        </div>
        <div class="field">
          <label class="form-label">Bag Size</label>
          <select id="item-size-${n}" onchange="toggleCustomSize(${n})">
            <option value="">Select</option>
            ${SIZE_OPTS.map(s => `<option value="${s}" ${prefill.size === s ? 'selected' : ''}>${s}</option>`).join('')}
            <option value="custom" ${prefill.size && !sizeInOpts ? 'selected' : ''}>Custom</option>
          </select>
        </div>
        <div class="field" id="cswrap-${n}" style="display:${prefill.size && !sizeInOpts ? 'block' : 'none'}">
          <label class="form-label">Custom Size</label>
          <input type="text" id="item-size-custom-${n}" value="${prefill.size && !sizeInOpts ? esc(prefill.size) : ''}">
        </div>
      </div>
      <div class="field" style="margin-bottom:.65rem">
        <label class="form-label">Coffee Type</label>
        <div class="pill-group" id="type-pills-${n}">
          ${['single-estate', 'blend', 'micro-lot', 'nano-lot'].map(v => `<span class="pill-opt ${prefill.coffee_type === v ? 'selected' : ''}" data-val="${v}" onclick="selectPill(this,'type-pills-${n}')">${TYPEMETA[v].label}</span>`).join('')}
        </div>
      </div>
      <div class="field" style="margin-bottom:.65rem">
        <label class="form-label">Process</label>
        <div class="pill-group" id="process-pills-${n}">
          ${['Natural', 'Washed', 'Honey', 'Anaerobic', 'Wet Hulled', 'Unknown'].map(v => `<span class="pill-opt ${(prefill.process || '') === (v) ? 'selected' : ''}" data-val="${v}" onclick="selectPill(this,'process-pills-${n}');toggleCustomProcess(${n})">${v}</span>`).join('')}
          <span class="pill-opt ${!['Natural', 'Washed', 'Honey', 'Anaerobic', 'Wet Hulled', 'Unknown', ''].includes(prefill.process || '') ? 'selected' : ''}" data-val="__custom__" onclick="selectPill(this,'process-pills-${n}');toggleCustomProcess(${n})">Customâ€¦</span>
        </div>
        <div id="custom-process-wrap-${n}" style="margin-top:.45rem;display:${!['Natural', 'Washed', 'Honey', 'Anaerobic', 'Wet Hulled', 'Unknown', ''].includes(prefill.process || '') ? 'block' : 'none'}">
          <input type="text" id="custom-process-${n}" placeholder="e.g. Carbonic Maceration, Extended Fermentâ€¦" value="${esc(!['Natural', 'Washed', 'Honey', 'Anaerobic', 'Wet Hulled', 'Unknown', ''].includes(prefill.process || '') ? prefill.process || '' : '')}">
        </div>
      </div>

    </div>
    <div class="field">
      <label class="form-label">Notes</label>
      <textarea id="item-notes-${n}" placeholder="Origin, tasting notes, process detailsâ€¦">${esc(prefill.notes || '')}</textarea>
    </div>`;
  $('itemsList').appendChild(div);
  toggleBeansFields(n);
  return n;
}

function removeItem(n) {
  const el = $(`item-${n}`);
  if (el) el.remove();
  if ($('itemsList').children.length === 0) addItemRow();
}
function toggleBeansFields(n) {
  const cat = $(`item-cat-${n}`)?.value;
  $(`beans-fields-${n}`)?.classList.toggle('hidden', cat !== 'beans');
}
function toggleCustomSize(n) {
  if ($(`cswrap-${n}`)) $(`cswrap-${n}`).style.display = $(`item-size-${n}`)?.value === 'custom' ? 'block' : 'none';
}
function toggleCombo() {
  const isCombo = $('inp-combo').checked;
  $('comboPriceWrap').classList.toggle('active', isCombo);
  document.querySelectorAll('[id^="item-price-wrap-"]').forEach(el => el.style.display = isCombo ? 'none' : '');
}
function selectPill(el, gid) {
  const already = el.classList.contains('selected');
  document.querySelectorAll(`#${gid} .pill-opt:not(.multi)`).forEach(p => p.classList.remove('selected'));
  if (!already) el.classList.add('selected');
}
function getPill(gid) { return document.querySelector(`#${gid} .pill-opt.selected`)?.dataset.val || ''; }
function getMulti(gid) { return [...document.querySelectorAll(`#${gid} .multi.selected`)].map(p => p.dataset.val); }
function toggleCustomProcess(n) {
  const sel = getPill(`process-pills-${n}`);
  const wrap = $(`custom-process-wrap-${n}`);
  if (wrap) wrap.style.display = sel === '__custom__' ? 'block' : 'none';
}
function getItemData(n) {
  const sizeRaw = $(`item-size-${n}`)?.value || '';
  return {
    category: $(`item-cat-${n}`)?.value || 'beans',
    name: ($(`item-name-${n}`)?.value || '').trim(),
    price: parseFloat($(`item-price-${n}`)?.value) || 0,
    notes: ($(`item-notes-${n}`)?.value || '').trim(),
    roaster: ($(`item-roaster-${n}`)?.value || '').trim(),
    size: sizeRaw === 'custom' ? ($(`item-size-custom-${n}`)?.value || '').trim() : sizeRaw,
    coffee_type: getPill(`type-pills-${n}`),
    process: (() => {
      const v = getPill(`process-pills-${n}`);
      if (v === '__custom__') return ($(`custom-process-${n}`)?.value || '').trim() || '';
      return v;
    })(),
    brew_equip: [],  // captured via journal entries instead
    qty: 1
  };
}
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   SAVE / EDIT / DELETE
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
async function saveOrder() {
  const date = $('inp-date').value;
  const vendor = $('inp-vendor').value.trim();
  const orderId = $('inp-order').value.trim();
  const isCombo = $('inp-combo').checked;
  const comboPrice = parseFloat($('inp-combo-price').value) || 0;
  if (!date || !vendor) { alert('Please fill in date and vendor.'); return; }
  const itemEls = [...$('itemsList').children];
  const items = [];
  for (const el of itemEls) {
    const n = el.id.replace('item-', '');
    const d = getItemData(n);
    if (!d.name) { alert('Every item needs a name.'); return; }
    items.push({ ...d, brew_equip: JSON.stringify(d.brew_equip) });
  }
  if (!items.length) { alert('Add at least one item.'); return; }

  if (editingId) {
    const item = items[0];
    try {
      const res = await fetch(API, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId, order_id: orderId, date, vendor,
          category: item.category, name: item.name, price: isCombo ? 0 : item.price,
          notes: item.notes, roaster: item.roaster, size: item.size,
          coffee_type: item.coffee_type, brew_equip: item.brew_equip, qty: 1,
          process: item.process,
          is_combo: isCombo, combo_price: comboPrice
        })
      });
      if (res.ok) { await loadData(); window.location.href = '/log'; }
      else alert('Save failed: ' + await res.text());
    } catch (e) { alert('Error: ' + e.message); }
  } else {
    try {
      const res = await fetch(API, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: { order_id: orderId, date, vendor, is_combo: isCombo, combo_price: comboPrice, notes: '' }, items })
      });
      if (res.ok) { await loadData(); window.location.href = '/log'; }
      else alert('Save failed: ' + await res.text());
    } catch (e) { alert('Error: ' + e.message); }
  }
}

function resetForm() {
  if (!$('addPageTitle')) return;
  editingId = null; itemCount = 0;
  $('addPageTitle').innerHTML = 'New <em>Order</em>';
  $('editBanner').classList.remove('active');
  $('inp-date').valueAsDate = new Date();
  $('inp-order').value = ''; $('inp-vendor').value = '';
  $('inp-combo').checked = false; $('inp-combo-price').value = '';
  $('comboPriceWrap').classList.remove('active');
  $('itemsList').innerHTML = ''; addItemRow();
}

async function editEntry(id) {
  if (document.body.dataset.page !== 'add') { window.location.href = '/add?edit=' + id; return; }
  const entry = logs.find(l => l.id === id);
  if (!entry) return;
  editingId = id;
  $('addPageTitle').innerHTML = 'Edit <em>Entry</em>';
  $('editBanner').textContent = `Editing "${entry.name}". Update and save.`;
  $('editBanner').classList.add('active');
  $('inp-date').value = entry.date; $('inp-order').value = entry.order_id || '';
  $('inp-vendor').value = entry.vendor;
  const isCombo = entry.is_combo === 1;
  $('inp-combo').checked = isCombo; $('inp-combo-price').value = entry.combo_price || '';
  $('comboPriceWrap').classList.toggle('active', isCombo);
  $('itemsList').innerHTML = ''; itemCount = 0;
  addItemRow(entry);
}

async function deleteEntry(id) {
  if (!confirm('Remove this entry?')) return;
  try {
    const res = await fetch(API, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    if (res.ok) { await loadData(); renderEntries(); }
  } catch (e) { alert('Delete failed: ' + e.message); }
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   RENDER: LOG
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function renderStats() {
  const beans = logs.filter(l => l.category === 'beans').reduce((s, l) => s + Number(l.price || 0), 0);
  const gears = logs.filter(l => l.category === 'gears').reduce((s, l) => s + Number(l.price || 0), 0);
  const acc = logs.filter(l => l.category === 'accessories').reduce((s, l) => s + Number(l.price || 0), 0);
  const total = beans + gears + acc;
  $('grandTotal').textContent = fmt(total);
  $('statBeans').textContent = fmt(beans);
  $('statGears').textContent = fmt(gears);
  $('statAcc').textContent = fmt(acc);
  $('statCount').textContent = logs.length;
}

function renderEntries() {
  let list = currentFilter === 'all' ? logs : logs.filter(l => l.category === currentFilter);
  list = [...list].sort((a, b) => new Date(b.date) - new Date(a.date));
  if (!list.length) { $('entriesList').innerHTML = '<div class="empty-state"><div class="icon">â˜•</div><p>No entries yet.</p></div>'; return; }

  const groups = {};
  list.forEach(l => {
    const k = (l.order_id || '').trim() || `solo-${l.id}`;
    (groups[k] = groups[k] || []).push(l);
  });
  const keys = Object.keys(groups).sort((a, b) => new Date(groups[b][0]?.date) - new Date(groups[a][0]?.date));

  let html = '';
  keys.forEach(k => {
    const g = groups[k];
    const isSolo = k.startsWith('solo-');
    const orderObj = orders.find(o => o.order_id === k);
    const isCombo = orderObj?.is_combo === 1;
    const comboPrice = orderObj?.combo_price || 0;
    const groupTotal = isCombo ? comboPrice : g.reduce((s, l) => s + Number(l.price || 0), 0);

    if (isSolo) {
      const l = g[0];
      html += renderEntryCard(l, false, 'solo-card type-' + l.category);
    } else {
      html += `<div class="order-group">
        <div class="order-group-header">
          <div class="og-left">
            <span class="og-id">#${k}</span>
            ${isCombo ? '<span class="combo-badge">Combo</span>' : ''}
            <span class="og-meta">${g[0]?.vendor || ''} Â· ${fmtDate(g[0]?.date)}</span>
          </div>
          <div class="og-actions">
            <span class="og-total">${fmt(groupTotal)}</span>
          </div>
        </div>`;
      g.forEach(l => { html += renderEntryCard(l, isCombo, 'entry-card type-' + l.category); });
      html += '</div>';
    }
  });
  $('entriesList').innerHTML = html;
}

function renderEntryCard(l, isCombo, cls) {
  const tag = l.category === 'beans' ? 'tag-beans' : l.category === 'gears' ? 'tag-gears' : 'tag-accessories';
  const lbl = l.category === 'beans' ? 'Beans' : l.category === 'gears' ? 'Gears' : 'Accessories';
  const pills = [];
  if (l.roaster && l.category === 'beans') pills.push(`<span class="epill">${esc(l.roaster)}</span>`);
  if (l.size) pills.push(`<span class="epill">${esc(l.size)}</span>`);
  if (l.coffee_type && TYPEMETA[l.coffee_type]) pills.push(`<span class="epill">${TYPEMETA[l.coffee_type].label}</span>`);
  const proc = detectProcess(l);
  if (proc) pills.push(`<span class="epill process">${proc.icon} ${proc.label}</span>`);
  getBrew(l).forEach(b => pills.push(`<span class="epill brew">â˜• ${esc(b)}</span>`));
  const priceHtml = isCombo ? `<span class="entry-price combo-part">combo</span>` : `<span class="entry-price">${fmt(l.price)}</span>`;
  return `<div class="${cls}">
    <div class="entry-left">
      <div class="entry-name">${esc(l.name)}</div>
      <div class="entry-meta">
        <span class="entry-vendor">${esc(l.vendor)}</span>
        <span class="entry-date">${fmtDate(l.date)}</span>
        <span class="entry-tag ${tag}">${lbl}</span>
      </div>
      ${pills.length ? `<div class="entry-pills">${pills.join('')}</div>` : ''}
      ${l.notes ? `<div class="entry-notes">${esc(l.notes)}</div>` : ''}
    </div>
    <div class="entry-right">
      ${priceHtml}
      <div style="display:flex;gap:.3rem">
        <button class="action-btn" onclick="editEntry(${l.id})">Edit</button>
        <button class="action-btn del" onclick="deleteEntry(${l.id})">âœ•</button>
      </div>
    </div>
  </div>`;
}

function setFilter(f, btn) {
  currentFilter = f;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderEntries();
}

let currentShelfFilter = 'available';
function setShelfFilter(f, btn) {
  currentShelfFilter = f;
  document.querySelectorAll('#page-shelf .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderShelf();
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   RENDER: SHELF
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function renderShelf() {
  const beans = logs.filter(l => l.category === 'beans').sort((a, b) => new Date(b.date) - new Date(a.date));
  const finished = beans.filter(b => finishedBags.includes(b.id));
  const unfinished = beans.filter(b => !finishedBags.includes(b.id));

  const opened = unfinished.filter(b => bagMeta[b.id] && bagMeta[b.id].openedDate);
  const sealed = unfinished.filter(b => !bagMeta[b.id] || !bagMeta[b.id].openedDate);

  // Header = total bags ever purchased
  $('shelfCount').textContent = beans.length;
  $('shelfActive').textContent = opened.length;
  $('shelfSealedCard').textContent = sealed.length;

  const renderBag = (l, isDone) => {
    const meta = bagMeta[l.id] || {};
    const proc = detectProcess(l);
    const brew = getBrew(l);
    const pills = [];
    if (l.roaster) pills.push(`<span class="epill">${esc(l.roaster)}</span>`);
    if (l.size) pills.push(`<span class="epill">${esc(l.size)}</span>`);
    if (l.coffee_type && TYPEMETA[l.coffee_type]) pills.push(`<span class="epill">${TYPEMETA[l.coffee_type].label}</span>`);
    if (proc) pills.push(`<span class="epill process">${proc.icon} ${proc.label}</span>`);
    brew.forEach(b => pills.push(`<span class="epill brew">â˜• ${esc(b)}</span>`));

    // Lifecycle date pills
    const lifePills = [];
    if (meta.roastDate) lifePills.push(`<span class="epill" style="background:var(--green-bg);color:var(--green)">ðŸŒ¿ Roasted ${fmtDate(meta.roastDate)}</span>`);
    if (meta.deliveredDate) lifePills.push(`<span class="epill">ðŸ“¦ ${fmtDate(meta.deliveredDate)}</span>`);
    if (meta.openedDate) lifePills.push(`<span class="epill">ðŸ”“ ${fmtDate(meta.openedDate)}</span>`);
    if (isDone && meta.finishedDate) lifePills.push(`<span class="epill" style="background:var(--green-bg);color:var(--green)">âœ… ${fmtDate(meta.finishedDate)}</span>`);

    // Gram usage bar
    const entries = meta.gramEntries || [];
    const totalUsed = entries.reduce((s, e) => s + Number(e.grams || 0), 0);
    const bagSizeG = parseBagSize(l.size);
    let gramBar = '';
    if (!isDone && totalUsed > 0) {
      if (bagSizeG) {
        const pct = Math.min(100, Math.round(totalUsed / bagSizeG * 100));
        gramBar = `<div class="freshness-bar-wrap">
          <div class="freshness-label">${totalUsed}g brewed Â· ${bagSizeG - totalUsed > 0 ? (bagSizeG - totalUsed) + 'g left' : 'bag empty'}</div>
          <div class="freshness-track"><div class="freshness-fill ${pct >= 100 ? 'fresh-red' : 'fresh-amber'}" style="width:${pct}%"></div></div>
        </div>`;
      } else {
        gramBar = `<div class="freshness-bar-wrap"><div class="freshness-label">${totalUsed}g brewed total</div></div>`;
      }
    }

    // Freshness bar â€” two-phase: resting (from roast) + freshness (from bag opened)
    let freshnessBar = '';
    if (!isDone) {
      // Per-bean rest days (user-set or smart default based on process)
      const RESTING_DAYS = meta.restDays != null ? meta.restDays : _defaultRestDays(l);
      const FRESH_AFTER_OPEN = 30; // days of peak freshness after opening
      const SEALED_SHELF_LIFE = 60; // days sealed bags stay fresh from roast
      const now = Date.now();

      const roastDate = meta.roastDate ? new Date(meta.roastDate + 'T00:00:00').getTime() : null;
      const openedDate = meta.openedDate ? new Date(meta.openedDate + 'T00:00:00').getTime() : null;
      const purchaseDate = new Date((l.date || '') + 'T00:00:00').getTime();
      const daysSinceRoast = roastDate ? Math.floor((now - roastDate) / 86400000) : null;
      const daysSinceOpened = openedDate ? Math.floor((now - openedDate) / 86400000) : null;

      if (roastDate && daysSinceRoast < RESTING_DAYS && !openedDate) {
        // â”€â”€ Phase 1: Still resting / degassing (only if bag not yet opened)
        const restPct = Math.min(100, Math.round(daysSinceRoast / RESTING_DAYS * 100));
        const daysLeft = RESTING_DAYS - daysSinceRoast;
        freshnessBar = `<div class="freshness-bar-wrap">
          <div class="freshness-label">â˜ï¸ Resting Â· ${daysSinceRoast}d of ${RESTING_DAYS}d degassing Â· ${daysLeft}d left</div>
          <div class="freshness-track"><div class="freshness-fill fresh-blue" style="width:${restPct}%"></div></div>
        </div>`;
      } else if (roastDate && daysSinceRoast >= RESTING_DAYS && !openedDate) {
        // â”€â”€ Resting complete but bag not opened yet â€” sealed shelf life
        const sealedDays = daysSinceRoast;
        const sealedPct = Math.max(0, Math.min(100, 100 - Math.round(sealedDays / SEALED_SHELF_LIFE * 100)));
        const sealedCls = sealedPct > 60 ? 'fresh-green' : sealedPct > 30 ? 'fresh-amber' : 'fresh-red';
        const sealedLabel = sealedPct > 60 ? 'âœ… Ready to open' : sealedPct > 30 ? 'â³ Open soon' : 'âš ï¸ Open now';
        freshnessBar = `<div class="freshness-bar-wrap">
          <div class="freshness-label">${sealedLabel} Â· Rested ${daysSinceRoast}d since roast Â· sealed</div>
          <div class="freshness-track"><div class="freshness-fill ${sealedCls}" style="width:${sealedPct}%"></div></div>
        </div>`;
      } else if (openedDate) {
        // â”€â”€ Phase 2: Bag is opened â€” freshness countdown from opened date
        // Also factor in roast age at open if available
        let maxFresh = FRESH_AFTER_OPEN;
        let extraInfo = '';
        if (roastDate) {
          const roastAgeAtOpen = Math.floor((openedDate - roastDate) / 86400000);
          const wasRested = roastAgeAtOpen >= RESTING_DAYS;
          extraInfo = wasRested
            ? ` Â· rested ${roastAgeAtOpen}d`
            : ` Â· opened early (${roastAgeAtOpen}d rest)`;
          // If opened much later after roast, shorten the fresh window
          if (roastAgeAtOpen > 30) maxFresh = Math.max(14, FRESH_AFTER_OPEN - Math.floor((roastAgeAtOpen - 30) / 3));
        }
        const freshPct = Math.max(0, Math.min(100, 100 - Math.round(daysSinceOpened / maxFresh * 100)));
        const freshCls = freshPct > 60 ? 'fresh-green' : freshPct > 30 ? 'fresh-amber' : 'fresh-red';
        const freshLabel = freshPct > 60 ? 'Peak Fresh' : freshPct > 30 ? 'Use Soon' : 'Getting Stale';
        freshnessBar = `<div class="freshness-bar-wrap">
          <div class="freshness-label">${freshLabel} Â· ${daysSinceOpened}d since opened${extraInfo}</div>
          <div class="freshness-track"><div class="freshness-fill ${freshCls}" style="width:${freshPct}%"></div></div>
        </div>`;
      } else {
        // â”€â”€ Fallback: no roast date or opened date â€” use purchase date
        const daysSincePurchase = Math.floor((now - purchaseDate) / 86400000);
        const fallbackMax = 45;
        const freshPct = Math.max(0, Math.min(100, 100 - Math.round(daysSincePurchase / fallbackMax * 100)));
        const freshCls = freshPct > 60 ? 'fresh-green' : freshPct > 30 ? 'fresh-amber' : 'fresh-red';
        const freshLabel = freshPct > 60 ? 'Likely Fresh' : freshPct > 30 ? 'Check Freshness' : 'Possibly Stale';
        freshnessBar = `<div class="freshness-bar-wrap">
          <div class="freshness-label">${freshLabel} Â· ${daysSincePurchase}d since purchase</div>
          <div class="freshness-track"><div class="freshness-fill ${freshCls}" style="width:${freshPct}%"></div></div>
        </div>`;
      }
    }

    return `<div class="shelf-card ${isDone ? 'finished' : ''}">
      <div class="shelf-left">
        <div class="shelf-name">${esc(l.name)}</div>
        <div class="shelf-roaster">${esc(l.vendor)}${l.roaster && l.roaster !== l.vendor ? ' Â· ' + esc(l.roaster) : ''}</div>
        ${pills.length ? `<div class="shelf-pills">${pills.join('')}</div>` : ''}
        ${lifePills.length ? `<div class="shelf-pills" style="margin-top:.32rem">${lifePills.join('')}</div>` : ''}
        ${freshnessBar}
        ${gramBar}
      </div>
      <div class="shelf-right">

        <span class="shelf-date">${fmtDate(l.date)}</span>
        <button class="action-btn" onclick="openBagModal(${l.id})" style="font-size:.68rem;white-space:nowrap">ðŸ“‹ Track</button>
        <button class="btn-finish ${isDone ? 'done' : ''}" onclick="toggleFinished(${l.id})">
          ${isDone ? 'â†© Reopen' : 'âœ“ Finished'}
        </button>
      </div>
    </div>`;
  };

  let listToShow = [];
  if (currentShelfFilter === 'available') listToShow = unfinished;
  else listToShow = finished;

  $('shelf-list').innerHTML = listToShow.length
    ? listToShow.map(b => renderBag(b, currentShelfFilter === 'finished')).join('')
    : `<div class="empty-state"><div class="icon">ðŸ«™</div><p>No ${currentShelfFilter} beans found.</p></div>`;
}

async function toggleFinished(id) {
  if (!bagMeta[id]) bagMeta[id] = {};
  if (finishedBags.includes(id)) {
    finishedBags = finishedBags.filter(x => x !== id);
    bagMeta[id].finishedDate = '';
    bagMeta[id].isFinished = false;
  } else {
    finishedBags.push(id);
    if (!bagMeta[id].finishedDate) {
      bagMeta[id].finishedDate = new Date().toISOString().slice(0, 10);
    }
    bagMeta[id].isFinished = true;
  }
  await _syncShelf(id);
  renderShelf();
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   BAG LIFECYCLE MODAL
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function parseBagSize(size) {
  if (!size) return null;
  const m = String(size).match(/(\d+(?:\.\d+)?)\s*g/i);
  if (m) return Number(m[1]);
  const km = String(size).match(/(\d+(?:\.\d+)?)\s*kg/i);
  if (km) return Number(km[1]) * 1000;
  return null;
}

// Smart default rest days based on process
function _defaultRestDays(log) {
  const proc = (log?.process || '').toLowerCase();
  // Espresso-style darker roasts degas faster; lighter & anaerobic/natural need longer
  if (proc.includes('anaerobic') || proc.includes('carbonic')) return 14;
  if (proc.includes('natural')) return 10;
  if (proc.includes('honey')) return 9;
  if (proc.includes('washed')) return 7;
  return 7; // sensible default
}

function openBagModal(id) {
  const meta = bagMeta[id] || {};
  const log = logs.find(l => l.id === id);
  $('bagModalId').value = id;
  $('bagModalTitle').innerHTML = log
    ? `Track <em>${esc(log.name)}</em>`
    : 'Track <em>Bag</em>';
  $('bm-roastDate').value = meta.roastDate || '';
  $('bm-deliveredDate').value = meta.deliveredDate || '';
  $('bm-openedDate').value = meta.openedDate || '';
  $('bm-finishedDate').value = meta.finishedDate || '';
  // Rest days: show saved value or smart default from process
  const restDefault = _defaultRestDays(log);
  $('bm-restDays').value = meta.restDays != null ? meta.restDays : restDefault;
  $('bm-restDays').placeholder = restDefault;
  if (!bagMeta[id]) bagMeta[id] = {};
  if (!bagMeta[id].gramEntries) bagMeta[id].gramEntries = [];
  renderGramEntries(id);
  $('bagModalOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeBagModal(e) {
  if (e && e.target !== $('bagModalOverlay')) return;
  $('bagModalOverlay').classList.add('hidden');
  document.body.style.overflow = '';
}

function _gramTotal(id) {
  return (bagMeta[id]?.gramEntries || []).reduce((s, e) => s + Number(e.grams || 0), 0);
}

function _updateGramUI(id) {
  const log = logs.find(l => l.id === id);
  const bagSizeG = parseBagSize(log?.size);
  const totalUsed = _gramTotal(id);
  if (bagSizeG) {
    const pct = Math.min(100, Math.round(totalUsed / bagSizeG * 100));
    $('bm-gramFill').style.width = pct + '%';
    $('bm-gramFill').className = 'gram-fill' + (totalUsed > bagSizeG ? ' over' : '');
    $('bm-gramTrack').style.display = '';
    const rem = bagSizeG - totalUsed;
    $('bm-gramSummary').textContent = `${totalUsed}g used of ${bagSizeG}g Â· ${rem > 0 ? rem + 'g remaining' : 'bag empty'}`;
  } else {
    $('bm-gramTrack').style.display = 'none';
    $('bm-gramSummary').textContent = totalUsed > 0 ? `${totalUsed}g used total` : '';
  }
}

function renderGramEntries(id) {
  _updateGramUI(id);
  const entries = bagMeta[id]?.gramEntries || [];
  $('bm-gramHeaders').style.display = entries.length ? 'grid' : 'none';
  const USE_FOR_OPTS = ['Espresso', 'Americano', 'Pour Over', 'French Press', 'Cold Brew', 'AeroPress', 'Gifted', 'Other'];
  $('bm-gramList').innerHTML = entries.map((e, i) => `
    <div class="gram-entry-row" style="grid-template-columns:1fr 80px 120px 34px">
      <input type="date" value="${e.date || ''}"
        onchange="updateGramEntry(${i},'date',this.value)">
      <input type="number" value="${e.grams || ''}" placeholder="g" min="0" step="0.1"
        oninput="updateGramEntry(${i},'grams',this.value)">
      <select onchange="updateGramEntry(${i},'usedFor',this.value)" style="font-size:.75rem;padding:.45rem .5rem">
        <option value="">â€” for â€”</option>
        ${USE_FOR_OPTS.map(o => `<option value="${o}" ${e.usedFor === o ? 'selected' : ''}>${o}</option>`).join('')}
      </select>
      <button class="btn-rm-gram" onclick="removeGramEntry(${i})">âœ•</button>
    </div>`).join('');
}

function addGramEntry() {
  const id = Number($('bagModalId').value);
  if (!bagMeta[id]) bagMeta[id] = {};
  if (!bagMeta[id].gramEntries) bagMeta[id].gramEntries = [];
  bagMeta[id].gramEntries.push({ date: new Date().toISOString().slice(0, 10), grams: '', usedFor: '' });
  renderGramEntries(id);
  _syncShelf(id);
}

function removeGramEntry(idx) {
  const id = Number($('bagModalId').value);
  if (!bagMeta[id]?.gramEntries) return;
  bagMeta[id].gramEntries.splice(idx, 1);
  renderGramEntries(id);
  _syncShelf(id);
}

function updateGramEntry(idx, field, val) {
  const id = Number($('bagModalId').value);
  if (!bagMeta[id]?.gramEntries?.[idx] === undefined) return;
  bagMeta[id].gramEntries[idx][field] = field === 'grams' ? Number(val) || '' : val;
  _updateGramUI(id);
  _syncShelf(id);
}

async function saveBagMeta() {
  const id = Number($('bagModalId').value);
  if (!bagMeta[id]) bagMeta[id] = {};
  bagMeta[id].roastDate = $('bm-roastDate').value;
  bagMeta[id].deliveredDate = $('bm-deliveredDate').value;
  bagMeta[id].openedDate = $('bm-openedDate').value;
  bagMeta[id].finishedDate = $('bm-finishedDate').value;
  const restVal = parseInt($('bm-restDays').value);
  bagMeta[id].restDays = isNaN(restVal) ? null : restVal;
  // Sync finished state
  if (bagMeta[id].finishedDate) {
    bagMeta[id].isFinished = true;
    if (!finishedBags.includes(id)) finishedBags.push(id);
  } else {
    bagMeta[id].isFinished = false;
    finishedBags = finishedBags.filter(x => x !== id);
  }
  // Persist to D1
  await _syncShelf(id);
  $('bagModalOverlay').classList.add('hidden');
  document.body.style.overflow = '';
  renderShelf();
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   RENDER: PROCESS
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function detectProcess(l) {
  if (l.category !== 'beans') return null;
  // 1. Prefer the explicit process field
  const explicit = (l.process || '').trim();
  if (explicit) {
    // See if it matches a canonical process
    const match = PROCESS_MAP.find(p =>
      p.key === explicit.toLowerCase() ||
      p.label.toLowerCase() === explicit.toLowerCase()
    );
    if (match) return match;
    // Otherwise it's a custom process â€” return a synthetic entry
    return { key: '__custom__:' + explicit, label: explicit, icon: 'âœ¨', custom: true };
  }
  // 2. Fallback: keyword scan of name/notes
  const haystack = [(l.name || ''), (l.notes || '')].join(' ').toLowerCase();
  for (const p of PROCESS_MAP) {
    if (haystack.includes(p.key)) return p;
  }
  return null;
}

function getBrew(l) {
  try { return JSON.parse(l.brew_equip || '[]') || []; }
  catch { return typeof l.brew_equip === 'string' ? l.brew_equip.split(',').filter(Boolean) : []; }
}

function renderProcess() {
  const beans = logs.filter(l => l.category === 'beans');
  const grouped = {};
  PROCESS_MAP.forEach(p => { grouped[p.key] = []; });
  grouped['unknown'] = [];
  // custom keys will be added dynamically

  beans.forEach(l => {
    const p = detectProcess(l);
    const key = p ? p.key : 'unknown';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(l);
  });

  // Build ordered list: canonical processes first, then custom, then unknown
  const customKeys = Object.keys(grouped).filter(k => k.startsWith('__custom__:'));
  const processOrder = [...PROCESS_MAP.map(p => p.key), ...customKeys, 'unknown'];
  let html = '';
  processOrder.forEach(key => {
    const list = grouped[key];
    if (!list || !list.length) return;
    let meta;
    if (key.startsWith('__custom__:')) {
      const label = key.replace('__custom__:', '');
      meta = { label, icon: 'âœ¨', hint: 'custom process' };
    } else {
      meta = PROCESS_MAP.find(p => p.key === key) || { label: 'Untagged', icon: 'â“', hint: 'process not identified' };
    }
    const total = list.reduce((s, l) => s + Number(l.price || 0), 0);
    html += `<div class="process-group">
      <div class="process-header">
        <span class="process-icon">${meta.icon}</span>
        <div class="process-title-wrap">
          <div class="process-name">${meta.label}</div>
          <div class="process-count">${list.length} bag${list.length !== 1 ? 's' : ''} Â· ${fmt(total)}</div>
        </div>
      </div>`;
    list.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(l => {
      const brew = getBrew(l);
      html += `<div class="process-card">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.7rem">
          <div>
            <div class="process-card-name">${esc(l.name)}</div>
            <div class="process-card-meta">
              <span class="process-card-roaster">${esc(l.vendor)}${l.roaster && l.roaster !== l.vendor ? ' Â· ' + esc(l.roaster) : ''}</span>
              <span class="process-card-date">${fmtDate(l.date)}</span>
              ${l.size ? `<span class="epill">${esc(l.size)}</span>` : ''}
              ${l.coffee_type && TYPEMETA[l.coffee_type] ? `<span class="epill">${TYPEMETA[l.coffee_type].label}</span>` : ''}
            </div>
            ${brew.length ? `<div class="entry-pills" style="margin-top:.38rem">${brew.map(b => `<span class="epill brew">â˜• ${esc(b)}</span>`).join('')}</div>` : ''}
            ${l.notes ? `<div class="entry-notes" style="margin-top:.28rem">${esc(l.notes)}</div>` : ''}
          </div>

        </div>
      </div>`;
    });
    html += '</div>';
  });

  $('processList').innerHTML = html || '<div class="empty-state"><div class="icon">ðŸŒ¿</div><p>Log some beans to see them by process.</p></div>';
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   RENDER: JOURNAL
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function renderJournal() {
  // stats
  const total = journal.length;
  const rated = journal.filter(j => j.rating > 0);
  const avgR = rated.length ? Math.round(rated.reduce((s, j) => s + j.rating, 0) / rated.length * 10) / 10 : null;
  const brewCount = {};
  journal.forEach(j => { if (j.brewer) brewCount[j.brewer] = (brewCount[j.brewer] || 0) + 1; });
  const favBrew = Object.entries(brewCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'â€”';
  $('jsTotal').textContent = total;
  $('jsAvgRating').textContent = avgR ? avgR + 'â˜…' : 'â€”';
  $('jsFavMethod').textContent = favBrew.split(' ')[0]; // short label
  // Money saved stat in journal header (journal-tracked sessions only)
  const { totalSaved } = calcMoneySaved();
  $('jsSaved').textContent = (totalSaved >= 0 ? 'â‚¹' : '-â‚¹') + Math.abs(totalSaved).toLocaleString('en-IN', { maximumFractionDigits: 0 });

  if (!journal.length) {
    $('journalList').innerHTML = '<div class="empty-state"><div class="icon">ðŸ““</div><p>Log your first brew session!</p></div>';
    return;
  }

  const sorted = [...journal].sort((a, b) => new Date(b.date) - new Date(a.date));
  $('journalList').innerHTML = sorted.map(j => {
    const stars = 'â˜…'.repeat(j.rating || 0) + 'â˜†'.repeat(5 - (j.rating || 0));
    const tastes = (j.tastes || []).map(t => `<span class="taste-chip">${esc(t)}</span>`).join('');
    const meta = [];
    if (j.brewer) meta.push(`<span class="epill brew">â˜• ${esc(j.brewer)}</span>`);
    if (j.dose) meta.push(`<span class="epill">${j.dose}g dose</span>`);
    if (j.yield) meta.push(`<span class="epill">${j.yield}g yield</span>`);
    if (j.time) meta.push(`<span class="epill">${j.time}s</span>`);
    if (j.temp) meta.push(`<span class="epill">${j.temp}Â°C</span>`);
    if (j.grinder) meta.push(`<span class="epill">âš™ï¸ ${esc(j.grinder)}</span>`);
    if (j.grind) meta.push(`<span class="epill">ðŸ“ ${esc(j.grind)}</span>`);
    const beanName = j.beanId ? logs.find(l => l.id === parseInt(j.beanId))?.name || j.beanLabel || '' : j.beanLabel || '';
    return `<div class="journal-entry">
      <div class="je-header">
        <div>
          <div class="je-title">${beanName ? esc(beanName) : 'Brew Session'}</div>
          <div style="font-size:.72rem;color:var(--caramel);margin-top:.1rem">${stars}</div>
        </div>
        <div class="je-date">${fmtDate(j.date)}</div>
      </div>
      ${meta.length ? `<div class="je-meta">${meta.join('')}</div>` : ''}
      ${tastes ? `<div class="tasting-chips" style="margin-top:.4rem">${tastes}</div>` : ''}
      ${j.notes ? `<div class="je-notes">${esc(j.notes)}</div>` : ''}
      <div class="je-actions">
        <button class="action-btn" onclick="openJournalModal(${j.id})">Edit</button>
        <button class="action-btn del" onclick="deleteJournalEntry(${j.id})">âœ•</button>
      </div>
    </div>`;
  }).join('');
}

function openJournalModal(editId) {
  // populate bean select from logs â€” exclude finished bags
  const beans = logs.filter(l => l.category === 'beans' && !finishedBags.includes(l.id)).sort((a, b) => new Date(b.date) - new Date(a.date));
  $('j-bean').innerHTML = '<option value="">â€” Select a bean â€”</option>' +
    beans.map(b => `<option value="${b.id}">${esc(b.name)} (${esc(b.roaster || b.vendor)})</option>`).join('');

  if (editId) {
    const j = journal.find(x => String(x.id) === String(editId));
    if (!j) return;
    jEditId = editId;
    $('jModalTitle').textContent = 'Edit Session';
    $('j-date').value = j.date || '';
    $('j-brewer').value = j.brewer || '';
    $('j-grinder').value = j.grinder || '';
    $('j-bean').value = j.beanId || '';
    $('j-dose').value = j.dose || '';
    $('j-yield').value = j.yield || '';
    $('j-time').value = j.time || '';
    $('j-temp').value = j.temp || '';
    $('j-grind').value = j.grind || '';
    $('j-notes').value = j.notes || '';
    setRating(j.rating || 0);
    document.querySelectorAll('#tastePills .pill-opt').forEach(p => {
      p.classList.toggle('selected', (j.tastes || []).includes(p.textContent));
    });
  } else {
    jEditId = null; jRating = 0;
    $('jModalTitle').textContent = 'New Brew Session';
    $('j-date').valueAsDate = new Date();
    $('j-brewer').value = ''; $('j-grinder').value = ''; $('j-bean').value = '';
    ['j-dose', 'j-yield', 'j-time', 'j-temp', 'j-grind', 'j-notes'].forEach(id => $(id).value = '');
    document.querySelectorAll('#jRatingStars .star').forEach(s => s.classList.remove('filled'));
    document.querySelectorAll('#tastePills .pill-opt').forEach(p => p.classList.remove('selected'));
  }
  $('journalModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeJModal() {
  $('journalModal').classList.remove('open');
  document.body.style.overflow = '';
}
function maybeCloseJModal(e) { if (e.target === $('journalModal')) closeJModal(); }

function setRating(v) {
  jRating = v;
  document.querySelectorAll('#jRatingStars .star').forEach(s => {
    s.classList.toggle('filled', parseInt(s.dataset.v) <= v);
  });
}

async function saveJournalEntry() {
  const date = $('j-date').value;
  const brewer = $('j-brewer').value;
  const grinder = $('j-grinder').value;
  const beanId = $('j-bean').value;
  const beanLabel = beanId ? $('j-bean').options[$('j-bean').selectedIndex].text : '';
  const dose = parseFloat($('j-dose').value) || 0;
  const yld = parseFloat($('j-yield').value) || 0;
  const time = parseFloat($('j-time').value) || 0;
  const temp = parseFloat($('j-temp').value) || 0;
  const grind = $('j-grind').value.trim();
  const notes = $('j-notes').value.trim();
  const tastes = [...document.querySelectorAll('#tastePills .multi.selected')].map(p => p.textContent);

  const entry = {
    id: jEditId || Date.now(),
    date, brewer, grinder, beanId, beanLabel, dose, yield: yld, time, temp, grind, notes,
    rating: jRating, tastes
  };

  // Sync to D1
  if (jEditId) {
    await fetch(API + '?route=journal', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry)
    });
  } else {
    await fetch(API + '?route=journal', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry)
    });
  }
  // Reload from D1 so all devices stay in sync
  const jr = await fetch(API + '?route=journal');
  const jd = await jr.json();
  journal = (jd.journal || []).map(j => ({
    ...j,
    beanId: j.beanId || j.bean_id,
    beanLabel: j.beanLabel || j.bean_label,
    tastes: typeof j.tastes === 'string' ? JSON.parse(j.tastes || '[]') : (j.tastes || []),
  }));
  closeJModal();
  renderJournal();
}

async function deleteJournalEntry(id) {
  if (!confirm('Delete this session?')) return;
  await fetch(API, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'deleteJournal', id })
  });
  journal = journal.filter(j => String(j.id) !== String(id));
  renderJournal();
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   MONEY SAVED CALCULATOR
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
// Brewer category classification
const ESPRESSO_BREWERS = ['Cafflano Kompresso', 'Espresso Machine'];
const AMERICANO_BREWERS = ['Moka Pot'];
// Market prices per cup
const MARKET_ESPRESSO = 140;  // â‚¹/cup
const MARKET_AMERICANO = 100; // â‚¹/cup
const MARKET_STANDARD = 80;   // â‚¹/cup (all other methods)
const STD_DOSE_G = 15;        // grams per cup (standard assumption)

function marketPriceForBrewer(brewer) {
  if (!brewer) return MARKET_STANDARD;
  if (ESPRESSO_BREWERS.includes(brewer)) return MARKET_ESPRESSO;
  if (AMERICANO_BREWERS.includes(brewer)) return MARKET_AMERICANO;
  return MARKET_STANDARD;
}

// Returns cost-per-gram for a specific bean log entry
function beanCostPerGram(logEntry) {
  if (!logEntry) return null;
  const price = Number(logEntry.price || 0);
  if (!price) return null;
  const sz = String(logEntry.size || '');
  const gMatch = sz.match(/(\d+(?:\.\d+)?)\s*g/i);
  const kgMatch = sz.match(/(\d+(?:\.\d+)?)\s*kg/i);
  const grams = gMatch ? Number(gMatch[1]) : kgMatch ? Number(kgMatch[1]) * 1000 : 0;
  return grams > 0 ? price / grams : null;
}

// Global average cost per gram from all bean purchases with known price+size
function globalCostPerGram() {
  const beans = logs.filter(l => l.category === 'beans' && l.price && l.size);
  let totalG = 0, totalP = 0;
  beans.forEach(l => {
    const cpg = beanCostPerGram(l);
    if (!cpg) return;
    const sz = String(l.size || '');
    const gM = sz.match(/(\d+(?:\.\d+)?)\s*g/i);
    const kgM = sz.match(/(\d+(?:\.\d+)?)\s*kg/i);
    const g = gM ? Number(gM[1]) : kgM ? Number(kgM[1]) * 1000 : 0;
    totalG += g; totalP += Number(l.price || 0);
  });
  return totalG > 0 ? totalP / totalG : 0;
}

function calcMoneySaved() {
  const gcpg = globalCostPerGram(); // global fallback â‚¹/g
  const rows = []; // { label, cups, homeCost, cafeCost, saved, note }

  // â”€â”€ Part 1: Journal-tracked sessions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Each journal entry = 1 cup. Use actual dose if given, else STD_DOSE_G.
  const trackedBeanIds = new Set();
  journal.forEach(j => {
    const dose = Number(j.dose) || STD_DOSE_G;
    const marketPrice = marketPriceForBrewer(j.brewer);
    // Find linked bean to get its cost-per-gram
    const beanLog = j.beanId ? logs.find(l => l.id === parseInt(j.beanId)) : null;
    const cpg = beanLog ? (beanCostPerGram(beanLog) || gcpg) : gcpg;
    const homeCost = cpg > 0 ? dose * cpg : 0;
    const cafeCost = marketPrice;
    const saved = cafeCost - homeCost;
    const beanName = beanLog?.name || j.beanLabel || 'Unknown bean';
    const brewerLabel = j.brewer || 'Unknown brewer';
    rows.push({
      label: `${beanName} â€” ${brewerLabel}`,
      date: j.date,
      cups: 1,
      dose,
      homeCost,
      cafeCost,
      saved,
      tracked: true,
      note: `${dose}g dose Â· â‚¹${cpg > 0 ? (cpg * dose).toFixed(0) : '?'} beans Â· vs â‚¹${marketPrice} cafÃ©`,
    });
    if (beanLog) trackedBeanIds.add(beanLog.id);
  });

  // â”€â”€ Part 2: Bean bags without any journal tracking â”€â”€â”€â”€â”€
  // For beans with known size, estimate cups = size_g / STD_DOSE_G
  // Assume standard â‚¹80 market price since brewer is unknown
  const untrackedBeans = logs.filter(l =>
    l.category === 'beans' &&
    l.size &&
    !trackedBeanIds.has(l.id)
  );
  untrackedBeans.forEach(l => {
    const sz = String(l.size || '');
    const gM = sz.match(/(\d+(?:\.\d+)?)\s*g/i);
    const kgM = sz.match(/(\d+(?:\.\d+)?)\s*kg/i);
    const totalG = gM ? Number(gM[1]) : kgM ? Number(kgM[1]) * 1000 : 0;
    if (!totalG) return;
    const cups = Math.round(totalG / STD_DOSE_G);
    if (!cups) return;
    const cpg = beanCostPerGram(l) || gcpg;
    const homeCost = cpg > 0 ? totalG * cpg : Number(l.price || 0);
    const cafeCost = cups * MARKET_STANDARD;
    const saved = cafeCost - homeCost;
    rows.push({
      label: l.name,
      date: l.date,
      cups,
      dose: STD_DOSE_G,
      homeCost,
      cafeCost,
      saved,
      tracked: false,
      note: `${cups} cups estimated Â· ${STD_DOSE_G}g/cup Â· vs â‚¹${MARKET_STANDARD}/cup standard`,
    });
  });

  const totalHomeCost = rows.reduce((s, r) => s + r.homeCost, 0);
  const totalCafeCost = rows.reduce((s, r) => s + r.cafeCost, 0);
  const totalSaved = totalCafeCost - totalHomeCost;
  return { rows, totalHomeCost, totalCafeCost, totalSaved };
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   RENDER: INSIGHTS
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function renderInsights() {
  const beans = logs.filter(l => l.category === 'beans');
  const gears = logs.filter(l => l.category === 'gears');
  const acc = logs.filter(l => l.category === 'accessories');
  const bTotal = beans.reduce((s, l) => s + Number(l.price || 0), 0);
  const gTotal = gears.reduce((s, l) => s + Number(l.price || 0), 0);
  const aTotal = acc.reduce((s, l) => s + Number(l.price || 0), 0);
  const total = bTotal + gTotal + aTotal;

  // Vendor totals
  const vendorTot = {};
  logs.forEach(l => { vendorTot[l.vendor] = (vendorTot[l.vendor] || 0) + Number(l.price || 0); });
  const topVendors = Object.entries(vendorTot).sort((a, b) => b[1] - a[1]);
  const topVendor = topVendors[0]?.[0] || 'â€”';

  // Roasters (unique)
  const roasters = new Set(beans.map(l => l.roaster).filter(Boolean));

  // Cost per gram
  const bagsWithSize = beans.filter(l => l.size && l.price);
  let costPerGram = 0;
  const cpg = bagsWithSize.length ? (() => {
    const totalG = bagsWithSize.reduce((s, l) => {
      const g = parseFloat(l.size) || 0;
      return s + g;
    }, 0);
    const totalP = bagsWithSize.reduce((s, l) => s + Number(l.price || 0), 0);
    if (totalG > 0) {
      costPerGram = totalP / totalG;
      return Math.round(costPerGram * 100)
    }
    return 0;
  })() : 0;

  // Price per cup â€” fixed 15g dose * cost per gram
  let pricPerCup = 0;
  if (beans.length > 0) {
    const totalGrams = bagsWithSize.reduce((s, l) => {
      const m = String(l.size).match(/(\d+(?:\.\d+)?)\s*g/i);
      const km = String(l.size).match(/(\d+(?:\.\d+)?)\s*kg/i);
      return s + (m ? Number(m[1]) : km ? Number(km[1]) * 1000 : 0);
    }, 0);
    const totalBeansSpend = bagsWithSize.reduce((s, l) => s + Number(l.price || 0), 0);
    const actualCpg = totalGrams > 0 ? totalBeansSpend / totalGrams : 0;
    pricPerCup = actualCpg > 0 ? actualCpg * 15 : 0;
  }

  // Fill stat bar
  $('ins-total-h').textContent = fmt(total);
  $('ins-orders').textContent = orders.length;
  $('ins-beans-pct').textContent = total > 0 ? Math.round(bTotal / total * 100) + '%' : '0%';
  $('ins-cpg').textContent = cpg ? fmt(cpg) : 'â€”';
  $('ins-ppc').textContent = pricPerCup > 0 ? 'â‚¹' + pricPerCup.toFixed(1) : 'â€”';

  // Total kg of beans bought
  const totalKgBought = beans.reduce((s, l) => {
    const sz = String(l.size || '');
    const kg = sz.match(/(\\d+(?:\\.\\d+)?)\\s*kg/i);
    const g = sz.match(/(\\d+(?:\\.\\d+)?)\\s*g/i);
    return s + (kg ? Number(kg[1]) : g ? Number(g[1]) / 1000 : 0);
  }, 0);
  $('ins-total-kg').textContent = totalKgBought > 0 ? totalKgBought.toFixed(2) + ' kg' : '—';

  // Callouts
  const callouts = [];
  if (bTotal > gTotal + aTotal) callouts.push({ icon: 'â˜•', text: `You spend <strong>${Math.round(bTotal / total * 100)}%</strong> of your budget on beans â€” a true coffee purist.` });
  else callouts.push({ icon: 'âš™ï¸', text: `You've invested more in gear than beans so far. Once the setup's sorted, let the beans shine.` });
  if (topVendors[0]) callouts.push({ icon: 'ðŸ†', text: `<strong>${topVendors[0][0]}</strong> is your most-spent vendor at ${fmt(topVendors[0][1])}.` });
  if (cpg) callouts.push({ icon: 'ðŸ“Š', text: `Your average cost is <strong>${fmt(cpg)}/100g</strong> across bags with known sizes.` });
  if (pricPerCup > 0) callouts.push({ icon: 'â˜•', text: `Based on a standard 15g dose, each cup costs you roughly <strong>â‚¹${pricPerCup.toFixed(1)}</strong> in beans.` });
  $('insCallouts').innerHTML = callouts.map(c => `<div class="insight-callout"><span class="callout-icon">${c.icon}</span><div class="callout-text">${c.text}</div></div>`).join('');

  // Monthly
  const monthly = {}, monthlyB = {}, monthlyG = {}, monthlyA = {};
  logs.forEach(l => {
    const ym = (l.date || '').slice(0, 7); if (!ym) return;
    const p = Number(l.price || 0);
    monthly[ym] = (monthly[ym] || 0) + p;
    if (l.category === 'beans') monthlyB[ym] = (monthlyB[ym] || 0) + p;
    if (l.category === 'gears') monthlyG[ym] = (monthlyG[ym] || 0) + p;
    if (l.category === 'accessories') monthlyA[ym] = (monthlyA[ym] || 0) + p;
  });
  const sortedM = Object.keys(monthly).sort();
  const mlabels = sortedM.map(m => { const [y, mo] = m.split('-'); return new Date(+y, +mo - 1).toLocaleString('en-IN', { month: 'short', year: '2-digit' }); });

  const C = {
    cream: '#F5EFE0', caramel: '#C47D2A', mid: '#7A5C3A', blue: '#4A6FA5',
    green: '#5E8A3A', parchment: '#EDE4CE', light: '#D4B483', honey: '#E8A83E', purple: '#7A3A8A'
  };

  const isDark = document.body.classList.contains('dark-mode');
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : C.parchment;
  const textColor = isDark ? '#A68A64' : C.mid;

  // Bar chart (monthly total)
  if (barInst) barInst.destroy();
  barInst = new Chart($('barChart').getContext('2d'), {
    type: 'bar',
    data: {
      labels: mlabels, datasets: [{ label: 'Beans', data: sortedM.map(m => monthlyB[m] || 0), backgroundColor: C.caramel + 'AA', borderColor: C.caramel, borderWidth: 2, borderRadius: 6, stack: 's' },
      { label: 'Gears', data: sortedM.map(m => monthlyG[m] || 0), backgroundColor: C.mid + '99', borderColor: C.mid, borderWidth: 2, borderRadius: 0, stack: 's' },
      { label: 'Accessories', data: sortedM.map(m => monthlyA[m] || 0), backgroundColor: C.blue + '88', borderColor: C.blue, borderWidth: 2, borderRadius: 0, stack: 's' }]
    },
    options: {
      plugins: { legend: { labels: { color: textColor, font: { size: 11, family: 'DM Sans' } } } },
      scales: {
        x: { stacked: true, ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor } },
        y: { stacked: true, ticks: { color: textColor, font: { size: 10 }, callback: v => `â‚¹${v.toLocaleString('en-IN')}` }, grid: { color: gridColor } }
      }
    }
  });

  // Pie
  if (pieInst) pieInst.destroy();
  pieInst = new Chart($('pieChart').getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: ['Beans', 'Gears', 'Accessories'], datasets: [{
        data: [bTotal, gTotal, aTotal],
        backgroundColor: [C.caramel, C.mid, C.blue], borderColor: isDark ? '#1A1208' : C.cream, borderWidth: 3
      }]
    },
    options: { plugins: { legend: { labels: { color: textColor, font: { size: 11, family: 'DM Sans' } } } }, cutout: '60%' }
  });

  // Line over time â€” removed (chart canvas not in DOM)
  if (lineInst) { lineInst.destroy(); lineInst = null; }

  // Vendor bar list
  const maxV = topVendors[0]?.[1] || 1;
  $('vendorBarList').innerHTML = topVendors.slice(0, 8).map(([v, a]) =>
    `<div class="bar-row"><span class="bar-label">${esc(v)}</span><div class="bar-track"><div class="bar-fill" style="width:${(a / maxV * 100).toFixed(1)}%"></div></div><span class="bar-val">${fmt(a)}</span></div>`).join('');

  // Coffee type bar
  const typeTot = {};
  beans.forEach(l => { if (l.coffee_type) typeTot[l.coffee_type] = (typeTot[l.coffee_type] || 0) + Number(l.price || 0); });
  const typeE = Object.entries(typeTot).sort((a, b) => b[1] - a[1]);
  const maxT = typeE[0]?.[1] || 1;
  const tCls = ['', 'blue', 'green', 'purple'];
  $('typeBarList').innerHTML = typeE.length ? typeE.map(([k, a], i) =>
    `<div class="bar-row"><span class="bar-label">${TYPEMETA[k]?.label || k}</span><div class="bar-track"><div class="bar-fill ${tCls[i] || ''}" style="width:${(a / maxT * 100).toFixed(1)}%"></div></div><span class="bar-val">${fmt(a)}</span></div>`).join('')
    : '<p style="font-size:.78rem;color:var(--light);font-style:italic">Tag your beans with a type to see this.</p>';

  // Beans Ã— Brewer â€” built from journal entries
  // Map: beanLabel â†’ { brewer â†’ sessionCount }
  const beanBrewerMap = {};
  journal.forEach(j => {
    if (!j.brewer || !j.beanLabel) return;
    if (!beanBrewerMap[j.beanLabel]) beanBrewerMap[j.beanLabel] = {};
    beanBrewerMap[j.beanLabel][j.brewer] = (beanBrewerMap[j.beanLabel][j.brewer] || 0) + 1;
  });
  const beanBrewerEntries = Object.entries(beanBrewerMap)
    .sort((a, b) => Object.values(b[1]).reduce((s, v) => s + v, 0) - Object.values(a[1]).reduce((s, v) => s + v, 0));
  if (beanBrewerEntries.length) {
    const brewerColors = ['', 'blue', 'green', 'purple', 'mid'];
    $('brewBarList').innerHTML = beanBrewerEntries.map(([bean, brewers]) => {
      const total = Object.values(brewers).reduce((s, v) => s + v, 0);
      const brewerPills = Object.entries(brewers).sort((a, b) => b[1] - a[1])
        .map(([br, c]) => `<span class="epill brew" style="font-size:.62rem">â˜• ${esc(br)} Ã—${c}</span>`).join('');
      return `<div class="bar-row" style="flex-direction:column;align-items:flex-start;gap:.3rem;padding:.5rem 0;border-bottom:1px solid var(--parchment)">
        <div style="display:flex;justify-content:space-between;width:100%">
          <span class="bar-label" style="font-size:.78rem">${esc(bean)}</span>
          <span class="bar-val">${total} session${total !== 1 ? 's' : ''}</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:.3rem">${brewerPills}</div>
      </div>`;
    }).join('');
  } else {
    $('brewBarList').innerHTML = '<p style="font-size:.78rem;color:var(--light);font-style:italic">Log brew sessions in the Journal to see which beans pair with which brewer.</p>';
  }

  // Process breakdown
  const procTot = {};
  beans.forEach(l => { const p = detectProcess(l); const k = p ? p.label : 'Untagged'; procTot[k] = (procTot[k] || 0) + Number(l.price || 0); });
  const procE = Object.entries(procTot).sort((a, b) => b[1] - a[1]);
  const maxP = procE[0]?.[1] || 1;
  const pCls = ['', 'green', 'blue', 'purple', 'mid'];
  $('processBarList').innerHTML = procE.length ? procE.map(([k, a], i) =>
    `<div class="bar-row"><span class="bar-label">${esc(k)}</span><div class="bar-track"><div class="bar-fill ${pCls[i] || ''}" style="width:${(a / maxP * 100).toFixed(1)}%"></div></div><span class="bar-val">${fmt(a)}</span></div>`).join('')
    : '<p style="font-size:.78rem;color:var(--light);font-style:italic">Add process info to beans to see this.</p>';

  // â”€â”€ Money Saved section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  renderMoneySaved();
}

function renderMoneySaved() {
  const { rows, totalHomeCost, totalCafeCost, totalSaved } = calcMoneySaved();

  $('ins-saved-total').textContent = (totalSaved >= 0 ? 'â‚¹' : '-â‚¹') + Math.abs(totalSaved).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  $('ins-home-cost').textContent = fmt(totalHomeCost);
  $('ins-cafe-cost').textContent = fmt(totalCafeCost);

  // â”€â”€ Break-even panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  renderBreakEven(totalSaved);

  // Sort rows: tracked sessions first (date desc), then untracked bags
  const sorted = [...rows].sort((a, b) => {
    if (a.tracked !== b.tracked) return a.tracked ? -1 : 1;
    return new Date(b.date) - new Date(a.date);
  });

  if (!sorted.length) {
    $('ins-savings-breakdown').innerHTML = '<p style="font-size:.78rem;color:var(--light);font-style:italic">Log some beans or brew sessions to see savings.</p>';
    $('ins-savings-assumptions').textContent = '';
    return;
  }

  // Group tracked vs untracked
  const tracked = sorted.filter(r => r.tracked);
  const untracked = sorted.filter(r => !r.tracked);
  let html = '';

  if (tracked.length) {
    html += `<div style="font-size:.67rem;color:var(--mid);letter-spacing:.12em;text-transform:uppercase;font-weight:500;margin:.3rem 0 .5rem">ðŸ““ Tracked brew sessions (${tracked.length})</div>`;
    tracked.forEach(r => {
      const savedColor = r.saved >= 0 ? 'var(--green)' : '#c0392b';
      html += `<div class="savings-row">
            <div class="savings-row-label">
              ${esc(r.label)}
              <small>${fmtDate(r.date)} Â· ${r.note}</small>
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-family:'Playfair Display',serif;font-size:.88rem;color:${savedColor}">${r.saved >= 0 ? '+â‚¹' : '-â‚¹'}${Math.abs(r.saved).toFixed(0)}</div>
              <div style="font-size:.63rem;color:var(--light)">saved</div>
            </div>
          </div>`;
    });
  }

  if (untracked.length) {
    html += `<div style="font-size:.67rem;color:var(--mid);letter-spacing:.12em;text-transform:uppercase;font-weight:500;margin:.8rem 0 .5rem">ðŸ«™ Untracked bags â€” estimated (${untracked.length})</div>`;
    untracked.forEach(r => {
      const savedColor = r.saved >= 0 ? 'var(--green)' : '#c0392b';
      html += `<div class="savings-row">
            <div class="savings-row-label">
              ${esc(r.label)}
              <small>${fmtDate(r.date)} Â· ${r.note}</small>
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-family:'Playfair Display',serif;font-size:.88rem;color:${savedColor}">${r.saved >= 0 ? '+â‚¹' : '-â‚¹'}${Math.abs(r.saved).toFixed(0)}</div>
              <div style="font-size:.63rem;color:var(--light)">saved</div>
            </div>
          </div>`;
    });
  }

  $('ins-savings-breakdown').innerHTML = html;
  $('ins-savings-assumptions').innerHTML =
    `Assumptions: Espresso/Cafflano = â‚¹${MARKET_ESPRESSO}/cup Â· Moka Pot = â‚¹${MARKET_AMERICANO}/cup Â· All other methods = â‚¹${MARKET_STANDARD}/cup Â· ` +
    `Standard dose ${STD_DOSE_G}g/cup for untracked bags. ` +
    `Home cost uses actual bag price Ã· bag size. Negative savings means the brew cost more than cafÃ©.`;
}

function renderBreakEven(totalSaved) {
  // Gear investment = gears + accessories spend
  const gearInvestment = logs
    .filter(l => l.category === 'gears' || l.category === 'accessories')
    .reduce((s, l) => s + Number(l.price || 0), 0);

  const netPosition = totalSaved - gearInvestment; // positive = profit, negative = still in debt
  const achieved = netPosition >= 0;
  const pct = gearInvestment > 0 ? Math.min(100, (totalSaved / gearInvestment) * 100) : (totalSaved > 0 ? 100 : 0);
  const remaining = achieved ? 0 : gearInvestment - totalSaved;

  // Estimate break-even date from savings rate
  // Find date span from first log to today
  let etaHtml = '';
  if (!achieved && totalSaved > 0) {
    const allDates = logs.map(l => l.date).filter(Boolean).sort();
    if (allDates.length >= 2) {
      const firstDate = new Date(allDates[0] + 'T00:00:00');
      const today = new Date();
      const spanDays = Math.max(1, Math.floor((today - firstDate) / 86400000));
      const dailySavings = totalSaved / spanDays;
      if (dailySavings > 0) {
        const daysLeft = Math.ceil(remaining / dailySavings);
        const beDate = new Date();
        beDate.setDate(beDate.getDate() + daysLeft);
        const beDateStr = beDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        const months = Math.round(daysLeft / 30);
        etaHtml = `<span style="font-size:1.1rem">ðŸ—“ï¸</span>
              <span>At your current pace of <strong style="color:var(--caramel)">â‚¹${dailySavings.toFixed(0)}/day</strong> in savings,
              you'll break even in <strong style="color:var(--roast)">${months > 1 ? months + ' months' : daysLeft + ' days'}</strong>
              â€” around <strong>${beDateStr}</strong>.</span>`;
      }
    }
  } else if (achieved) {
    etaHtml = `<span style="font-size:1.1rem">ðŸ†</span>
          <span>You've <strong style="color:var(--green)">broken even!</strong> Every cup you brew now is pure profit over cafÃ© prices.
          You're <strong style="color:var(--green)">â‚¹${netPosition.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong> ahead.</span>`;
  } else if (gearInvestment === 0) {
    etaHtml = `<span>No gear or accessories logged yet. Add them to the log to track your investment.</span>`;
  } else {
    etaHtml = `<span>Log brew sessions to start calculating your savings rate.</span>`;
  }

  // Update DOM
  $('be-card').classList.toggle('achieved', achieved);
  $('be-badge').className = 'be-badge ' + (achieved ? 'achieved' : 'in-progress');
  $('be-badge').textContent = achieved ? 'âœ“ Broken Even!' : 'In Progress';
  $('be-fill').style.width = pct.toFixed(1) + '%';
  $('be-fill').className = 'be-fill' + (achieved ? ' done' : '');
  $('be-progress-pct').textContent = pct.toFixed(0) + '% recovered';
  $('be-progress-target').textContent = fmt(gearInvestment) + ' invested';
  $('be-gear-cost').textContent = fmt(gearInvestment);
  $('be-saved').textContent = fmt(totalSaved);
  $('be-remaining').textContent = achieved
    ? '+' + fmt(netPosition)
    : fmt(remaining);
  $('be-remaining').style.color = achieved ? 'var(--green)' : 'var(--caramel)';
  $('be-remaining-label').textContent = achieved ? 'In profit' : 'Still to recover';
  $('be-eta').innerHTML = etaHtml;
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   BOOTSTRAP
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   THEME SYSTEM
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function toggleTheme() {
  const isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  updateThemeUI();
  // Re-render insights if active to update chart colors
  if ($('page-insights').classList.contains('active')) renderInsights();
}

function applyTheme() {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (saved === 'dark' || (!saved && prefersDark)) {
    document.body.classList.add('dark-mode');
  }
  updateThemeUI();
}

function updateThemeUI() {
  const isDark = document.body.classList.contains('dark-mode');
  document.querySelectorAll('.theme-toggle').forEach(btn => {
    btn.innerHTML = isDark ? 'â˜€ï¸' : 'ðŸŒ™';
  });
}

function renderAll() { renderStats(); renderEntries(); }


/* ═══════════════════════════════════════════════════════════
   JOURNAL PAGINATION
═══════════════════════════════════════════════════════════ */
let jPage = 0;
const J_PER_PAGE = 10;

// Wrap existing renderJournal to add pagination
const _renderJournalOrig = renderJournal;
function renderJournal() {
  // Stats
  const total = journal.length;
  const rated = journal.filter(j => j.rating > 0);
  const avgR = rated.length ? (rated.reduce((s, j) => s + j.rating, 0) / rated.length).toFixed(1) : '—';
  const brCount = {};
  journal.forEach(j => { if (j.brewer) brCount[j.brewer] = (brCount[j.brewer] || 0) + 1; });
  const favBr = Object.entries(brCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
  if ($('jsTotal')) $('jsTotal').textContent = total;
  if ($('jsAvgRating')) $('jsAvgRating').textContent = avgR;
  if ($('jsFavMethod')) $('jsFavMethod').textContent = favBr.split(' ')[0];
  // Savings
  const { totalSaved } = calcMoneySaved();
  if ($('jsSaved')) $('jsSaved').textContent = (totalSaved >= 0 ? '₹' : '-₹') +
    Math.abs(totalSaved).toLocaleString('en-IN', { maximumFractionDigits: 0 });

  const sorted = [...journal].sort((a, b) => new Date(b.date) - new Date(a.date));
  const totalPages = Math.max(1, Math.ceil(sorted.length / J_PER_PAGE));
  jPage = Math.min(jPage, totalPages - 1);
  const slice = sorted.slice(jPage * J_PER_PAGE, (jPage + 1) * J_PER_PAGE);

  if (!slice.length) {
    if ($('journalList')) $('journalList').innerHTML = '<div class="empty-state"><div class="icon">📓</div><p>No brew sessions yet. Log your first cup!</p></div>';
    if ($('journalPagination')) $('journalPagination').innerHTML = '';
    return;
  }

  if ($('journalList')) {
    $('journalList').innerHTML = slice.map(j => {
      const stars = '★'.repeat(j.rating || 0) + '☆'.repeat(5 - (j.rating || 0));
      const tastes = (j.tastes || []).map(t => `<span class="taste-chip">${esc(t)}</span>`).join('');
      const meta = [];
      if (j.brewer) meta.push(`<span class="epill brew">☕ ${esc(j.brewer)}</span>`);
      if (j.dose) meta.push(`<span class="epill">${j.dose}g dose</span>`);
      if (j.yield) meta.push(`<span class="epill">${j.yield}g yield</span>`);
      if (j.time) meta.push(`<span class="epill">${j.time}s</span>`);
      if (j.temp) meta.push(`<span class="epill">${j.temp}°C</span>`);
      if (j.grinder) meta.push(`<span class="epill">⚙️ ${esc(j.grinder)}</span>`);
      if (j.grind) meta.push(`<span class="epill">📏 ${esc(j.grind)}</span>`);
      const beanName = j.beanId ? logs.find(l => l.id === parseInt(j.beanId))?.name || j.beanLabel || '' : j.beanLabel || '';
      return `<div class="journal-entry">
    <div class="je-header">
      <div>
        <div class="je-title">${beanName ? esc(beanName) : 'Brew Session'}</div>
        <div style="font-size:.72rem;color:var(--caramel);margin-top:.1rem">${stars}</div>
      </div>
      <div class="je-date">${fmtDate(j.date)}</div>
    </div>
    ${meta.length ? `<div class="je-meta">${meta.join('')}</div>` : ''}
    ${tastes ? `<div class="tasting-chips" style="margin-top:.4rem">${tastes}</div>` : ''}
    ${j.notes ? `<div class="je-notes">${esc(j.notes)}</div>` : ''}
    <div class="je-actions">
      <button class="action-btn" onclick="openJournalModal(${j.id})">Edit</button>
      <button class="action-btn del" onclick="deleteJournalEntry(${j.id})">✕</button>
    </div>
  </div>`;
    }).join('');
  }

  // Pagination controls
  const pagEl = $('journalPagination');
  if (pagEl) {
    if (totalPages > 1) {
      pagEl.innerHTML = `<div class="pag-bar">
        <button class="pag-btn" onclick="jPage=Math.max(0,jPage-1);renderJournal()" ${jPage === 0 ? 'disabled' : ''}>← Prev</button>
        <span class="pag-info">Page ${jPage + 1} of ${totalPages} · ${total} sessions</span>
        <button class="pag-btn" onclick="jPage=Math.min(${totalPages - 1},jPage+1);renderJournal()" ${jPage === totalPages - 1 ? 'disabled' : ''}>Next →</button>
      </div>`;
    } else {
      pagEl.innerHTML = `<div class="pag-info" style="text-align:center;padding:.5rem 0;font-size:.75rem;color:var(--mid)">${total} session${total !== 1 ? 's' : ''}</div>`;
    }
  }
}

/* ═══════════════════════════════════════════════════════════
   OWNER ACCESS & AUTH
═══════════════════════════════════════════════════════════ */
const CORRECT_PIN_HASH = 'f652f5c87c84f33899f9be3b2f62607ce5b61c68cac1f70bb4cdbb40d79b6904'; // PIN: 2811
const SESSION_KEY = 'brewlog_unlocked';
let isOwner = false;
let pinInput = '';

function applyAccessLevel() {
  if (isOwner) {
    document.body.classList.remove('visitor-mode');
  } else {
    document.body.classList.add('visitor-mode');
  }
  document.querySelectorAll('.owner-btn').forEach(btn => {
    btn.textContent = isOwner ? '🔓' : '🔐';
    btn.title = isOwner ? 'Owner mode – click to exit' : 'Owner Login';
  });
}

function toggleOwnerAccess() {
  if (isOwner) {
    isOwner = false;
    sessionStorage.removeItem(SESSION_KEY);
    applyAccessLevel();
  } else {
    showPinModal();
  }
}

function showPinModal() {
  pinInput = '';
  updateDots();
  document.getElementById('pin-overlay').classList.add('visible');
}
function hidePinModal() {
  document.getElementById('pin-overlay').classList.remove('visible');
}
function maybeHidePinModal(e) {
  if (e.target === document.getElementById('pin-overlay')) hidePinModal();
}

function updateDots(state) {
  for (let i = 0; i < 4; i++) {
    const d = document.getElementById('d' + i);
    if (!d) continue;
    d.className = 'pin-dot';
    if (state === 'ok') d.className = 'pin-dot filled ok';
    else if (state === 'error') d.className = 'pin-dot filled error';
    else if (i < pinInput.length) d.className = 'pin-dot filled';
  }
}

async function pinPress(digit) {
  if (pinInput.length >= 4) return;
  pinInput += digit;
  document.getElementById('pinErr').textContent = '';
  updateDots();
  if (pinInput.length === 4) await checkPin();
}
function pinDel() {
  pinInput = pinInput.slice(0, -1);
  document.getElementById('pinErr').textContent = '';
  updateDots();
}

async function sha256(msg) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function checkPin() {
  const hash = await sha256(pinInput);
  if (hash === CORRECT_PIN_HASH) {
    updateDots('ok');
    isOwner = true;
    sessionStorage.setItem(SESSION_KEY, 'owner');
    setTimeout(() => {
      const overlay = document.getElementById('pin-overlay');
      overlay.classList.add('unlocking');
      setTimeout(() => overlay.classList.remove('visible', 'unlocking'), 400);
      applyAccessLevel();
      // If on add page, reload to show the form
      if (document.body.dataset.page === 'add') window.location.reload();
    }, 350);
  } else {
    updateDots('error');
    document.getElementById('pinErr').textContent = 'Incorrect PIN. Try again.';
    setTimeout(() => { pinInput = ''; updateDots(); }, 800);
  }
}

document.addEventListener('keydown', e => {
  if (!document.getElementById('pin-overlay').classList.contains('visible')) return;
  if (e.key >= '0' && e.key <= '9') pinPress(e.key);
  else if (e.key === 'Backspace') pinDel();
  else if (e.key === 'Escape') hidePinModal();
});

/* ═══════════════════════════════════════════════════════════
   THEME
═══════════════════════════════════════════════════════════ */
function toggleTheme() {
  const isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  updateThemeUI();
  // Re-render insights charts on theme change (only if we're on the insights page)
  if (document.body.dataset.page === 'insights') renderInsights();
}
function applyTheme() {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (saved === 'dark' || (!saved && prefersDark)) document.body.classList.add('dark-mode');
  updateThemeUI();
}
function updateThemeUI() {
  const isDark = document.body.classList.contains('dark-mode');
  document.querySelectorAll('.theme-toggle').forEach(btn => {
    btn.innerHTML = isDark ? '☀️' : '🌙';
  });
}

/* ═══════════════════════════════════════════════════════════
   PAGE-AWARE BOOT
═══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  // Restore session
  if (sessionStorage.getItem(SESSION_KEY) === 'owner') isOwner = true;

  applyTheme();
  applyAccessLevel();

  const page = document.body.dataset.page || 'insights';

  // Add-page: guard non-owners before even loading data
  if (page === 'add' && !isOwner) {
    const main = document.getElementById('add-main');
    if (main) main.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:55vh;text-align:center;padding:2rem">
      <div style="font-size:3rem;margin-bottom:1rem">🔐</div>
      <div style="font-family:'Playfair Display',serif;font-size:1.4rem;color:var(--roast);margin-bottom:.5rem">Owner access required</div>
      <div style="font-size:.8rem;color:var(--mid);margin-bottom:1.5rem">Log in to add or edit orders.</div>
      <button class="btn-primary" onclick="showPinModal()">🔐 Log In</button>
    </div>`;
    return; // skip data load
  }

  // Add-page pre-setup
  if (page === 'add') {
    if ($('inp-date')) $('inp-date').valueAsDate = new Date();
    if ($('itemsList')) addItemRow();
  }

  await loadData();

  switch (page) {
    case 'insights': renderInsights(); break;
    case 'log': renderAll(); break;
    case 'shelf': renderShelf(); break;
    case 'process': renderProcess(); break;
    case 'journal': renderJournal(); break;
    case 'add': {
      const editId = new URLSearchParams(window.location.search).get('edit');
      if (editId) {
        // pre-fill form for editing
        const entry = logs.find(l => l.id === parseInt(editId));
        if (entry) {
          editingId = parseInt(editId);
          if ($('addPageTitle')) $('addPageTitle').innerHTML = 'Edit <em>Entry</em>';
          if ($('editBanner')) { $('editBanner').textContent = `Editing "${entry.name}". Update and save.`; $('editBanner').classList.add('active'); }
          if ($('inp-date')) $('inp-date').value = entry.date;
          if ($('inp-order')) $('inp-order').value = entry.order_id || '';
          if ($('inp-vendor')) $('inp-vendor').value = entry.vendor;
          const isCombo = entry.is_combo === 1;
          if ($('inp-combo')) { $('inp-combo').checked = isCombo; }
          if ($('inp-combo-price')) $('inp-combo-price').value = entry.combo_price || '';
          if ($('comboPriceWrap')) $('comboPriceWrap').classList.toggle('active', isCombo);
          if ($('itemsList')) { $('itemsList').innerHTML = ''; itemCount = 0; addItemRow(entry); }
        }
      }
      break;
    }
  }
});
