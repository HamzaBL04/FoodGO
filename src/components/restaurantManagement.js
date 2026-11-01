'use strict';

const { AppError } = require('../domain/errors');
const { newId } = require('../domain/ids');
const { toMillimes } = require('../domain/money');
const { menuItemView, restaurantSettingsView } = require('./presenters');

/**
 * Restaurant Management component (SDD §2.3): menus and availability,
 * the ordering deadline, customer registration and verification, and the
 * restaurant's own delivery personnel. Every operation is restaurant-scoped.
 */
function createRestaurantManagement({ repos, clock, auth, sms }) {
  const nowIso = () => clock.now().toISOString();
  const audit = (principal, restaurantId, action, entity, entityId, detail) =>
    repos.platform.audit({
      at: nowIso(), actorRole: principal.role, actorId: principal.subjectId, restaurantId,
      action, entity, entityId, detail: detail ? JSON.stringify(detail) : null,
    });

  function restaurantOrThrow(restaurantId) {
    const r = repos.restaurants.findById(restaurantId);
    if (!r) throw new AppError('NOT-FOUND', 'Restaurant not found');
    return r;
  }

  function itemOrThrow(restaurantId, menuItemId) {
    const item = repos.restaurants.findItem(restaurantId, menuItemId);
    if (!item || item.removed === 1) throw new AppError('NOT-FOUND', 'Menu item not found');
    return item;
  }

  // ---- Menu (FR-07, FR-08, BR-03: restaurants manage their own menus) -------------------------------------------

  function getMenu(restaurantId) {
    return repos.restaurants.listItems(restaurantId).map(menuItemView);
  }

  function addMenuItem(principal, restaurantId, { name, description, price, available }) {
    const menu = repos.restaurants.findMenu(restaurantId);
    if (!menu) throw new AppError('NOT-FOUND', 'This restaurant has no published menu');
    const menuItemId = newId('item');
    repos.restaurants.insertItem({
      menuItemId, menuId: menu.menuId, restaurantId, name, description: description || '',
      priceMillimes: toMillimes(price), available: available === false ? 0 : 1,
    });
    audit(principal, restaurantId, 'MENU_ITEM_ADDED', 'menu_item', menuItemId);
    return menuItemView(repos.restaurants.findItem(restaurantId, menuItemId));
  }

  function updateMenuItem(principal, restaurantId, menuItemId, patch) {
    const item = itemOrThrow(restaurantId, menuItemId);
    const next = {
      menuItemId,
      restaurantId,
      name: patch.name ?? item.name,
      description: patch.description ?? item.description,
      // D-02: a price change never alters orders already placed, because
      // order lines carry their own unit-price snapshot.
      priceMillimes: patch.price !== undefined ? toMillimes(patch.price) : item.priceMillimes,
      available: patch.available !== undefined ? Number(patch.available) : item.available,
    };
    repos.restaurants.updateItem(next);
    const action = patch.available !== undefined && Object.keys(patch).length === 1 ? 'AVAILABILITY_CHANGED' : 'MENU_ITEM_UPDATED';
    audit(principal, restaurantId, action, 'menu_item', menuItemId, patch);
    return menuItemView(repos.restaurants.findItem(restaurantId, menuItemId));
  }

  /** Soft removal: an item on a placed order must still resolve (SDD §5.1.3, I-5). */
  function removeMenuItem(principal, restaurantId, menuItemId) {
    itemOrThrow(restaurantId, menuItemId);
    repos.restaurants.removeItem(restaurantId, menuItemId);
    audit(principal, restaurantId, 'MENU_ITEM_REMOVED', 'menu_item', menuItemId);
  }

  // ---- Settings: deadline (FR-12/13) and payment on delivery (FR-26) -------

  function getSettings(restaurantId) {
    return restaurantSettingsView(restaurantOrThrow(restaurantId));
  }

  function updateSettings(principal, restaurantId, { orderingDeadline, cashOnDeliveryEnabled, ePaymentEnabled }) {
    restaurantOrThrow(restaurantId);
    if (!cashOnDeliveryEnabled && !ePaymentEnabled) {
      throw new AppError('VAL-001', 'At least one payment method must stay enabled (BR-12)');
    }
    // D-04: orders already placed keep their deadline snapshot.
    repos.restaurants.updateSettings({
      restaurantId,
      orderingDeadline,
      cashOnDeliveryEnabled: cashOnDeliveryEnabled ? 1 : 0,
      ePaymentEnabled: ePaymentEnabled ? 1 : 0,
    });
    audit(principal, restaurantId, 'SETTINGS_UPDATED', 'restaurant', restaurantId, { orderingDeadline, cashOnDeliveryEnabled, ePaymentEnabled });
    return getSettings(restaurantId);
  }

  // ---- Organizations (FR-04, D-06) ------------------------------------------

  function listOrganizations() {
    return repos.customers.listOrganizations();
  }

  function createOrganization(principal, { name, type }) {
    if (repos.customers.findOrganizationByName(name)) throw new AppError('VAL-001', 'This organization already exists');
    const organizationId = newId('org');
    repos.customers.insertOrganization({ organizationId, name, type });
    audit(principal, principal.restaurantId, 'ORGANIZATION_CREATED', 'organization', organizationId);
    return repos.customers.findOrganization(organizationId);
  }

  // ---- Customers: in-person registration and verification ------------------

  function listCustomers(restaurantId) {
    return repos.customers.listMembers(restaurantId).map((m) => ({ ...m, eligible: m.eligible === 1 }));
  }

  /**
   * UC-04 / FR-01–FR-04: in-person registration by authorised staff.
   * D-01: one canonical customer; a second restaurant only adds a membership.
   */
  function registerCustomer(principal, restaurantId, { fullName, phoneNumber, organizationId, eligible }) {
    const restaurant = restaurantOrThrow(restaurantId);
    if (!repos.customers.findOrganization(organizationId)) throw new AppError('VAL-001', 'Unknown organization');
    let customer = repos.customers.findCustomerByPhone(phoneNumber);
    if (customer && repos.customers.findMembership(restaurantId, customer.customerId)) {
      throw new AppError('VAL-001', 'This customer is already registered at your restaurant');
    }
    const created = !customer;
    repos.unitOfWork(() => {
      if (!customer) {
        customer = { customerId: newId('cus'), fullName, phoneNumber, organizationId, createdAt: nowIso() };
        repos.customers.insertCustomer(customer);
      }
      repos.customers.insertMembership({
        restaurantId,
        customerId: customer.customerId,
        credentialRef: newId('cred'), // I-11: one credential reference per membership
        eligible: eligible === false ? 0 : 1,
        registeredAt: nowIso(),
        registeredBy: principal.subjectId,
      });
      audit(principal, restaurantId, 'CUSTOMER_REGISTERED', 'customer', customer.customerId, { newPerson: created });
    });
    sms.send(phoneNumber, `Welcome to FoodGO! ${restaurant.name} registered you. Sign in with this phone number to pre-order before ${restaurant.orderingDeadline}.`);
    return { ...getCustomer(restaurantId, customer.customerId), existingPerson: !created };
  }

  /** FR-16: the information authorised staff need to verify a customer. */
  function getCustomer(restaurantId, customerId) {
    const m = repos.customers.findMemberDetail(restaurantId, customerId);
    if (!m) throw new AppError('NOT-FOUND', 'Customer not registered at this restaurant');
    const { credentialRef: _hidden, ...view } = m;
    return { ...view, eligible: m.eligible === 1 };
  }

  /** FR-17 / BR-04: this restaurant's eligibility decision, stored on the membership. */
  function updateCustomer(principal, restaurantId, customerId, { eligible, status }) {
    getCustomer(restaurantId, customerId);
    if (eligible !== undefined) repos.customers.setEligibility(restaurantId, customerId, eligible);
    if (status !== undefined) repos.customers.setMembershipStatus(restaurantId, customerId, status);
    audit(principal, restaurantId, 'CUSTOMER_UPDATED', 'customer', customerId, { eligible, status });
    return getCustomer(restaurantId, customerId);
  }

  // ---- Delivery personnel (FR-18, FR-30, BR-06) -----------------------------

  function listDeliveryPersonnel(restaurantId) {
    return repos.accounts.listDeliveryPersonnel(restaurantId);
  }

  function provisionDeliveryPerson(principal, restaurantId, { identity, fullName, phoneNumber, password }) {
    restaurantOrThrow(restaurantId);
    if (repos.accounts.isIdentityTaken(identity)) throw new AppError('VAL-001', 'This identity is already in use');
    const deliveryPersonId = newId('dlv');
    repos.accounts.insertDeliveryPerson({
      deliveryPersonId, restaurantId, identity, fullName,
      phoneNumber: phoneNumber || null,
      credentialHash: auth.hashPassword(password),
    });
    audit(principal, restaurantId, 'DELIVERY_PERSON_PROVISIONED', 'delivery_person', deliveryPersonId);
    const { credentialHash: _h, ...view } = repos.accounts.findDeliveryPerson(restaurantId, deliveryPersonId);
    return view;
  }

  return {
    getMenu, addMenuItem, updateMenuItem, removeMenuItem,
    getSettings, updateSettings,
    listOrganizations, createOrganization,
    listCustomers, registerCustomer, getCustomer, updateCustomer,
    listDeliveryPersonnel, provisionDeliveryPerson,
  };
}

module.exports = { createRestaurantManagement };
