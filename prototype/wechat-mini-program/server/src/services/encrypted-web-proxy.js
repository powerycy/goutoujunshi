const http = require('node:http')
const crypto = require('node:crypto')

const ALLOWED_ROUTES = new Map([
  ['/health', new Set(['GET'])],
  ['/v1/auth/web-demo', new Set(['POST'])],
  ['/v1/beta/me', new Set(['GET'])],
  ['/v1/analyses', new Set(['GET', 'POST'])]
])

function allowed(path, method) {
  if (ALLOWED_ROUTES.get(path)?.has(method)) return true
  return /^\/v1\/analyses\/[a-zA-Z0-9_-]+$/.test(path) && new Set(['GET', 'DELETE']).has(method)
}

function encryptPayload(value, key) {
  const nonce = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce)
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    nonce: nonce.toString('base64url'),
    ciphertext: Buffer.concat([ciphertext, tag]).toString('base64url')
  }
}

function decryptPayload(envelope, key) {
  const nonce = Buffer.from(String(envelope.nonce || ''), 'base64url')
  const combined = Buffer.from(String(envelope.ciphertext || ''), 'base64url')
  if (nonce.length !== 12 || combined.length < 17) throw new Error('INVALID_ENVELOPE')
  const ciphertext = combined.subarray(0, -16)
  const tag = combined.subarray(-16)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce)
  decipher.setAuthTag(tag)
  return JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8'))
}

function json(response, status, body) {
  response.writeHead(status, {
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store',
    'x-content-type-options':'nosniff'
  })
  response.end(JSON.stringify(body))
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = ''
    request.on('data', (chunk) => {
      body += chunk
      if (body.length > 1_500_000) {
        reject(new Error('PAYLOAD_TOO_LARGE'))
        request.destroy()
      }
    })
    request.on('end', () => {
      try { resolve(JSON.parse(body || '{}')) } catch (_) { reject(new Error('INVALID_JSON')) }
    })
    request.on('error', reject)
  })
}

function createEncryptedWebProxyServer(context, overrides = {}) {
  const key = Buffer.from(context.config.webProxyKey, 'base64')
  const upstreamBaseUrl = overrides.upstreamBaseUrl || `http://127.0.0.1:${context.config.port}`
  const seenNonces = new Map()

  function acceptNonce(nonce, issuedAt) {
    const now = Date.now()
    for (const [value, expiresAt] of seenNonces) if (expiresAt <= now) seenNonces.delete(value)
    if (!Number.isFinite(issuedAt) || Math.abs(now - issuedAt) > 60_000 || seenNonces.has(nonce)) return false
    seenNonces.set(nonce, now + 120_000)
    return true
  }

  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost')
      if (request.method === 'GET' && url.pathname === '/health') {
        json(response, 200, { ok:true, transport:'encrypted-proxy', modelMode:context.config.modelMode })
        return
      }
      if (request.method !== 'POST' || url.pathname !== '/v1/web-proxy') {
        json(response, 404, { code:'NOT_FOUND', message:'接口不存在' })
        return
      }
      const envelope = await readBody(request)
      const payload = decryptPayload(envelope, key)
      if (!acceptNonce(String(envelope.nonce || ''), Number(payload.issuedAt))) {
        json(response, 401, { code:'ENCRYPTED_PROXY_REPLAY_REJECTED', message:'加密请求已失效' })
        return
      }
      const method = String(payload.method || '').toUpperCase()
      const path = String(payload.path || '')
      if (!allowed(path, method)) {
        json(response, 404, { code:'PROXY_ROUTE_NOT_ALLOWED', message:'接口不在演示范围内' })
        return
      }
      const headers = new Headers({ accept:'application/json' })
      for (const name of ['authorization','content-type','idempotency-key']) {
        const value = payload.headers && payload.headers[name]
        if (typeof value === 'string' && value) headers.set(name, value)
      }
      const upstream = await fetch(`${upstreamBaseUrl}${path}`, {
        method,
        headers,
        body: ['POST','DELETE'].includes(method) ? String(payload.body || '') : undefined,
        redirect:'error'
      })
      const result = {
        status:upstream.status,
        contentType:upstream.headers.get('content-type') || 'application/json; charset=utf-8',
        body:await upstream.text()
      }
      json(response, 200, encryptPayload(result, key))
    } catch (error) {
      console.error('[encrypted-web-proxy]', error.code || error.name)
      json(response, 400, { code:'INVALID_ENCRYPTED_REQUEST', message:'加密请求无效' })
    }
  })
}

module.exports = { createEncryptedWebProxyServer, decryptPayload, encryptPayload, allowed }
