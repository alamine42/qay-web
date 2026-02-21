import { createCipheriv, createDecipheriv, randomBytes, scrypt } from "crypto"
import { promisify } from "util"

const scryptAsync = promisify(scrypt)

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 16
const TAG_LENGTH = 16
const SALT_LENGTH = 32

function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY
  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is not set")
  }
  return key
}

async function deriveKey(salt: Buffer): Promise<Buffer> {
  const key = getEncryptionKey()
  return (await scryptAsync(key, salt, 32)) as Buffer
}

export async function encrypt(plaintext: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH)
  const key = await deriveKey(salt)
  const iv = randomBytes(IV_LENGTH)

  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  // Format: salt:iv:tag:encrypted (all base64)
  return [
    salt.toString("base64"),
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":")
}

export async function decrypt(ciphertext: string): Promise<string> {
  const parts = ciphertext.split(":")
  if (parts.length !== 4) {
    throw new Error("Invalid ciphertext format")
  }

  const [saltB64, ivB64, tagB64, encryptedB64] = parts
  const salt = Buffer.from(saltB64, "base64")
  const iv = Buffer.from(ivB64, "base64")
  const tag = Buffer.from(tagB64, "base64")
  const encrypted = Buffer.from(encryptedB64, "base64")

  const key = await deriveKey(salt)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ])

  return decrypted.toString("utf8")
}
