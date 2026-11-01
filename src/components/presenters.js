'use strict';

const { fromMillimes } = require('../domain/money');

/** View models shared by components: never expose hashes or internal flags. */

function menuItemView(item) {
  return {
    menuItemId: item.menuItemId,
    name: item.name,
    description: item.description,
    price: fromMillimes(item.priceMillimes),
    priceMillimes: item.priceMillimes,
    available: item.available === 1,
  };
}

function paymentMethodsFor(restaurant) {
  const methods = [];
  if (restaurant.cashOnDeliveryEnabled === 1) methods.push('CASH_ON_DELIVERY');
  if (restaurant.ePaymentEnabled === 1) methods.push('E_PAYMENT');
  return methods;
}

function restaurantSettingsView(r) {
  return {
    restaurantId: r.restaurantId,
    name: r.name,
    address: r.address,
    serviceZone: r.serviceZone,
    orderingDeadline: r.orderingDeadline,
    cashOnDeliveryEnabled: r.cashOnDeliveryEnabled === 1,
    ePaymentEnabled: r.ePaymentEnabled === 1,
    paymentMethods: paymentMethodsFor(r),
  };
}

module.exports = { menuItemView, paymentMethodsFor, restaurantSettingsView };
