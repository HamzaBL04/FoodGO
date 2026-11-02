import { api, esc, tnd, time, toast, showError, requireSession, mountTopbar, onLiveEvents, tabs, sunTrack, STATUS_STEPS, statusChip, paymentChip } from './api.js';

const session = await requireSession('CUSTOMER');
mountTopbar(session, 'Customer');

const state = { restaurants: [], menu: null, cart: new Map(), view: 'restaurants', requestKey: null };
const $ = (s) => document.querySelector(s);

const select = tabs((name) => {
  state.view = name;
  $('#cartbar').hidden = true;
  if (name === 'restaurants') loadRestaurants();
  if (name === 'orders') loadOrders();
});

function show(view) {
  state.view = view;
  for (const v of document.querySelectorAll('[data-view]')) v.hidden = v.dataset.view !== view;
  updateCartBar();
  window.scrollTo(0, 0);
}

// ---------- restaurants (FR-05) ----------
async function loadRestaurants() {
  try {
    const { restaurants } = await api('/customer/restaurants');
    state.restaurants = restaurants;
    $('#restaurant-list').innerHTML = restaurants.length
      ? `<h1>Where would you like lunch from today?</h1>` + restaurants.map((r) => `
        <button class="restaurant-card" data-id="${esc(r.restaurantId)}">
          <h3>${esc(r.name)}</h3>
          <p class="muted">${esc([r.address, r.zone].filter(Boolean).join(' · '))}</p>
          ${sunTrack(r)}
        </button>`).join('')
      : `<div class="empty"><h2>No restaurant yet</h2><p>Ask a restaurant to register you in person. You will then see it here.</p></div>`;
    for (const b of document.querySelectorAll('.restaurant-card')) b.addEventListener('click', () => openMenu(b.dataset.id));
  } catch (err) {
    showError(err);
  }
}

// ---------- menu (FR-06, FR-08, FR-09, FR-10) ----------
async function openMenu(restaurantId) {
  try {
    const menu = await api(`/customer/restaurants/${encodeURIComponent(restaurantId)}/menu`);
    if (!state.menu || state.menu.restaurant.restaurantId !== restaurantId) state.cart.clear();
    state.menu = menu;
    state.requestKey = crypto.randomUUID();
    renderMenu();
    show('menu');
  } catch (err) {
    showError(err);
  }
}

function renderMenu() {
  const { restaurant, items } = state.menu;
  $('#menu-title').textContent = restaurant.name;
  $('#menu-deadline').innerHTML = sunTrack(restaurant);
  const closed = !restaurant.orderingOpen;
  $('#menu-items').innerHTML = items.map((i) => {
    const q = state.cart.get(i.menuItemId) || 0;
    const canOrder = i.available && !closed;
    return `<div class="menu-item ${i.available ? '' : 'unavailable'}">
      <div>
        <div class="name">${esc(i.name)}</div>
        <div class="muted">${esc(i.description)}</div>
        <div class="price">${tnd(i.price)} ${i.available ? '' : '<span class="chip bad">Unavailable today</span>'}</div>
      </div>
      <div class="qty" aria-label="Quantity of ${esc(i.name)}">
        <button class="secondary" data-dec="${esc(i.menuItemId)}" ${q === 0 ? 'disabled' : ''} aria-label="Remove one">−</button>
        <output>${q}</output>
        <button data-inc="${esc(i.menuItemId)}" ${canOrder ? '' : 'disabled'} aria-label="Add one">+</button>
      </div>
    </div>`;
  }).join('');
  for (const b of document.querySelectorAll('[data-inc]')) b.addEventListener('click', () => changeQty(b.dataset.inc, 1));
  for (const b of document.querySelectorAll('[data-dec]')) b.addEventListener('click', () => changeQty(b.dataset.dec, -1));
  updateCartBar();
}

function changeQty(id, delta) {
  const next = Math.max(0, Math.min(50, (state.cart.get(id) || 0) + delta));
  if (next === 0) state.cart.delete(id);
  else state.cart.set(id, next);
  renderMenu();
}

function cartLines() {
  return [...state.cart.entries()].map(([id, quantity]) => {
    const item = state.menu.items.find((i) => i.menuItemId === id);
    return { item, quantity, lineTotal: item.priceMillimes * quantity };
  });
}

function updateCartBar() {
  const lines = state.menu ? cartLines() : [];
  const count = lines.reduce((s, l) => s + l.quantity, 0);
  const total = lines.reduce((s, l) => s + l.lineTotal, 0) / 1000;
  $('#cartbar').hidden = !(state.view === 'menu' && count > 0);
  $('#cart-sum').textContent = `${count} item${count === 1 ? '' : 's'}, ${tnd(total)}`;
}

