#!/usr/bin/env node

/**
 * Generate private keys for the tokenisation workshop
 *
 * Usage: node scripts/generate-keys.js
 */

import { randomBytes } from 'crypto'

console.log(`
╔════════════════════════════════════════╗
║   BSV Private Key Generator            ║
║   For Workshop Use Only                ║
╚════════════════════════════════════════╝
`)

const serverKey = randomBytes(32).toString('hex')
const minterKey = randomBytes(32).toString('hex')
const walletKey = randomBytes(32).toString('hex')

console.log('Generated private keys (32 bytes each):')
console.log('')
console.log('SERVER_PRIVATE_KEY=' + serverKey)
console.log('MINTER_PRIVATE_KEY=' + minterKey)
console.log('WALLET_PRIVATE_KEY=' + walletKey)
console.log('')
console.log('⚠️  IMPORTANT:')
console.log('- These are for TESTING/WORKSHOP use only')
console.log('- NEVER use in production')
console.log('- NEVER commit these to git')
console.log('- Keep your .env file secure')
console.log('')
console.log('Copy these to your .env file or run:')
console.log('  node scripts/generate-keys.js >> .env')
console.log('')
