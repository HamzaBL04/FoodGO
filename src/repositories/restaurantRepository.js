'use strict';

const { mapRow, mapRows, requireScope } = require('./helpers');

/** Restaurant, Menu and MenuItem (FR-05 to FR-08, BR-03). */
function createRestaurantRepository(db) {
  const st = {
    all: db.prepare('SELECT * FROM restaurant ORDER BY name'),
    byId: db.prepare('SELECT * FROM restaurant WHERE restaurant_id = ?'),
    insert: db.prepare(`INSERT INTO restaurant (restaurant_id, name, status, ordering_deadline, access_rules,
        cash_on_delivery_enabled, e_payment_enabled, address)
      VALUES (@restaurantId, @name, 'ACTIVE', @orderingDeadline, @accessRules, @cashOnDeliveryEnabled, @ePaymentEnabled, @address)`),
    updateSettings: db.prepare(`UPDATE restaurant SET ordering_deadline = @orderingDeadline,
        cash_on_delivery_enabled = @cashOnDeliveryEnabled, e_payment_enabled = @ePaymentEnabled
      WHERE restaurant_id = @restaurantId`),
    forCustomer: db.prepare(`SELECT r.* FROM restaurant r
      JOIN restaurant_customer rc ON rc.restaurant_id = r.restaurant_id
      WHERE rc.customer_id = ? AND rc.status = 'ACTIVE' AND rc.eligible = 1 AND r.status = 'ACTIVE'
      ORDER BY r.name`),
    menuFor: db.prepare(`SELECT * FROM menu WHERE restaurant_id = ? AND status = 'PUBLISHED' LIMIT 1`),
    insertMenu: db.prepare(`INSERT INTO menu (menu_id, restaurant_id, status) VALUES (?, ?, 'PUBLISHED')`),
    items: db.prepare(`SELECT * FROM menu_item WHERE restaurant_id = ? AND removed = 0 ORDER BY name`),
    itemById: db.prepare('SELECT * FROM menu_item WHERE menu_item_id = ? AND restaurant_id = ?'),
    insertItem: db.prepare(`INSERT INTO menu_item (menu_item_id, menu_id, restaurant_id, name, description, price_millimes, available, removed)
      VALUES (@menuItemId, @menuId, @restaurantId, @name, @description, @priceMillimes, @available, 0)`),
    updateItem: db.prepare(`UPDATE menu_item SET name = @name, description = @description,
        price_millimes = @priceMillimes, available = @available
      WHERE menu_item_id = @menuItemId AND restaurant_id = @restaurantId`),
    removeItem: db.prepare('UPDATE menu_item SET removed = 1, available = 0 WHERE menu_item_id = ? AND restaurant_id = ?'),
  };

  return {
    listAll: () => mapRows(st.all.all()),
    findById: (restaurantId) => {
      requireScope(restaurantId);
      return mapRow(st.byId.get(restaurantId));
    },
    insert: (r) => st.insert.run({ accessRules: 'ORGANIZATION_MEMBERS_ONLY', address: null, ...r }),
    updateSettings: (s) => {
      requireScope(s.restaurantId);
      return st.updateSettings.run(s);
    },
    listForCustomer: (customerId) => mapRows(st.forCustomer.all(customerId)),

    findMenu: (restaurantId) => {
      requireScope(restaurantId);
      return mapRow(st.menuFor.get(restaurantId));
    },
    insertMenu: (menuId, restaurantId) => {
      requireScope(restaurantId);
      return st.insertMenu.run(menuId, restaurantId);
    },
    listItems: (restaurantId) => {
      requireScope(restaurantId);
      return mapRows(st.items.all(restaurantId));
    },
    findItem: (restaurantId, menuItemId) => {
      requireScope(restaurantId);
      return mapRow(st.itemById.get(menuItemId, restaurantId));
    },
    insertItem: (item) => {
      requireScope(item.restaurantId);
      return st.insertItem.run(item);
    },
    updateItem: (item) => {
      requireScope(item.restaurantId);
      return st.updateItem.run(item);
    },
    removeItem: (restaurantId, menuItemId) => {
      requireScope(restaurantId);
      return st.removeItem.run(menuItemId, restaurantId);
    },
  };
}

module.exports = { createRestaurantRepository };
