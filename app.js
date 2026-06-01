'use strict';

const EQUIPMENT_TYPES = {
  'SD Card':       { prefix: 'SD', color: '#3b82f6', icon: '&#128190;', count: 46 },
  'Gimbal Rig':    { prefix: 'GR', color: '#8b5cf6', icon: '&#127909;', count: 2  },
  'Mini Gimbal':    { prefix: 'MG', color: '#8b5cf6', icon: '&#127909;', count: 2  },
  'Tripod Setup':  { prefix: 'TS', color: '#f59e0b', icon: '&#128247;', count: 2  },
  'Neewer Microphone':{ prefix: 'NM', color: '#10b981', icon: '&#127908;', count: 2  },
  'Rode Microphone':{ prefix: 'RM', color: '#10b981', icon: '&#127908;', count: 2  },
  'DJI Microphone':{ prefix: 'DM', color: '#10b981', icon: '&#127908;', count: 1  },
};

// ── Data ────────────────────────────────────────────────────────────────────

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

// ── Formatting ───────────────────────────────────────────────────────────────

function relativeTime(ts) {
  if (!ts) return '';
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fullTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString();
}

// ── Render ───────────────────────────────────────────────────────────────────

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

  // Remove old cards, keep empty-state node
  grid.querySelectorAll('.checked-out-card').forEach(n => n.remove());

  if (!items.length) {
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';

  items.forEach(item => {
    const cfg  = EQUIPMENT_TYPES[item.type];
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
          <div class="card-time" title="${fullTime(item.checkedOutAt)}">${relativeTime(item.checkedOutAt)}</div>
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
  const all       = equipment.filter(e => e.status === 'available');
  const filtered  = currentFilter === 'all' ? all : all.filter(e => e.type === currentFilter);
  const grid      = document.getElementById('availableGrid');
  const badge     = document.getElementById('availableCount');

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
    const cfg  = EQUIPMENT_TYPES[item.type];
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

function esc(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Actions ──────────────────────────────────────────────────────────────────

function openModal(id) {
  const item = byId(id);
  if (!item || item.status !== 'available') return;

  pendingCheckoutId = id;
  const cfg = EQUIPMENT_TYPES[item.type];

  document.getElementById('modalTitle').textContent = `Check Out ${item.type}`;
  document.getElementById('modalEquipment').innerHTML = `
    <span class="eq-icon">${cfg.icon}</span>
    <div>
      <strong>${item.id}</strong><br>
      <span style="color:var(--text-secondary);font-size:13px">${item.label}</span>
    </div>
  `;
  document.getElementById('nameInput').value = '';
  document.getElementById('locationInput').value = '';
  document.getElementById('nameInput').classList.remove('error');
  document.getElementById('locationInput').classList.remove('error');
  document.getElementById('modalOverlay').classList.add('active');
  document.getElementById('nameInput').focus();
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
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
    save();
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
    item.status = 'available';
    item.checkedOutBy = null;
    item.location = null;
    item.checkedOutAt = null;
    save();
    renderAll();
  }
}

// ── Event Wiring ─────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  load();
  renderAll();

  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentFilter = btn.dataset.filter;
      document.querySelectorAll('.filter-btn').forEach(b =>
        b.classList.toggle('active', b === btn)
      );
      renderAvailable();
    });
  });

  // Available card click (delegated)
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

  // Check In button (delegated)
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

  // Keyboard shortcuts in modal
  document.getElementById('nameInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('locationInput').focus();
    document.getElementById('nameInput').classList.remove('error');
  });

  document.getElementById('locationInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') confirmCheckout();
    document.getElementById('locationInput').classList.remove('error');
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });

  // Refresh relative times every minute
  setInterval(() => {
    document.querySelectorAll('.card-time').forEach(el => {
      const card = el.closest('.checked-out-card');
      if (!card) return;
      const item = byId(card.dataset.id);
      if (item) {
        el.textContent = relativeTime(item.checkedOutAt);
        el.title = fullTime(item.checkedOutAt);
      }
    });
  }, 60000);
});
