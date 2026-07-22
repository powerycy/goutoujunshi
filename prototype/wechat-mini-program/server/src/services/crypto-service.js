const crypto = require('node:crypto')

function createCryptoService(secret) {
  const key = crypto.createHash('sha256').update(secret).digest()
  return {
    encrypt(value) {
      const iv = crypto.randomBytes(12)
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
      const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()])
      return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.')
    },
    decrypt(value) {
      const [iv, tag, encrypted] = String(value).split('.')
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'))
      decipher.setAuthTag(Buffer.from(tag, 'base64url'))
      return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8')
    }
  }
}

module.exports = { createCryptoService }
