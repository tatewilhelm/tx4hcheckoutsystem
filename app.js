'use strict';

const EQUIPMENT_TYPES = {
  'Gimbal Rig':        { prefix: 'GR', color: '#8b5cf6', icon: '&#127909;', count: 2  },
  'Mini Gimbal':       { prefix: 'MG', color: '#8b5cf6', icon: '&#127909;', count: 2  },
  'Tripod Setup':      { prefix: 'TS', color: '#f59e0b', icon: '&#128247;', count: 2  },
  'Neewer Microphone': { prefix: 'NM', color: '#10b981', icon: '&#127908;', count: 2  },
  'Rode Microphone':   { prefix: 'RM', color: '#10b981', icon: '&#127908;', count: 2  },
  'DJI Microphone':    { prefix: 'DM', color: '#10b981', icon: '&#127908;', count: 1  },
    'SD Card':           { prefix: 'SD', color: '#3b82f6', icon: '&#128190;', count: 46 },

};

// ── Equipment Data ────────────────────────────────────────────────────────────

function buildDefaultEquipment() {
  const list = [];
  for (const [type, cfg] of Object.entries(EQUIPMENT_TYPES)) {
    for (let i = 1; i <= cfg.count; i++) {
      const num = String(i).padStart(2, '0');
      list.push({
        id: `${cfg.prefix}-${num}`,
        type,
        label: `${type} ${num}`,
        status: 'available',
        checkedOutBy: null,
        location: null,
        checkedOutAt: null,
      });
    }
  }
  return list;
}

let equipment = [];
let currentFilter = 'all';
let pendingCheckoutId = null;
let logExpanded = false;

function load() {
  try {
    const raw = localStorage.getItem('checkoutSystem_v2');
    equipment = raw ? JSON.parse(raw) : buildDefaultEquipment();
  } catch {
    equipment = buildDefaultEquipment();
  }
}

function save() {
  localStorage.setItem('checkoutSystem_v2', JSON.stringify(equipment));
}

function byId(id) {
  return equipment.find(e => e.id === id);
}

// ── Autocomplete ──────────────────────────────────────────────────────────────

const ac = { names: [], locations: [], selectedIdx: -1 };

function acLoad() {
  try {
    ac.names     = JSON.parse(localStorage.getItem('ck_names')     || '[]');
    ac.locations = JSON.parse(localStorage.getItem('ck_locations') || '[]');
  } catch {
    ac.names = [];
    ac.locations = [];
  }
}

function acRecord(name, location) {
  if (name) {
    ac.names = [name, ...ac.names.filter(n => n !== name)].slice(0, 20);
    localStorage.setItem('ck_names', JSON.stringify(ac.names));
  }
  if (location) {
    ac.locations = [location, ...ac.locations.filter(l => l !== location)].slice(0, 20);
    localStorage.setItem('ck_locations', JSON.stringify(ac.locations));
  }
}

function acShow(inputEl, dropdownEl, list) {
  ac.selectedIdx = -1;
  const q = inputEl.value.trim().toLowerCase();
  const matches = (q ? list.filter(v => v.toLowerCase().includes(q)) : list).slice(0, 8);

  if (!matches.length) { acHide(dropdownEl); return; }

  dropdownEl.innerHTML = '';
  matches.forEach(val => {
    const item = document.createElement('div');
    item.className = 'ac-item';
    if (q) {
      const i = val.toLowerCase().indexOf(q);
      item.innerHTML = esc(val.slice(0, i))
        + `<mark>${esc(val.slice(i, i + q.length))}</mark>`
        + esc(val.slice(i + q.length));
    } else {
      item.textContent = val;
    }
    item.addEventListener('mousedown', e => {
      e.preventDefault();
      inputEl.value = val;
      inputEl.classList.remove('error');
      acHide(dropdownEl);
      if (inputEl.id === 'nameInput') {
        const loc = document.getElementById('locationInput');
        loc.focus();
        acShow(loc, document.getElementById('locationDropdown'), ac.locations);
      }
    });
    dropdownEl.appendChild(item);
  });
  dropdownEl.style.display = 'block';
}

function acHide(dropdownEl) {
  if (dropdownEl) dropdownEl.style.display = 'none';
  ac.selectedIdx = -1;
}

