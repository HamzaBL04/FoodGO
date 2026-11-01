import { api, esc, dateTime, toast, showError, requireSession, mountTopbar, tabs } from './api.js';

const session = await requireSession('ADMIN');
mountTopbar(session, 'Platform administration');
const $ = (s) => document.querySelector(s);
const STATUS_LABELS = { SUBMITTED: 'Received', IN_PREPARATION: 'Preparing', ASSIGNED: 'Assigned', OUT_FOR_DELIVERY: 'On the way', DELIVERED: 'Delivered' };

const select = tabs((name) => ({ monitor: loadMonitor, restaurants: loadRestaurants, staff: loadStaff })[name]());

// ---------- monitoring (BG-09) ----------
async function loadMonitor() {
  try {
    const m = await api('/admin/monitor');
    $('#by-restaurant').innerHTML = `<tr><th>Restaurant</th>${Object.values(STATUS_LABELS).map((l) => `<th class="num">${l}</th>`).join('')}</tr>`
      + m.restaurants.map((r) => `<tr><td><strong>${esc(r.name)}</strong></td>${Object.keys(STATUS_LABELS).map((s) => `<td class="num">${r.today[s] || 0}</td>`).join('')}</tr>`).join('');
    const t = m.totals;
    $('#totals').innerHTML = [['Restaurants', t.restaurants], ['Customers', t.customers], ['Restaurant staff', t.staff], ['Delivery personnel', t.deliveryPersonnel], ['Orders, all time', t.ordersTotal]]
      .map(([k, v]) => `<tr><td>${k}</td><td class="num"><strong>${v}</strong></td></tr>`).join('');
    $('#audit').innerHTML = `<tr><th>When</th><th>Who</th><th>Action</th><th>Record</th></tr>` + m.recentEvents.map((e) => `
      <tr><td>${dateTime(e.at)}</td><td>${esc(e.actorRole.toLowerCase())}</td><td>${esc(e.action.replaceAll('_', ' ').toLowerCase())}</td><td class="muted">${esc(e.entityId || '')}</td></tr>`).join('');
  } catch (err) {
    showError(err);
  }
}

// ---------- restaurants ----------
async function loadRestaurants() {
  try {
    const { restaurants } = await api('/admin/restaurants');
    $('#restaurants').innerHTML = `<tr><th>Name</th><th>Deadline</th><th>Status</th></tr>` + restaurants.map((r) =>
      `<tr><td><strong>${esc(r.name)}</strong><br><span class="muted">${esc(r.address || '')}</span></td><td>${esc(r.orderingDeadline)}</td><td><span class="chip ok">${esc(r.status.toLowerCase())}</span></td></tr>`).join('');
    $('#staff-restaurant').innerHTML = restaurants.map((r) => `<option value="${esc(r.restaurantId)}">${esc(r.name)}</option>`).join('');
  } catch (err) {
    showError(err);
  }
}

$('#add-restaurant').addEventListener('submit', async (e) => {
  e.preventDefault();
  const d = Object.fromEntries(new FormData(e.target));
  if (!d.address) delete d.address;
  try {
    await api('/admin/restaurants', { method: 'POST', body: d });
    e.target.reset();
    toast(`${d.name} added`);
    loadRestaurants();
  } catch (err) { showError(err); }
});

// ---------- staff accounts (FR-29) ----------
async function loadStaff() {
  try {
    await loadRestaurants();
    const { staff } = await api('/admin/staff');
    $('#staff').innerHTML = `<tr><th>Name</th><th>Email</th><th>Restaurant</th></tr>` + staff.map((s) =>
      `<tr><td><strong>${esc(s.fullName)}</strong></td><td>${esc(s.identity)}</td><td>${esc(s.restaurantName)}</td></tr>`).join('');
  } catch (err) {
    showError(err);
  }
}

$('#add-staff').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const d = Object.fromEntries(new FormData(e.target));
    await api('/admin/staff', { method: 'POST', body: d });
    e.target.reset();
    toast(`Account created for ${d.fullName}`);
    loadStaff();
  } catch (err) { showError(err); }
});

select('monitor');
