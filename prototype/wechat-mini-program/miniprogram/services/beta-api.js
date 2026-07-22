const Api = require('./api')
const Config = require('../config/index')

module.exports = {
  getMine: () => Api.get('/v1/beta/me'),
  enroll: (packageId) => Api.post('/v1/beta/purchase-intents', {
    packageId,
    copyVersion: Config.copyVersion,
    source: 'pricing_page'
  }, 'purchase_intent')
}