function acKeyNav(e, inputEl, dropdownEl) {
  if (dropdownEl.style.display === 'none') return false;
  const items = dropdownEl.querySelectorAll('.ac-item');
  if (!items.length) return false;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    ac.selectedIdx = Math.min(ac.selectedIdx + 1, items.length - 1);
    items.forEach((el, i) => el.classList.toggle('ac-selected', i === ac.selectedIdx));
    inputEl.value = items[ac.selectedIdx].textContent;
    inputEl.classList.remove('error');
    return true;
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    ac.selectedIdx = Math.max(ac.selectedIdx - 1, 0);
    items.forEach((el, i) => el.classList.toggle('ac-selected', i === ac.selectedIdx));
    inputEl.value = items[ac.selectedIdx].textContent;
    inputEl.classList.remove('error');
    return true;
  }
  if (e.key === 'Enter' && ac.selectedIdx >= 0) {
    e.preventDefault();
    inputEl.value = items[ac.selectedIdx].textContent;
    inputEl.classList.remove('error');
    acHide(dropdownEl);
    if (inputEl.id === 'nameInput') {
      const loc = document.getElementById('locationInput');
      loc.focus();
      acShow(loc, document.getElementById('locationDropdown'), ac.locations);
    }
    return true;
  }
  return false;
}

// ── Activity Log ──────────────────────────────────────────────────────────────

const MAX_LOG = 300;
let activityLog = [];

function logLoad() {
  try {
    activityLog = JSON.parse(localStorage.getItem('ck_log') || '[]');
  } catch { activityLog = []; }
}

function logSave() {
  localStorage.setItem('ck_log', JSON.stringify(activityLog));
}

function logAdd(action, item) {
  activityLog.unshift({
    action,
    id:       item.id,
    label:    item.label,
    type:     item.type,
    person:   item.checkedOutBy,
    location: item.location,
    ts:       Date.now(),
  });
  if (activityLog.length > MAX_LOG) activityLog.length = MAX_LOG;
  logSave();
  document.getElementById('logCount').textContent = activityLog.length;
  if (logExpanded) renderLog();
}

function logClear() {
  if (!confirm('Clear all activity log entries?')) return;
  activityLog = [];
  logSave();
  document.getElementById('logCount').textContent = 0;
  if (logExpanded) renderLog();
}

function renderLog() {
  const list = document.getElementById('logList');
  if (!activityLog.length) {
    list.innerHTML = '<div class="log-empty">No activity recorded yet</div>';
    return;
  }
  list.innerHTML = activityLog.map(entry => {
    const cfg = EQUIPMENT_TYPES[entry.type] || { icon: '&#128230;' };
    const d = new Date(entry.ts);
    const timeStr = d.toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
    const isOut = entry.action === 'out';
    return `
      <div class="log-entry">
        <span class="log-action ${isOut ? 'log-action-out' : 'log-action-in'}">${isOut ? 'OUT' : 'IN'}</span>
        <span class="log-eq-icon">${cfg.icon}</span>
        <span class="log-id">${esc(entry.id)}</span>
        <span class="log-person">${esc(entry.person || '—')}</span>
        <span class="log-location">${esc(entry.location || '—')}</span>
        <span class="log-time" title="${d.toLocaleString()}">${timeStr}</span>
      </div>`;
  }).join('');
}

// ── Timer ─────────────────────────────────────────────────────────────────────

function formatDuration(ts) {
  if (!ts) return '—';
  const total = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600) % 24;
  const d = Math.floor(total / 86400);
  if (d > 0) return `${d}d ${h}h ${String(m).padStart(2, '0')}m`;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderAll() {
  renderHeader();
  renderCheckedOut();
  renderAvailable();
}

function renderHeader() {
  const total = equipment.length;
  const out = equipment.filter(e => e.status === 'checked_out').length;
  document.getElementById('headerStats').innerHTML = `
    <div class="stat">
      <span class="stat-value">${total}</span>
      <span class="stat-label">Total</span>
    </div>
    <div class="stat">
      <span class="stat-value stat-out">${out}</span>
      <span class="stat-label">Out</span>
    </div>
    <div class="stat">
      <span class="stat-value stat-available">${total - out}</span>
      <span class="stat-label">Available</span>
    </div>
  `;
}

