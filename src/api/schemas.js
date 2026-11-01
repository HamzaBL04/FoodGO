'use strict';

const { z } = require('zod');
const { ZONE_CODES } = require('../domain/serviceArea');

const phone = z.string().trim().regex(/^\+216\d{8}$/, 'phone number must look like +216XXXXXXXX');
const hhmm = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'must be HH:MM');
const password = z.string().min(8, 'password must be at least 8 characters').max(128);
const identity = z.string().trim().min(3).max(120);
// FR-32 / BR-17: Lac 3 or Zone Industrielle Le Kram only (ADR-0007).
const serviceZone = z.enum(ZONE_CODES, { message: 'FoodGO serves only Lac 3 (LAC_3) and Zone Industrielle Le Kram (ZI_KRAM)' });

const schemas = {
  signIn: z.object({
    role: z.enum(['STAFF', 'DELIVERY', 'ADMIN']),
    identity,
    password: z.string().min(1).max(128),
  }),
  otpRequest: z.object({ phoneNumber: phone }),
  otpVerify: z.object({ challengeId: z.string().min(5), code: z.string().regex(/^\d{6}$/, 'code must be 6 digits') }),

  createRestaurant: z.object({
    name: z.string().trim().min(2).max(80),
    orderingDeadline: hhmm,
    address: z.string().trim().max(200).optional(),
    serviceZone,
  }),
  provisionStaff: z.object({
    restaurantId: z.string().min(3),
    identity,
    fullName: z.string().trim().min(2).max(80),
    password,
  }),

  menuItem: z.object({
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(240).default(''),
    price: z.number().positive().max(1000),
    available: z.boolean().default(true),
  }),
  menuItemPatch: z
    .object({
      name: z.string().trim().min(2).max(80).optional(),
      description: z.string().trim().max(240).optional(),
      price: z.number().positive().max(1000).optional(),
      available: z.boolean().optional(),
    })
    .refine((v) => Object.keys(v).length > 0, 'at least one field is required'),
  settings: z.object({
    orderingDeadline: hhmm,
    cashOnDeliveryEnabled: z.boolean(),
    ePaymentEnabled: z.boolean(),
  }),
  registerCustomer: z.object({
    fullName: z.string().trim().min(2).max(80),
    phoneNumber: phone,
    organizationId: z.string().min(3),
    eligible: z.boolean().default(true),
    identityVerified: z.literal(true, { message: 'identity must be verified in person before registration (BR-05)' }),
  }),
  customerPatch: z
    .object({ eligible: z.boolean().optional(), status: z.enum(['ACTIVE', 'SUSPENDED']).optional() })
    .refine((v) => Object.keys(v).length > 0, 'at least one field is required'),
  organization: z.object({
    name: z.string().trim().min(2).max(80),
    type: z.enum(['WORKPLACE', 'CAMPUS', 'INSTITUTION']),
    serviceZone,
  }),
  deliveryPerson: z.object({
    identity,
    fullName: z.string().trim().min(2).max(80),
    phoneNumber: phone.optional(),
    password,
  }),
  assign: z.object({ deliveryPersonId: z.string().min(3) }),

  submitOrder: z.object({
    restaurantId: z.string().min(3),
    items: z
      .array(z.object({ menuItemId: z.string().min(3), quantity: z.number().int().min(1).max(50) }))
      .min(1, 'an order needs at least one item')
      .max(30),
    paymentMethod: z.enum(['CASH_ON_DELIVERY', 'E_PAYMENT']),
  }),
  confirmDelivery: z.object({ cashCollected: z.boolean().optional() }),
};

module.exports = { schemas };
