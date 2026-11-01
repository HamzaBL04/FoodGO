'use strict';

const bcrypt = require('bcryptjs');
const config = require('../config');
const { newId, newOrderId } = require('../domain/ids');
const { toMillimes } = require('../domain/money');
const { localDateString, addDays, deadlineInstant } = require('../domain/deadline');

/** Demo credentials, documented in the README. Never used in production. */
const DEMO_ACCOUNTS = Object.freeze({
  admin: { identity: 'admin@foodgo.tn', password: 'Admin#2026' },
  darLellaStaff: { identity: 'staff@darlella.tn', password: 'Staff#2026' },
  kramSnackStaff: { identity: 'staff@kramsnack.tn', password: 'Staff#2026' },
  karim: { identity: 'karim.d', password: 'Delivery#2026' },
  amine: { identity: 'amine.b', password: 'Delivery#2026' },
  sami: { identity: 'sami.c', password: 'Delivery#2026' },
  yasmine: { phone: '+21620111222' },
  omar: { phone: '+21698333444' },
  nour: { phone: '+21655666777' },
});

// Small deterministic PRNG so the order history (and so the forecast) is the
// same on every machine.
function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hash = (pw) => bcrypt.hashSync(pw, config.bcryptRounds);

// FR-32 / BR-17: every demo workplace is in Lac 3 or Zone Industrielle Le Kram.
// The names are fictional.
function seedOrganizations(repos) {
  const orgs = {
    lac3Tower: { organizationId: newId('org'), name: 'Lac 3 Business Tower', type: 'WORKPLACE', serviceZone: 'LAC_3' },
    lac3TechHub: { organizationId: newId('org'), name: 'Lac 3 Tech Hub', type: 'WORKPLACE', serviceZone: 'LAC_3' },
    kramTextile: { organizationId: newId('org'), name: 'Kram Textile Works', type: 'WORKPLACE', serviceZone: 'ZI_KRAM' },
  };
  Object.values(orgs).forEach((o) => repos.customers.insertOrganization(o));
  return orgs;
}

const MENUS = {
  darLella: [
    ['Couscous au poulet', 'Friday classic, with vegetables and chickpeas', 14.5, 9],
    ['Ojja merguez', 'Spicy tomato and egg skillet with merguez', 11, 7],
    ['Lablabi', 'Chickpea soup with cumin, harissa and bread', 6.5, 8],
    ['Kafteji', 'Fried vegetables, egg and chopped peppers', 8, 5],
    ["Brik à l'oeuf", 'Crispy pastry with egg, tuna and parsley', 3.5, 10],
    ['Salade méchouia', 'Grilled pepper and tomato salad', 6, 4],
    ['Makloub thon fromage', 'Folded flatbread, tuna and cheese', 7.5, 6],
    ['Citronnade', 'Fresh lemonade with mint', 3, 7],
  ],
  kramSnack: [
    ['Chapati thon', 'Chapati with tuna, egg and harissa', 5.5, 9],
    ['Baguette farcie', 'Stuffed baguette, the factory-floor favourite', 6, 8],
    ['Pizza margherita', 'Individual pizza, tomato and mozzarella', 9, 5],
    ['Salade tunisienne', 'Tomato, cucumber, onion, tuna', 5, 4],
    ["Jus d'orange", 'Freshly squeezed', 3.5, 6],
    ['Bambalouni', 'Sidi Bou Said doughnut with sugar', 1.5, 7],
  ],
};

function seedRestaurant(repos, { name, deadline, address, zone, menu }) {
  const restaurantId = newId('rst');
  repos.restaurants.insert({
    restaurantId,
    name,
    orderingDeadline: deadline,
    cashOnDeliveryEnabled: 1,
    ePaymentEnabled: 1,
    address,
    serviceZone: zone,
  });
  const menuId = newId('menu');
  repos.restaurants.insertMenu(menuId, restaurantId);
  const items = menu.map(([itemName, description, price, weight]) => {
    const item = {
      menuItemId: newId('item'),
      menuId,
      restaurantId,
      name: itemName,
      description,
      priceMillimes: toMillimes(price),
      available: 1,
    };
    repos.restaurants.insertItem(item);
    return { ...item, weight };
  });
  return { restaurantId, name, items };
}

function seedCustomer(repos, now, { fullName, phone, org }) {
  const customerId = newId('cus');
  repos.customers.insertCustomer({
    customerId,
    fullName,
    phoneNumber: phone,
    organizationId: org.organizationId,
    createdAt: now.toISOString(),
  });
  return { customerId, fullName, phone };
}