function renderCheckedOut() {
  const items = equipment.filter(e => e.status === 'checked_out');
  const grid  = document.getElementById('checkedOutGrid');
  const badge = document.getElementById('checkedOutCount');
  const empty = document.getElementById('checkedOutEmpty');

  badge.textContent = items.length;
  badge.style.display = items.length ? 'inline' : 'none';

  grid.querySelectorAll('.checked-out-card').forEach(n => n.remove());

  if (!items.length) {
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';

  items.forEach(item => {
    const cfg  = EQUIPMENT_TYPES[item.type] || { color: '#6b7280', icon: '&#128230;' };
    const card = document.createElement('div');
    card.className = 'checked-out-card';
    card.style.setProperty('--type-color', cfg.color);
    card.dataset.id = item.id;
    card.innerHTML = `
      <div class="card-content">
        <div class="card-top">
          <span class="card-icon">${cfg.icon}</span>
          <div class="card-info">
            <div class="card-id">${item.id}</div>
            <div class="card-label">${item.label}</div>
          </div>
          <div class="card-timer">
            <span class="timer-dot"></span>
            <span class="timer-value" data-ts="${item.checkedOutAt}">${formatDuration(item.checkedOutAt)}</span>
          </div>
        </div>
        <div class="card-details">
          <div class="detail-row">
            <span class="detail-label">Person</span>
            <span class="detail-value" title="${esc(item.checkedOutBy)}">${esc(item.checkedOutBy)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Location</span>
            <span class="detail-value" title="${esc(item.location)}">${esc(item.location)}</span>
          </div>
        </div>
        <button class="checkin-btn" data-id="${item.id}">&#10003; Check In</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

function renderAvailable() {
  const all      = equipment.filter(e => e.status === 'available');
  const filtered = currentFilter === 'all' ? all : all.filter(e => e.type === currentFilter);
  const grid     = document.getElementById('availableGrid');
  const badge    = document.getElementById('availableCount');

  badge.textContent = all.length;
  grid.innerHTML = '';

  if (!filtered.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">&#128230;</div>
        <p>${currentFilter === 'all' ? 'All equipment is checked out' : 'No available items in this category'}</p>
      </div>`;
    return;
  }

  filtered.forEach(item => {
    const cfg  = EQUIPMENT_TYPES[item.type] || { color: '#6b7280', icon: '&#128230;' };
    const card = document.createElement('div');
    card.className = 'available-card';
    card.style.setProperty('--type-color', cfg.color);
    card.dataset.id = item.id;
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Check out ${item.label}`);
    card.innerHTML = `
      <span class="avail-icon">${cfg.icon}</span>
      <div class="avail-id">${item.id}</div>
      <div class="avail-type">${item.type}</div>
      <div class="avail-status-pill">Available</div>
    `;
    grid.appendChild(card);
  });
}

function renderFilterButtons() {
  const bar = document.getElementById('filterBar');
  bar.innerHTML = '';

  const allBtn = document.createElement('button');
  allBtn.className = 'filter-btn active';
  allBtn.dataset.filter = 'all';
  allBtn.textContent = 'All Equipment';
  bar.appendChild(allBtn);

  for (const type of Object.keys(EQUIPMENT_TYPES)) {
    const btn = document.createElement('button');
    btn.className = 'filter-btn';
    btn.dataset.filter = type;
    btn.textContent = type + 's';
    bar.appendChild(btn);
  }

  bar.addEventListener('click', e => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    currentFilter = btn.dataset.filter;
    bar.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b === btn));
    renderAvailable();
  });
}

function esc(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Actions ───────────────────────────────────────────────────────────────────

function openModal(id) {
  const item = byId(id);
  if (!item || item.status !== 'available') return;

  pendingCheckoutId = id;
  const cfg = EQUIPMENT_TYPES[item.type] || { icon: '&#128230;' };

  document.getElementById('modalTitle').textContent = `Check Out ${item.type}`;
  document.getElementById('modalEquipment').innerHTML = `
    <span class="eq-icon">${cfg.icon}</span>
    <div>
      <strong>${item.id}</strong><br>
      <span style="color:var(--text-secondary);font-size:13px">${item.label}</span>
    </div>
  `;
  const nameInput = document.getElementById('nameInput');
  const locationInput = document.getElementById('locationInput');
  nameInput.value = '';
  locationInput.value = '';
  nameInput.classList.remove('error');
  locationInput.classList.remove('error');
  acHide(document.getElementById('nameDropdown'));
  acHide(document.getElementById('locationDropdown'));
  document.getElementById('modalOverlay').classList.add('active');
  nameInput.focus();
  acShow(nameInput, document.getElementById('nameDropdown'), ac.names);
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
  acHide(document.getElementById('nameDropdown'));
  acHide(document.getElementById('locationDropdown'));
  pendingCheckoutId = null;
}

function confirmCheckout() {
  const name     = document.getElementById('nameInput').value.trim();
  const location = document.getElementById('locationInput').value.trim();

  let valid = true;
  if (!name) {
    document.getElementById('nameInput').classList.add('error');
    document.getElementById('nameInput').focus();
    valid = false;
  }
  if (!location) {
    document.getElementById('locationInput').classList.add('error');
    if (valid) document.getElementById('locationInput').focus();
    valid = false;
  }
  if (!valid) return;

  const item = byId(pendingCheckoutId);
  if (item) {
    item.status = 'checked_out';
    item.checkedOutBy = name;
    item.location = location;
    item.checkedOutAt = Date.now();
    acRecord(name, location);
    save();
    logAdd('out', item);
    renderAll();
  }
  closeModal();
}

function checkIn(id) {
  const card = document.querySelector(`.checked-out-card[data-id="${id}"]`);
  if (card) {
    card.classList.add('checking-in');
    setTimeout(() => doCheckIn(id), 280);
  } else {
    doCheckIn(id);
  }
}

function doCheckIn(id) {
  const item = byId(id);
  if (item) {
    const snapshot = { ...item };
    item.status = 'available';
    item.checkedOutBy = null;
    item.location = null;
    item.checkedOutAt = null;
    save();
    logAdd('in', snapshot);
    renderAll();
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  load();
  acLoad();
  logLoad();

  renderFilterButtons();
  renderAll();
  document.getElementById('logCount').textContent = activityLog.length;

  // Available card click
  document.getElementById('availableGrid').addEventListener('click', e => {
    const card = e.target.closest('.available-card');
    if (card) openModal(card.dataset.id);
  });
  document.getElementById('availableGrid').addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      const card = e.target.closest('.available-card');
      if (card) { e.preventDefault(); openModal(card.dataset.id); }
    }
  });

  // Check In button
  document.getElementById('checkedOutGrid').addEventListener('click', e => {
    const btn = e.target.closest('.checkin-btn');
    if (btn) checkIn(btn.dataset.id);
  });

  // Modal controls
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('confirmBtn').addEventListener('click', confirmCheckout);
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modalOverlay')) closeModal();
  });

  // Name autocomplete
  const nameInput     = document.getElementById('nameInput');
  const nameDropdown  = document.getElementById('nameDropdown');
  nameInput.addEventListener('input', () => {
    nameInput.classList.remove('error');
    acShow(nameInput, nameDropdown, ac.names);
  });
  nameInput.addEventListener('focus', () => acShow(nameInput, nameDropdown, ac.names));
  nameInput.addEventListener('blur',  () => setTimeout(() => acHide(nameDropdown), 150));
  nameInput.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (nameDropdown.style.display === 'block') { e.stopPropagation(); acHide(nameDropdown); return; }
      closeModal(); return;
    }
    const handled = acKeyNav(e, nameInput, nameDropdown);
    if (!handled && e.key === 'Enter') document.getElementById('locationInput').focus();
  });

  // Location autocomplete
  const locationInput    = document.getElementById('locationInput');
  const locationDropdown = document.getElementById('locationDropdown');
  locationInput.addEventListener('input', () => {
    locationInput.classList.remove('error');
    acShow(locationInput, locationDropdown, ac.locations);
  });
  locationInput.addEventListener('focus', () => acShow(locationInput, locationDropdown, ac.locations));
  locationInput.addEventListener('blur',  () => setTimeout(() => acHide(locationDropdown), 150));
  locationInput.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (locationDropdown.style.display === 'block') { e.stopPropagation(); acHide(locationDropdown); return; }
      closeModal(); return;
    }
    const handled = acKeyNav(e, locationInput, locationDropdown);
    if (!handled && e.key === 'Enter') confirmCheckout();
  });

  // Global Escape → close modal
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.getElementById('modalOverlay').classList.contains('active')) {
      closeModal();
    }
  });

  // Log toggle
  document.getElementById('logToggle').addEventListener('click', () => {
    logExpanded = !logExpanded;
    const list = document.getElementById('logList');
    const btn  = document.getElementById('logToggle');
    if (logExpanded) {
      list.style.display = 'block';
      btn.textContent = 'Hide Log';
      renderLog();
    } else {
      list.style.display = 'none';
      btn.textContent = 'Show Log';
    }
  });
  document.getElementById('logClear').addEventListener('click', logClear);

  // Live timer — tick every second
  setInterval(() => {
    document.querySelectorAll('.timer-value[data-ts]').forEach(el => {
      const ts = parseInt(el.dataset.ts, 10);
      if (!isNaN(ts)) el.textContent = formatDuration(ts);
    });
  }, 1000);
});
