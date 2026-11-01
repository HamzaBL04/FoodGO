import { api, esc, tnd, time, toast, showError, requireSession, mountTopbar, onLiveEvents, tabs, STATUS_STEPS, paymentChip } from './api.js';

const session = await requireSession('STAFF');
mountTopbar(session);
const R = `/restaurants/${encodeURIComponent(session.restaurantId)}`;
const $ = (s) => document.querySelector(s);
let current = 'orders';
let team = [];

const loaders = {
  orders: loadBoard,
  menu: loadMenu,
  customers: loadCustomers,
  team: loadTeam,
  settings: loadSettings,
};
const select = tabs((name) => {
  current = name;
  loaders[name]();
});

const formData = (form) => Object.fromEntries(new FormData(form));

// ---------- order board (FR-15, FR-16, FR-19) ----------
async function loadBoard(flashId) {
  try {
    const [{ orders }, people] = await Promise.all([api(`${R}/orders`), api(`${R}/delivery-personnel`)]);
    team = people.deliveryPersonnel.filter((p) => p.status === 'ACTIVE');
    const total = orders.reduce((s, o) => s + o.total, 0);
    $('#board-summary').textContent = `${orders.length} order${orders.length === 1 ? '' : 's'} for today, ${tnd(total)}`;
    $('#board').innerHTML = STATUS_STEPS.map(([status, label]) => {
      const list = orders.filter((o) => o.status === status);
      return `<div class="column"><h3>${esc(label)} <span class="chip">${list.length}</span></h3>${list.map((o) => ticket(o, flashId)).join('') || '<p class="muted" style="padding:0 .35rem">Nothing here</p>'}</div>`;
    }).join('');
    wireTickets();
  } catch (err) {
    showError(err);
  }
}

function ticket(o, flashId) {
  const actions = [];
  if (o.allowedNext.includes('IN_PREPARATION')) actions.push(`<button class="small" data-prepare="${esc(o.orderId)}">Start preparing</button>`);
  if (o.allowedNext.includes('ASSIGNED')) {
    actions.push(`<select data-courier-for="${esc(o.orderId)}" aria-label="Delivery person for ${esc(o.orderId)}">${team.map((p) => `<option value="${esc(p.deliveryPersonId)}">${esc(p.fullName)}</option>`).join('')}</select>`);
    actions.push(`<button class="small" data-assign="${esc(o.orderId)}" ${team.length ? '' : 'disabled'}>Assign</button>`);
  }
  return `<article class="ticket ${o.orderId === flashId ? 'flash' : ''}">
    <div class="order-id">${esc(o.orderId)}</div>
    <div><strong>${esc(o.customer.fullName)}</strong>, ${esc(o.customer.organizationName)}</div>
    <div class="muted">${esc(o.customer.phoneNumber)}, ordered ${time(o.createdAt)}</div>
    <ul>${o.items.map((i) => `<li>${i.quantity} × ${esc(i.name)}</li>`).join('')}</ul>
    <div><strong>${tnd(o.total)}</strong> ${paymentChip(o.paymentMethod, o.paymentStatus)}</div>
    ${o.delivery ? `<div class="muted">With ${esc(o.delivery.deliveryPersonName)}</div>` : ''}
    ${actions.length ? `<div class="actions">${actions.join('')}</div>` : ''}
  </article>`;
}

function wireTickets() {
  for (const b of document.querySelectorAll('[data-prepare]')) {
    b.addEventListener('click', () => act(`${R}/orders/${b.dataset.prepare}/start-preparation`, {}, `Order ${b.dataset.prepare} is being prepared`));
  }
  for (const b of document.querySelectorAll('[data-assign]')) {
    b.addEventListener('click', () => {
      const deliveryPersonId = document.querySelector(`[data-courier-for="${b.dataset.assign}"]`).value;
      act(`${R}/orders/${b.dataset.assign}/assign`, { deliveryPersonId }, `Order ${b.dataset.assign} assigned`);
    });
  }
}

async function act(path, body, message) {
  try {
    await api(path, { method: 'POST', body });
    toast(message);
    loadBoard();
  } catch (err) {
    showError(err);
  }
}

// ---------- menu (FR-07, FR-08) ----------
async function loadMenu() {
  try {
    const { items } = await api(`${R}/menu`);
    $('#menu-table').innerHTML = `<tr><th>Dish</th><th class="num">Price</th><th>Available</th><th></th></tr>` + items.map((i) => `
      <tr>
        <td><strong>${esc(i.name)}</strong><br><span class="muted">${esc(i.description)}</span></td>
        <td class="num"><input type="number" step="0.001" min="0.1" value="${i.price}" data-price="${esc(i.menuItemId)}" aria-label="Price of ${esc(i.name)}" style="width:6.5rem;margin:0 0 0 auto"></td>
        <td><label class="switch"><input type="checkbox" data-avail="${esc(i.menuItemId)}" ${i.available ? 'checked' : ''} aria-label="${esc(i.name)} available"><span></span></label></td>
        <td><button class="danger small" data-remove="${esc(i.menuItemId)}">Remove</button></td>
      </tr>`).join('');
    for (const el of document.querySelectorAll('[data-avail]')) {
      el.addEventListener('change', () => patchItem(el.dataset.avail, { available: el.checked }, el.checked ? 'Back on the menu' : 'Marked unavailable'));
    }
    for (const el of document.querySelectorAll('[data-price]')) {
      el.addEventListener('change', () => patchItem(el.dataset.price, { price: Number(el.value) }, 'Price updated'));
    }
    for (const el of document.querySelectorAll('[data-remove]')) {
      el.addEventListener('click', async () => {
        try {
          await api(`${R}/menu/items/${el.dataset.remove}`, { method: 'DELETE' });
          toast('Dish removed from the menu');
          loadMenu();
        } catch (err) { showError(err); }
      });
    }
  } catch (err) {
    showError(err);
  }
}

