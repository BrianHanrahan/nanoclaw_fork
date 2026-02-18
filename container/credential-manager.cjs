#!/usr/bin/env node
/**
 * Credential Manager for NanoClaw
 * Encrypts/decrypts credentials at rest using AES-256-GCM.
 *
 * Usage:
 *   node credential-manager.js set <file> <service> '<json>'
 *   node credential-manager.js get <file> <service>
 *   node credential-manager.js list <file>
 *   node credential-manager.js delete <file> <service>
 *
 * Requires CREDENTIALS_KEY env var (64-char hex string = 32 bytes).
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SALT_LEN = 16;
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

function getKey() {
  const hex = process.env.CREDENTIALS_KEY;
  if (!hex) {
    console.error('Error: CREDENTIALS_KEY environment variable is not set');
    process.exit(1);
  }
  if (hex.length !== 64) {
    console.error('Error: CREDENTIALS_KEY must be 64 hex characters (32 bytes)');
    process.exit(1);
  }
  return Buffer.from(hex, 'hex');
}

function deriveKey(masterKey, salt) {
  return crypto.scryptSync(masterKey, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
}

function readStore(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    if (e.code === 'ENOENT') {
      return { salt: null, entries: {} };
    }
    throw e;
  }
}

function writeStore(filePath, store) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2) + '\n', { mode: 0o600 });
}

function encrypt(derivedKey, plaintext) {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    ciphertext: encrypted.toString('base64'),
    tag: tag.toString('base64'),
  };
}

function decrypt(derivedKey, entry) {
  const iv = Buffer.from(entry.iv, 'base64');
  const ciphertext = Buffer.from(entry.ciphertext, 'base64');
  const tag = Buffer.from(entry.tag, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf-8');
}

function cmdSet(filePath, service, jsonValue) {
  // Validate JSON
  try {
    JSON.parse(jsonValue);
  } catch (e) {
    console.error('Error: value must be valid JSON');
    process.exit(1);
  }

  const masterKey = getKey();
  const store = readStore(filePath);

  // Use existing salt or create a new one
  if (!store.salt) {
    store.salt = crypto.randomBytes(SALT_LEN).toString('base64');
  }

  const salt = Buffer.from(store.salt, 'base64');
  const derivedKey = deriveKey(masterKey, salt);

  store.entries[service] = encrypt(derivedKey, jsonValue);
  writeStore(filePath, store);
  console.log(`Stored credentials for "${service}"`);
}

function cmdGet(filePath, service) {
  const masterKey = getKey();
  const store = readStore(filePath);

  if (!store.salt || !store.entries[service]) {
    console.error(`Error: no credentials found for "${service}"`);
    process.exit(1);
  }

  const salt = Buffer.from(store.salt, 'base64');
  const derivedKey = deriveKey(masterKey, salt);

  try {
    const plaintext = decrypt(derivedKey, store.entries[service]);
    console.log(plaintext);
  } catch (e) {
    console.error('Error: decryption failed (wrong key or corrupted data)');
    process.exit(1);
  }
}

function cmdList(filePath) {
  const store = readStore(filePath);
  const services = Object.keys(store.entries || {});
  if (services.length === 0) {
    console.log('No credentials stored');
  } else {
    services.forEach((s) => console.log(s));
  }
}

function cmdDelete(filePath, service) {
  const store = readStore(filePath);
  if (!store.entries[service]) {
    console.error(`Error: no credentials found for "${service}"`);
    process.exit(1);
  }
  delete store.entries[service];
  writeStore(filePath, store);
  console.log(`Deleted credentials for "${service}"`);
}

// --- CLI ---

const args = process.argv.slice(2);
const command = args[0];

if (!command) {
  console.error('Usage: credential-manager.js <set|get|list|delete> <file> [service] [json]');
  process.exit(1);
}

switch (command) {
  case 'set': {
    if (args.length < 4) {
      console.error('Usage: credential-manager.js set <file> <service> \'<json>\'');
      process.exit(1);
    }
    cmdSet(args[1], args[2], args[3]);
    break;
  }
  case 'get': {
    if (args.length < 3) {
      console.error('Usage: credential-manager.js get <file> <service>');
      process.exit(1);
    }
    cmdGet(args[1], args[2]);
    break;
  }
  case 'list': {
    if (args.length < 2) {
      console.error('Usage: credential-manager.js list <file>');
      process.exit(1);
    }
    cmdList(args[1]);
    break;
  }
  case 'delete': {
    if (args.length < 3) {
      console.error('Usage: credential-manager.js delete <file> <service>');
      process.exit(1);
    }
    cmdDelete(args[1], args[2]);
    break;
  }
  default:
    console.error(`Unknown command: ${command}`);
    console.error('Usage: credential-manager.js <set|get|list|delete> <file> [service] [json]');
    process.exit(1);
}