// ---------- checkout (FR-11, FR-12, FR-25) ----------
function renderCheckout() {
  const { restaurant } = state.menu;
  const lines = cartLines();
  const total = lines.reduce((s, l) => s + l.lineTotal, 0) / 1000;
  $('#checkout-restaurant').textContent = `From ${restaurant.name}, delivered at lunchtime today`;
  $('#checkout-lines').innerHTML = lines.map((l) => `<tr><td>${l.quantity} × ${esc(l.item.name)}</td><td>${tnd(l.lineTotal / 1000)}</td></tr>`).join('')
    + `<tr class="total"><td>Total</td><td>${tnd(total)}</td></tr>`;
  const labels = { CASH_ON_DELIVERY: ['Cash on delivery', 'Pay the delivery person when your lunch arrives'], E_PAYMENT: ['E-payment', 'Paid now through the payment provider (sandbox in this demo)'] };
  $('#methods').innerHTML = restaurant.paymentMethods.map((m, i) => `
    <label class="method"><input type="radio" name="method" value="${m}" ${i === 0 ? 'checked' : ''}>
      <span><strong>${labels[m][0]}</strong><br><small>${labels[m][1]}</small></span></label>`).join('');
  $('#checkout-deadline').textContent = restaurant.orderingOpen
    ? `Ordering for today closes at ${restaurant.orderingDeadline}. You can still place this order.`
    : `Ordering closed at ${restaurant.orderingDeadline}.`;
  $('#place-order').disabled = !restaurant.orderingOpen;
  show('checkout');
}

async function placeOrder() {
  const button = $('#place-order');
  button.disabled = true;
  const paymentMethod = document.querySelector('input[name="method"]:checked').value;
  try {
    const { order } = await api('/customer/orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': state.requestKey },
      body: {
        restaurantId: state.menu.restaurant.restaurantId,
        items: [...state.cart.entries()].map(([menuItemId, quantity]) => ({ menuItemId, quantity })),
        paymentMethod,
      },
    });
    state.cart.clear();
    toast(`Order ${order.orderId} placed. Total ${tnd(order.total)}.`);
    select('orders');
  } catch (err) {
    showError(err);
    if (err.code === 'ORDER-001' || err.code === 'ORDER-002') openMenu(state.menu.restaurant.restaurantId);
  } finally {
    button.disabled = false;
  }
}

// ---------- my orders (FR-24, live) ----------
function progress(status) {
  const index = STATUS_STEPS.findIndex(([s]) => s === status);
  return `<ol class="progress">${STATUS_STEPS.map(([, label], i) =>
    `<li class="${i < index || status === 'DELIVERED' ? 'done' : i === index ? 'current' : ''}">${esc(label)}</li>`).join('')}</ol>`;
}

function orderCard(o, flashId) {
  return `<article class="order-card ${o.orderId === flashId ? 'flash' : ''}" id="o-${esc(o.orderId)}">
    <header><span class="order-id">${esc(o.orderId)}</span>${statusChip(o.status)}</header>
    <p class="muted">${esc(o.restaurantName)}, ordered at ${time(o.createdAt)}</p>
    <p>${o.items.map((i) => `${i.quantity} × ${esc(i.name)}`).join(', ')}</p>
    <p><strong>${tnd(o.total)}</strong> ${paymentChip(o.paymentMethod, o.paymentStatus)}</p>
    ${o.delivery ? `<p class="muted">Delivery person: ${esc(o.delivery.deliveryPersonName)}${o.delivery.completedAt ? `, delivered at ${time(o.delivery.completedAt)}` : ''}</p>` : ''}
    ${progress(o.status)}
  </article>`;
}

async function loadOrders(flashId) {
  try {
    const { orders } = await api('/customer/orders');
    const today = new Date().toLocaleDateString('en-CA');
    const current = orders.filter((o) => o.serviceDate === today);
    const earlier = orders.filter((o) => o.serviceDate !== today).slice(0, 8);
    $('#order-list').innerHTML = `<h1>Today's lunch</h1>`
      + (current.length ? current.map((o) => orderCard(o, flashId)).join('')
        : `<div class="empty"><p>You have not ordered for today yet. Pick a restaurant and order before its deadline.</p></div>`)
      + (earlier.length ? `<h3 style="margin-top:2rem">Earlier orders</h3><table class="data">${earlier.map((o) => `
          <tr><td><strong>${esc(o.orderId)}</strong><br><span class="muted">${esc(o.serviceDate)}, ${esc(o.restaurantName)}</span></td>
          <td>${o.items.map((i) => `${i.quantity} × ${esc(i.name)}`).join(', ')}</td><td class="num">${tnd(o.total)}</td></tr>`).join('')}</table>` : '');
  } catch (err) {
    showError(err);
  }
}

onLiveEvents((type, event) => {
  if (state.view === 'orders') loadOrders(event.orderId);
  if (type === 'OrderStatusChanged') toast(`Order ${event.orderId}: ${(STATUS_STEPS.find(([s]) => s === event.status) || [null, event.status])[1]}`);
});

$('#back').addEventListener('click', () => select('restaurants'));
$('#back-to-menu').addEventListener('click', () => { renderMenu(); show('menu'); });
$('#review').addEventListener('click', renderCheckout);
$('#place-order').addEventListener('click', placeOrder);

select('restaurants');