async function patchItem(id, body, message) {
  try {
    await api(`${R}/menu/items/${id}`, { method: 'PATCH', body });
    toast(message);
  } catch (err) {
    showError(err);
    loadMenu();
  }
}

$('#add-item').addEventListener('submit', async (e) => {
  e.preventDefault();
  const d = formData(e.target);
  try {
    await api(`${R}/menu/items`, { method: 'POST', body: { name: d.name, description: d.description, price: Number(d.price) } });
    e.target.reset();
    toast(`${d.name} added to the menu`);
    loadMenu();
  } catch (err) { showError(err); }
});

// ---------- customers (FR-01–FR-04, FR-16, FR-17) ----------
async function loadCustomers() {
  try {
    const [{ customers }, { organizations }] = await Promise.all([api(`${R}/customers`), api('/organizations')]);
    $('#org-select').innerHTML = organizations.map((o) => `<option value="${esc(o.organizationId)}">${esc(o.name)}</option>`).join('');
    $('#customer-table').innerHTML = `<tr><th>Customer</th><th>Organization</th><th>Eligible</th></tr>` + customers.map((c) => `
      <tr>
        <td><strong>${esc(c.fullName)}</strong><br><span class="muted">${esc(c.phoneNumber)}</span></td>
        <td>${esc(c.organizationName)}</td>
        <td><label class="switch"><input type="checkbox" data-eligible="${esc(c.customerId)}" ${c.eligible ? 'checked' : ''} aria-label="${esc(c.fullName)} eligible"><span></span></label></td>
      </tr>`).join('');
    for (const el of document.querySelectorAll('[data-eligible]')) {
      el.addEventListener('change', async () => {
        try {
          await api(`${R}/customers/${el.dataset.eligible}`, { method: 'PATCH', body: { eligible: el.checked } });
          toast(el.checked ? 'Customer can order again' : 'Customer can no longer order');
        } catch (err) { showError(err); }
      });
    }
  } catch (err) {
    showError(err);
  }
}

$('#register').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  try {
    const { customer } = await api(`${R}/customers`, {
      method: 'POST',
      body: {
        fullName: f.fullName.value,
        phoneNumber: f.phoneNumber.value.replace(/[\s.-]/g, ''),
        organizationId: f.organizationId.value,
        eligible: f.eligible.checked,
        identityVerified: f.identityVerified.checked,
      },
    });
    f.reset();
    toast(`${customer.fullName} registered. They received an SMS to sign in.`);
    loadCustomers();
  } catch (err) { showError(err); }
});

$('#add-org').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/organizations', { method: 'POST', body: formData(e.target) });
    e.target.reset();
    toast('Organization added');
    loadCustomers();
  } catch (err) { showError(err); }
});

// ---------- delivery team (FR-18, FR-30) ----------
async function loadTeam() {
  try {
    const { deliveryPersonnel } = await api(`${R}/delivery-personnel`);
    $('#team-table').innerHTML = `<tr><th>Name</th><th>Username</th><th>Phone</th><th>Status</th></tr>` + deliveryPersonnel.map((p) => `
      <tr><td><strong>${esc(p.fullName)}</strong></td><td>${esc(p.identity)}</td><td>${esc(p.phoneNumber || '')}</td><td><span class="chip ok">${esc(p.status.toLowerCase())}</span></td></tr>`).join('');
  } catch (err) {
    showError(err);
  }
}

$('#add-courier').addEventListener('submit', async (e) => {
  e.preventDefault();
  const d = formData(e.target);
  if (!d.phoneNumber) delete d.phoneNumber;
  else d.phoneNumber = d.phoneNumber.replace(/[\s.-]/g, '');
  try {
    await api(`${R}/delivery-personnel`, { method: 'POST', body: d });
    e.target.reset();
    toast(`Account created for ${d.fullName}`);
    loadTeam();
  } catch (err) { showError(err); }
});

// ---------- settings (FR-12, FR-13, FR-26) ----------
async function loadSettings() {
  try {
    const { settings } = await api(`${R}/settings`);
    const f = $('#settings');
    f.orderingDeadline.value = settings.orderingDeadline;
    f.cashOnDeliveryEnabled.checked = settings.cashOnDeliveryEnabled;
    f.ePaymentEnabled.checked = settings.ePaymentEnabled;
  } catch (err) {
    showError(err);
  }
}

$('#settings').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  try {
    await api(`${R}/settings`, {
      method: 'PUT',
      body: { orderingDeadline: f.orderingDeadline.value, cashOnDeliveryEnabled: f.cashOnDeliveryEnabled.checked, ePaymentEnabled: f.ePaymentEnabled.checked },
    });
    toast('Settings saved');
  } catch (err) { showError(err); }
});

onLiveEvents((type, event) => {
  if (type === 'OrderSubmitted') toast(`New order ${event.orderId}`);
  if (current === 'orders') loadBoard(event.orderId);
});

select('orders');
