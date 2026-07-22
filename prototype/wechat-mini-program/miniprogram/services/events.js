const Api = require('./api')
const Config = require('../config/index')
const { createIdempotencyKey } = require('../utils/idempotency')

function track(eventName, safeProperties) {
  const event = {
    eventId: createIdempotencyKey('client_event'),
    eventName,
    occurredAt: new Date().toISOString(),
    properties: Object.assign({ clientVersion: Config.clientVersion }, safeProperties || {})
  }
  return Api.post('/v1/events/batch', { events: [event] }, 'events').catch(() => null)
}

module.exports = { track }
