'use strict';

const { mapRow, mapRows, requireScope } = require('./helpers');

/** Customer, Organization and the RestaurantCustomer membership (D-01, D-06). */
function createCustomerRepository(db) {
  const st = {
    orgList: db.prepare('SELECT * FROM organization ORDER BY name'),
    orgById: db.prepare('SELECT * FROM organization WHERE organization_id = ?'),
    orgByName: db.prepare('SELECT * FROM organization WHERE lower(name) = lower(?)'),
    insertOrg: db.prepare(`INSERT INTO organization (organization_id, name, type, status, service_zone)
      VALUES (@organizationId, @name, @type, 'ACTIVE', @serviceZone)`),
    customerByPhone: db.prepare('SELECT * FROM customer WHERE phone_number = ?'),
    customerById: db.prepare(`SELECT c.*, o.name AS organization_name, o.type AS organization_type,
        o.service_zone AS organization_zone
      FROM customer c JOIN organization o ON o.organization_id = c.organization_id WHERE c.customer_id = ?`),
    insertCustomer: db.prepare(`INSERT INTO customer (customer_id, full_name, phone_number, organization_id, status, created_at)
      VALUES (@customerId, @fullName, @phoneNumber, @organizationId, 'ACTIVE', @createdAt)`),
    updateCustomerOrg: db.prepare('UPDATE customer SET organization_id = ?, full_name = ? WHERE customer_id = ?'),
    membership: db.prepare('SELECT * FROM restaurant_customer WHERE restaurant_id = ? AND customer_id = ?'),
    insertMembership: db.prepare(`INSERT INTO restaurant_customer
      (restaurant_id, customer_id, credential_ref, eligible, status, registered_at, registered_by)
      VALUES (@restaurantId, @customerId, @credentialRef, @eligible, 'ACTIVE', @registeredAt, @registeredBy)`),
    setEligibility: db.prepare('UPDATE restaurant_customer SET eligible = ? WHERE restaurant_id = ? AND customer_id = ?'),
    setMembershipStatus: db.prepare('UPDATE restaurant_customer SET status = ? WHERE restaurant_id = ? AND customer_id = ?'),
    activeMembershipsForCustomer: db.prepare(`SELECT rc.restaurant_id FROM restaurant_customer rc
      WHERE rc.customer_id = ? AND rc.status = 'ACTIVE' AND rc.eligible = 1`),
    listMembers: db.prepare(`SELECT c.customer_id, c.full_name, c.phone_number, o.name AS organization_name,
        o.service_zone AS organization_zone, rc.eligible, rc.status, rc.registered_at
      FROM restaurant_customer rc
      JOIN customer c ON c.customer_id = rc.customer_id
      JOIN organization o ON o.organization_id = c.organization_id
      WHERE rc.restaurant_id = ? ORDER BY rc.registered_at DESC`),
    memberDetail: db.prepare(`SELECT c.customer_id, c.full_name, c.phone_number, o.organization_id, o.name AS organization_name,
        o.type AS organization_type, o.service_zone AS organization_zone, rc.eligible, rc.status, rc.registered_at, rc.credential_ref
      FROM restaurant_customer rc
      JOIN customer c ON c.customer_id = rc.customer_id
      JOIN organization o ON o.organization_id = c.organization_id
      WHERE rc.restaurant_id = ? AND rc.customer_id = ?`),
  };

  return {
    listOrganizations: () => mapRows(st.orgList.all()),
    findOrganization: (id) => mapRow(st.orgById.get(id)),
    findOrganizationByName: (name) => mapRow(st.orgByName.get(name)),
    insertOrganization: (org) => st.insertOrg.run({ serviceZone: null, ...org }),

    findCustomerByPhone: (phone) => mapRow(st.customerByPhone.get(phone)),
    findCustomer: (customerId) => mapRow(st.customerById.get(customerId)),
    insertCustomer: (c) => st.insertCustomer.run(c),
    updateCustomerProfile: (customerId, organizationId, fullName) =>
      st.updateCustomerOrg.run(organizationId, fullName, customerId),

    findMembership: (restaurantId, customerId) => {
      requireScope(restaurantId);
      return mapRow(st.membership.get(restaurantId, customerId));
    },
    insertMembership: (m) => {
      requireScope(m.restaurantId);
      return st.insertMembership.run(m);
    },
    setEligibility: (restaurantId, customerId, eligible) => {
      requireScope(restaurantId);
      return st.setEligibility.run(eligible ? 1 : 0, restaurantId, customerId);
    },
    setMembershipStatus: (restaurantId, customerId, status) => {
      requireScope(restaurantId);
      return st.setMembershipStatus.run(status, restaurantId, customerId);
    },
    activeRestaurantIdsForCustomer: (customerId) =>
      st.activeMembershipsForCustomer.all(customerId).map((r) => r.restaurant_id),
    listMembers: (restaurantId) => {
      requireScope(restaurantId);
      return mapRows(st.listMembers.all(restaurantId));
    },
    findMemberDetail: (restaurantId, customerId) => {
      requireScope(restaurantId);
      return mapRow(st.memberDetail.get(restaurantId, customerId));
    },
  };
}

module.exports = { createCustomerRepository };
