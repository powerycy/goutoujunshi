const request = require('../utils/request')
const { createIdempotencyKey } = require('../utils/idempotency')

function write(path, data, prefix, method) {
  return request({
    path,
    method: method || 'POST',
    data,
    headers: { 'Idempotency-Key': createIdempotencyKey(prefix) }
  })
}

module.exports = {
  get: (path) => request({ path }),
  post: (path, data, prefix) => write(path, data, prefix, 'POST'),
  delete: (path, prefix) => write(path, undefined, prefix, 'DELETE')
}