function register(repos, now, restaurant, customer, staffId) {
  repos.customers.insertMembership({
    restaurantId: restaurant.restaurantId,
    customerId: customer.customerId,
    credentialRef: newId('cred'),
    eligible: 1,
    registeredAt: now.toISOString(),
    registeredBy: staffId,
  });
}

function pickWeighted(rand, items) {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = rand() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

// Weekday shape of demand: quieter on Saturday, couscous peaks on Friday.
const WEEKDAY_FACTOR = [0, 1.0, 1.05, 1.1, 1.0, 1.25, 0.6];

/**
 * Inserts DELIVERED, PAID orders for the past `days` service days so the
 * demand forecast has history to learn from. Sundays are closed.
 */
function seedHistory(repos, { restaurant, customers, courier, today, days, rand }) {
  for (let back = days; back >= 1; back -= 1) {
    const serviceDate = addDays(today, -back);
    const weekday = new Date(`${serviceDate}T12:00:00`).getDay();
    if (weekday === 0) continue;
    const count = Math.round((14 + rand() * 6) * WEEKDAY_FACTOR[weekday]);
    for (let n = 0; n < count; n += 1) {
      insertHistoricalOrder(repos, { restaurant, customers, courier, serviceDate, weekday, rand });
    }
  }
}

function insertHistoricalOrder(repos, { restaurant, customers, courier, serviceDate, weekday, rand }) {
  const customer = customers[Math.floor(rand() * customers.length)];
  const lines = new Map();
  const lineCount = 1 + Math.floor(rand() * 3);
  for (let l = 0; l < lineCount; l += 1) {
    let item = pickWeighted(rand, restaurant.items);
    if (weekday === 5 && rand() < 0.35) item = restaurant.items[0]; // Friday couscous
    lines.set(item.menuItemId, { item, quantity: (lines.get(item.menuItemId)?.quantity || 0) + 1 });
  }
  const orderId = newOrderId();
  const createdAt = new Date(`${serviceDate}T0${7 + Math.floor(rand() * 3)}:${String(Math.floor(rand() * 60)).padStart(2, '0')}:00`);
  const total = [...lines.values()].reduce((s, l) => s + l.quantity * l.item.priceMillimes, 0);
  const method = rand() < 0.7 ? 'CASH_ON_DELIVERY' : 'E_PAYMENT';
  const deadline = deadlineInstant(serviceDate, '10:30').toISOString();
  repos.orders.insertOrder({
    orderId,
    customerId: customer.customerId,
    restaurantId: restaurant.restaurantId,
    status: 'DELIVERED',
    totalMillimes: total,
    paymentMethod: method,
    paymentStatus: 'PAID',
    createdAt: createdAt.toISOString(),
    serviceDate,
    deadlineSnapshot: deadline,
  });
  for (const { item, quantity } of lines.values()) {
    repos.orders.insertOrderItem({
      orderItemId: newId('oi'),
      orderId,
      menuItemId: item.menuItemId,
      nameSnapshot: item.name,
      quantity,
      unitPriceMillimes: item.priceMillimes,
    });
  }
  repos.orders.insertPayment({
    paymentId: newId('pay'),
    orderId,
    method,
    status: 'PAID',
    providerReference: method === 'E_PAYMENT' ? `DEMOPAY-${orderId}` : null,
    amountMillimes: total,
    createdAt: createdAt.toISOString(),
  });
  const deliveredAt = new Date(`${serviceDate}T12:${String(10 + Math.floor(rand() * 40)).padStart(2, '0')}:00`).toISOString();
  repos.orders.insertAssignment({
    assignmentId: newId('asg'),
    orderId,
    deliveryPersonId: courier,
    restaurantId: restaurant.restaurantId,
    assignedAt: deliveredAt,
  });
  const assignment = repos.orders.findAssignmentForOrder(orderId);
  repos.orders.updateAssignment({
    assignmentId: assignment.assignmentId,
    restaurantId: restaurant.restaurantId,
    status: 'COMPLETED',
    startedAt: deliveredAt,
    completedAt: deliveredAt,
  });
}

const EXTRA_CUSTOMERS = [
  ['Ahmed Mansouri', '+21622100001'], ['Sarra Ayari', '+21622100002'], ['Mohamed Ali Jlassi', '+21622100003'],
  ['Ines Khelifi', '+21622100004'], ['Youssef Hamdi', '+21622100005'], ['Rania Ferchichi', '+21622100006'],
  ['Hedi Baccouche', '+21622100007'], ['Emna Chaabane', '+21622100008'], ['Walid Saidi', '+21622100009'],
  ['Mariem Zouari', '+21622100010'], ['Fares Mejri', '+21622100011'], ['Asma Riahi', '+21622100012'],
];

/**
 * Seeds the demo dataset. `historyDays: 0` gives a small, fast dataset for tests.
 * Returns handles the tests use to reach seeded records.
 */
function seedDemoData(repos, { clock, historyDays = 28 } = {}) {
  const now = clock.now();
  const today = localDateString(now);
  const rand = mulberry32(20261102);

  return repos.unitOfWork(() => {
    const orgs = seedOrganizations(repos);
    const darLella = seedRestaurant(repos, {
      name: 'Dar Lella',
      deadline: '23:30', // demo setting: open almost all day so the app can be tried any time
      address: 'Les Berges du Lac, Tunis',
      zone: 'LAC_3',
      menu: MENUS.darLella,
    });
    const kramSnack = seedRestaurant(repos, {
      name: 'Kram Snack',
      deadline: '10:30', // a real morning deadline, to see BR-01 refuse late orders
      address: 'Le Kram, Tunis',
      zone: 'ZI_KRAM',
      menu: MENUS.kramSnack,
    });

    repos.accounts.insertAdmin({
      adminId: newId('adm'),
      identity: DEMO_ACCOUNTS.admin.identity,
      fullName: 'Platform Administrator',
      credentialHash: hash(DEMO_ACCOUNTS.admin.password),
    });
    const lellaStaffId = newId('stf');
    repos.accounts.insertStaff({
      staffId: lellaStaffId,
      restaurantId: darLella.restaurantId,
      identity: DEMO_ACCOUNTS.darLellaStaff.identity,
      fullName: 'Sonia Gharbi',
      credentialHash: hash(DEMO_ACCOUNTS.darLellaStaff.password),
    });
    const kramStaffId = newId('stf');
    repos.accounts.insertStaff({
      staffId: kramStaffId,
      restaurantId: kramSnack.restaurantId,
      identity: DEMO_ACCOUNTS.kramSnackStaff.identity,
      fullName: 'Mehdi Jaziri',
      credentialHash: hash(DEMO_ACCOUNTS.kramSnackStaff.password),
    });

    const courier = (restaurant, key, fullName, phone) => {
      const id = newId('dlv');
      repos.accounts.insertDeliveryPerson({
        deliveryPersonId: id,
        restaurantId: restaurant.restaurantId,
        identity: DEMO_ACCOUNTS[key].identity,
        fullName,
        phoneNumber: phone,
        credentialHash: hash(DEMO_ACCOUNTS[key].password),
      });
      return id;
    };
    const karimId = courier(darLella, 'karim', 'Karim Dridi', '+21650200300');
    const amineId = courier(darLella, 'amine', 'Amine Bouzid', '+21650200301');
    const samiId = courier(kramSnack, 'sami', 'Sami Chebbi', '+21650200302');

    const yasmine = seedCustomer(repos, now, { fullName: 'Yasmine Ben Ali', phone: DEMO_ACCOUNTS.yasmine.phone, org: orgs.lac3Tower });
    const omar = seedCustomer(repos, now, { fullName: 'Omar Trabelsi', phone: DEMO_ACCOUNTS.omar.phone, org: orgs.lac3TechHub });
    const nour = seedCustomer(repos, now, { fullName: 'Nour Hammami', phone: DEMO_ACCOUNTS.nour.phone, org: orgs.kramTextile });
    register(repos, now, darLella, yasmine, lellaStaffId);
    register(repos, now, kramSnack, yasmine, kramStaffId);
    register(repos, now, darLella, omar, lellaStaffId);
    register(repos, now, kramSnack, nour, kramStaffId);

    const regulars = [yasmine, omar];
    if (historyDays > 0) {
      const orgList = Object.values(orgs);
      EXTRA_CUSTOMERS.forEach(([fullName, phone], i) => {
        const c = seedCustomer(repos, now, { fullName, phone, org: orgList[i % orgList.length] });
        register(repos, now, darLella, c, lellaStaffId);
        regulars.push(c);
      });
      seedHistory(repos, { restaurant: darLella, customers: regulars, courier: karimId, today, days: historyDays, rand });
    }

    return {
      orgs,
      darLella: { ...darLella, staffId: lellaStaffId, couriers: { karimId, amineId } },
      kramSnack: { ...kramSnack, staffId: kramStaffId, couriers: { samiId } },
      customers: { yasmine, omar, nour },
    };
  });
}

module.exports = { seedDemoData, DEMO_ACCOUNTS, mulberry32 };
