// Shared browser helpers: API calls, escaping, formatting, toasts, live events.

const API = '/api/v1';

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(API + path, {
    method,
    credentials: 'same-origin',
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data.error || {};
    throw new ApiError(res.status, err.code || 'SYS-001', err.message || 'Something went wrong');
  }
  return data;
}

/** Escapes text for safe insertion into HTML templates. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export const tnd = (n) => `${Number(n).toFixed(3)} TND`;

export function time(iso) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function dateTime(iso) {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

let toastTimer;
export function toast(message, kind = 'info') {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  el.textContent = message;
  el.classList.toggle('error', kind === 'error');
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, kind === 'error' ? 6000 : 3500);
}

export function showError(err) {
  toast(err instanceof ApiError ? err.message : 'Network problem. Check your connection and try again.', 'error');
}

/** Loads the session or sends the visitor to the sign-in page. */
export async function requireSession(role) {
  try {
    const { session } = await api('/auth/session');
    if (role && session.role !== role) throw new Error('wrong role');
    return session;
  } catch {
    window.location.href = '/';
    return new Promise(() => {});
  }
}

export function mountTopbar(session, subtitle) {
  const who = document.querySelector('.topbar .who');
  who.innerHTML = `<strong>${esc(session.fullName)}</strong>${esc(subtitle || session.restaurantName || '')}`;
  document.querySelector('#signout').addEventListener('click', async () => {
    await api('/auth/signout', { method: 'POST' }).catch(() => {});
    window.location.href = '/';
  });
}

/** Live updates (SSE). The server already filters events to this viewer. */
export function onLiveEvents(handler) {
  const source = new EventSource(`${API}/events`);
  const types = ['OrderSubmitted', 'OrderConfirmed', 'OrderStatusChanged', 'DeliveryAssigned', 'DeliveryStatusChanged', 'PaymentStatusChanged'];
  for (const type of types) source.addEventListener(type, (e) => handler(type, JSON.parse(e.data)));
  return () => source.close();
}

/** Wires a tab bar: buttons with data-tab, sections with data-view. */
export function tabs(onChange) {
  const buttons = [...document.querySelectorAll('.tabs [data-tab]')];
  const select = (name) => {
    for (const b of buttons) b.setAttribute('aria-selected', String(b.dataset.tab === name));
    for (const v of document.querySelectorAll('[data-view]')) v.hidden = v.dataset.view !== name;
    onChange(name);
  };
  for (const b of buttons) b.addEventListener('click', () => select(b.dataset.tab));
  return select;
}

/**
 * The sun track: how much of the morning ordering window is left.
 * Window drawn from 06:00 to the restaurant's deadline.
 */
export function sunTrack({ orderingDeadline, orderingOpen, minutesLeft }) {
  const [h, m] = orderingDeadline.split(':').map(Number);
  const end = h * 60 + m;
  const start = Math.min(6 * 60, end - 60);
  const now = end - (orderingOpen ? minutesLeft : 0);
  const pct = orderingOpen ? Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100)) : 100;
  const left = orderingOpen
    ? minutesLeft >= 60 ? `${Math.floor(minutesLeft / 60)} h ${minutesLeft % 60} min left` : `${minutesLeft} min left`
    : 'closed for today';
  const startLabel = `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`;
  return `<div class="suntrack ${orderingOpen ? '' : 'closed'}" role="img" aria-label="Ordering ${esc(left)}, deadline ${esc(orderingDeadline)}">
    <div class="headline">Order by ${esc(orderingDeadline)} <em>${esc(left)}</em></div>
    <div class="track"><div class="elapsed" style="width:${pct}%"></div><div class="sun" style="left:${pct}%"></div></div>
    <div class="ends"><span>${startLabel}</span><span>Deadline ${esc(orderingDeadline)}</span></div>
  </div>`;
}

export const STATUS_STEPS = [
  ['SUBMITTED', 'Order received'],
  ['IN_PREPARATION', 'Being prepared'],
  ['ASSIGNED', 'Delivery person assigned'],
  ['OUT_FOR_DELIVERY', 'On the way'],
  ['DELIVERED', 'Delivered'],
];

export function statusChip(status) {
  const kind = { DELIVERED: 'ok', OUT_FOR_DELIVERY: 'warn', ASSIGNED: 'info', IN_PREPARATION: 'info', SUBMITTED: '' }[status] ?? '';
  const label = (STATUS_STEPS.find(([s]) => s === status) || [status, status])[1];
  return `<span class="chip ${kind}">${esc(label)}</span>`;
}

export function paymentChip(method, status) {
  const m = method === 'E_PAYMENT' ? 'E-payment' : 'Cash on delivery';
  return `<span class="chip ${status === 'PAID' ? 'ok' : 'warn'}">${esc(m)}: ${status === 'PAID' ? 'paid' : 'to collect'}</span>`;
}
