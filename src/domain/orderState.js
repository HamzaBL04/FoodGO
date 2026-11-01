'use strict';

const { AppError } = require('./errors');

/**
 * State pattern for the order lifecycle (SDD §7.1.4, D-05, D-09).
 *
 * Only the happy path is defined. It is PROPOSED: the specification names no
 * states. Cancelled / rejected / failed states are UNRESOLVED (SDD §6.3,
 * Q-04, Q-05, Q-09, Q-20) and deliberately absent: adding one means adding a
 * state here with its guards, without touching any caller.
 *
 *   SUBMITTED -> IN_PREPARATION -> ASSIGNED -> OUT_FOR_DELIVERY -> DELIVERED
 *        \__________________________/
 *        (a restaurant may assign straight from SUBMITTED)
 */
const ORDER_STATUS = Object.freeze({
  SUBMITTED: 'SUBMITTED',
  IN_PREPARATION: 'IN_PREPARATION',
  ASSIGNED: 'ASSIGNED',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
});

const hasAssignment = (ctx) => Boolean(ctx.assignment);
const assignmentStarted = (ctx) => Boolean(ctx.assignment) && ctx.assignment.status === 'STARTED';
const confirmedByAssignee = (ctx) =>
  Boolean(ctx.assignment) && ctx.actor && ctx.actor.role === 'DELIVERY' && ctx.actor.subjectId === ctx.assignment.deliveryPersonId;

const STATES = {
  SUBMITTED: {
    label: 'Order received',
    next: { IN_PREPARATION: null, ASSIGNED: { check: hasAssignment, rule: 'BR-10' } },
  },
  IN_PREPARATION: {
    label: 'Being prepared',
    next: { ASSIGNED: { check: hasAssignment, rule: 'BR-10' } },
  },
  ASSIGNED: {
    label: 'Delivery person assigned',
    // I-9 / BR-10: dispatch requires an assignment that the assignee started.
    next: { OUT_FOR_DELIVERY: { check: assignmentStarted, rule: 'BR-10' } },
  },
  OUT_FOR_DELIVERY: {
    label: 'On the way',
    // BR-11: only the assigned delivery person can confirm delivery.
    next: { DELIVERED: { check: confirmedByAssignee, rule: 'BR-11' } },
  },
  DELIVERED: { label: 'Delivered', next: {} },
};

function canTransition(from, to) {
  return Boolean(STATES[from]) && Object.prototype.hasOwnProperty.call(STATES[from].next, to);
}

/**
 * Validates a transition and its guard. Returns the target status.
 * @param {string} from current status
 * @param {string} to target status
 * @param {{assignment?: object, actor?: object}} ctx guard context
 */
function transition(from, to, ctx = {}) {
  if (!canTransition(from, to)) {
    throw new AppError('DEL-001', `An order cannot go from ${from} to ${to}`);
  }
  const guard = STATES[from].next[to];
  if (guard && !guard.check(ctx)) {
    throw new AppError('DEL-001', `Transition ${from} -> ${to} refused by ${guard.rule}`);
  }
  return to;
}

function labelOf(status) {
  return STATES[status] ? STATES[status].label : status;
}

function allowedNext(status) {
  return STATES[status] ? Object.keys(STATES[status].next) : [];
}

module.exports = { ORDER_STATUS, transition, canTransition, labelOf, allowedNext };
