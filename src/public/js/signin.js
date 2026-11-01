import { api, showError, esc } from './api.js';

const HOME = { CUSTOMER: '/customer', STAFF: '/restaurant', DELIVERY: '/delivery', ADMIN: '/admin' };

const requestForm = document.querySelector('#otp-request');
const verifyForm = document.querySelector('#otp-verify');
const passwordForm = document.querySelector('#password-signin');
let challengeId = null;

// Already signed in? Go straight to the right screen.
api('/auth/session').then(({ session }) => { window.location.href = HOME[session.role]; }).catch(() => {});
api('/meta').then((meta) => { document.querySelector('#demo').hidden = !meta.demoMode; }).catch(() => {});

const normalisePhone = (v) => v.replace(/[\s.-]/g, '');

requestForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const phoneNumber = normalisePhone(new FormData(requestForm).get('phoneNumber'));
  try {
    const res = await api('/auth/otp/request', { method: 'POST', body: { phoneNumber } });
    challengeId = res.challengeId;
    const demo = document.querySelector('#democode');
    if (res.demoCode) {
      demo.innerHTML = `Demo mode, no SMS is sent. Your code is <strong>${esc(res.demoCode)}</strong>`;
      demo.hidden = false;
      verifyForm.elements.code.value = res.demoCode;
    }
    requestForm.hidden = true;
    verifyForm.hidden = false;
    verifyForm.elements.code.focus();
  } catch (err) {
    showError(err);
  }
});

verifyForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/auth/otp/verify', { method: 'POST', body: { challengeId, code: verifyForm.elements.code.value.trim() } });
    window.location.href = HOME.CUSTOMER;
  } catch (err) {
    showError(err);
  }
});

document.querySelector('#otp-back').addEventListener('click', () => {
  verifyForm.hidden = true;
  requestForm.hidden = false;
});

passwordForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(passwordForm));
  try {
    const { session } = await api('/auth/signin', { method: 'POST', body: data });
    window.location.href = HOME[session.role];
  } catch (err) {
    showError(err);
  }
});
