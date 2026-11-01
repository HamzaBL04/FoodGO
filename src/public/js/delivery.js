import { api, esc, tnd, time, toast, showError, requireSession, mountTopbar, onLiveEvents, statusChip } from './api.js';

const session = await requireSession('DELIVERY');
mountTopbar(session);
const $ = (s) => document.querySelector(s);
let openId = null;

// ---------- my deliveries (FR-20, BR-08) ----------
async function loadJobs() {
  try {
    const { assignments } = await api('/delivery/assignments');
    const active = assignments.filter((a) => a.status !== 'COMPLETED');
    const done = assignments.filter((a) => a.status === 'COMPLETED').slice(0, 5);
    const card = (a) => `<button class="job ${a.status === 'COMPLETED' ? 'done' : ''}" data-id="${esc(a.assignmentId)}">
        <div style="display:flex;justify-content:space-between;gap:1rem"><span class="order-id">${esc(a.orderId)}</span>${statusChip(a.orderStatus)}</div>
        <div><strong>${esc(a.customerName)}</strong>, ${esc(a.destination)}</div>
        <div class="muted">${a.paymentMethod === 'CASH_ON_DELIVERY' && a.paymentStatus !== 'PAID' ? `Collect ${tnd(a.total)} in cash` : 'Already paid'}</div>
      </button>`;
    $('#jobs').innerHTML = (active.length ? active.map(card).join('') : '<div class="empty"><h2>Nothing to deliver right now</h2><p>New assignments appear here automatically.</p></div>')
      + (done.length ? `<h3 style="margin-top:2rem">Delivered recently</h3>${done.map(card).join('')}` : '');
    for (const b of document.querySelectorAll('.job')) b.addEventListener('click', () => openJob(b.dataset.id));
  } catch (err) {
    showError(err);
  }
}

// ---------- one delivery (FR-21, FR-22, FR-23) ----------
/** The one action available at each stage of a delivery (BR-11). */
function actionFor(a, cash) {
  if (a.status === 'ASSIGNED') return `<button class="big" id="start">I picked it up, start delivery</button>`;
  if (a.status === 'COMPLETED') return `<p class="chip ok">Delivered at ${time(a.completedAt)}</p>`;
  const cashBox = cash ? `<label class="check collect"><input type="checkbox" id="cash" checked> I collected ${tnd(a.payment.amountToCollect)} in cash</label>` : '';
  return `${cashBox}<button class="big" id="confirm">Confirm delivered</button>`;
}

async function openJob(id) {
  try {
    const { assignment: a } = await api(`/delivery/assignments/${encodeURIComponent(id)}`);
    openId = id;
    const cash = a.payment.amountToCollect > 0;
    const action = actionFor(a, cash);
    $('#detail').innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:baseline"><h1 class="order-id" style="font-size:2rem">${esc(a.order.orderId)}</h1>${statusChip(a.order.status)}</div>
      ${cash && a.status !== 'COMPLETED' ? `<div class="collect">Collect ${tnd(a.payment.amountToCollect)} in cash</div>` : ''}
      <dl class="facts panel">
        <dt>Pick up at</dt><dd>${esc(a.pickup.restaurantName)}</dd><span class="muted">${esc(a.pickup.address || '')}</span>
        <dt>Deliver to</dt><dd>${esc(a.customer.fullName)}</dd><span class="muted">${esc(a.customer.destination)}</span>
        <dt>Phone</dt><dd><a href="tel:${esc(a.customer.phoneNumber)}">${esc(a.customer.phoneNumber)}</a></dd>
        <dt>In the bag</dt><dd style="font-size:1rem">${a.order.items.map((i) => `${i.quantity} × ${esc(i.name)}`).join('<br>')}</dd>
      </dl>
      <div style="margin-top:1rem">${action}</div>`;
    $('#list-view').hidden = true;
    $('#detail-view').hidden = false;
    $('#start')?.addEventListener('click', () => step(`/delivery/assignments/${id}/start`, {}, 'Delivery started. The customer can see you are on the way.'));
    $('#confirm')?.addEventListener('click', () => step(`/delivery/assignments/${id}/confirm`, { cashCollected: $('#cash') ? $('#cash').checked : undefined }, 'Delivery confirmed'));
  } catch (err) {
    showError(err);
  }
}

async function step(path, body, message) {
  try {
    await api(path, { method: 'POST', body });
    toast(message);
    openJob(openId);
  } catch (err) {
    showError(err);
  }
}

$('#back').addEventListener('click', () => {
  openId = null;
  $('#detail-view').hidden = true;
  $('#list-view').hidden = false;
  loadJobs();
});

onLiveEvents((type, event) => {
  if (type === 'DeliveryAssigned') toast(`New delivery: order ${event.orderId}`);
  if (!openId) loadJobs();
});

loadJobs();
