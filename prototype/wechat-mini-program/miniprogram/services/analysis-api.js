const Api = require('./api')

module.exports = {
  create: (payload) => Api.post('/v1/analyses', payload, 'analysis'),
  get: (id) => Api.get(`/v1/analyses/${id}`),
  list: () => Api.get('/v1/analyses'),
  remove: (id) => Api.delete(`/v1/analyses/${id}`, 'analysis_delete')
}
