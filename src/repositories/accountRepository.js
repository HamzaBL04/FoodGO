'use strict';

const { mapRow, mapRows, requireScope } = require('./helpers');

/** Accounts for the three provisioned roles + platform admin (FR-29, FR-30). */
function createAccountRepository(db) {
  const st = {
    staffByIdentity: db.prepare('SELECT * FROM restaurant_staff WHERE identity = ?'),
    staffById: db.prepare('SELECT * FROM restaurant_staff WHERE staff_id = ?'),
    insertStaff: db.prepare(`INSERT INTO restaurant_staff
      (staff_id, restaurant_id, identity, full_name, credential_hash, status)
      VALUES (@staffId, @restaurantId, @identity, @fullName, @credentialHash, 'ACTIVE')`),
    listStaff: db.prepare(`SELECT s.staff_id, s.restaurant_id, s.identity, s.full_name, s.status, r.name AS restaurant_name
      FROM restaurant_staff s JOIN restaurant r ON r.restaurant_id = s.restaurant_id ORDER BY r.name, s.full_name`),
    deliveryByIdentity: db.prepare('SELECT * FROM delivery_person WHERE identity = ?'),
    deliveryById: db.prepare('SELECT * FROM delivery_person WHERE delivery_person_id = ? AND restaurant_id = ?'),
    insertDelivery: db.prepare(`INSERT INTO delivery_person
      (delivery_person_id, restaurant_id, identity, full_name, phone_number, credential_hash, status)
      VALUES (@deliveryPersonId, @restaurantId, @identity, @fullName, @phoneNumber, @credentialHash, 'ACTIVE')`),
    listDelivery: db.prepare(`SELECT delivery_person_id, restaurant_id, identity, full_name, phone_number, status
      FROM delivery_person WHERE restaurant_id = ? ORDER BY full_name`),
    adminByIdentity: db.prepare('SELECT * FROM platform_admin WHERE identity = ?'),
    insertAdmin: db.prepare(`INSERT INTO platform_admin (admin_id, identity, full_name, credential_hash)
      VALUES (@adminId, @identity, @fullName, @credentialHash)`),
    identityTaken: db.prepare(`SELECT 1 FROM restaurant_staff WHERE identity = @identity
      UNION SELECT 1 FROM delivery_person WHERE identity = @identity
      UNION SELECT 1 FROM platform_admin WHERE identity = @identity`),
  };

  return {
    findStaffByIdentity: (identity) => mapRow(st.staffByIdentity.get(identity)),
    findStaffById: (staffId) => mapRow(st.staffById.get(staffId)),
    insertStaff: (staff) => st.insertStaff.run(staff),
    listAllStaff: () => mapRows(st.listStaff.all()),

    findDeliveryPersonByIdentity: (identity) => mapRow(st.deliveryByIdentity.get(identity)),
    findDeliveryPerson: (restaurantId, deliveryPersonId) => {
      requireScope(restaurantId);
      return mapRow(st.deliveryById.get(deliveryPersonId, restaurantId));
    },
    insertDeliveryPerson: (person) => {
      requireScope(person.restaurantId);
      return st.insertDelivery.run({ phoneNumber: null, ...person });
    },
    listDeliveryPersonnel: (restaurantId) => {
      requireScope(restaurantId);
      return mapRows(st.listDelivery.all(restaurantId));
    },

    findAdminByIdentity: (identity) => mapRow(st.adminByIdentity.get(identity)),
    insertAdmin: (admin) => st.insertAdmin.run(admin),

    isIdentityTaken: (identity) => Boolean(st.identityTaken.get({ identity })),
  };
}

module.exports = { createAccountRepository };
