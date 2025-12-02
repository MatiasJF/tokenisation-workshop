# BSV Wallet Integration Guide for Node.js CLI Applications

## Table of Contents
1. [Overview](#overview)
2. [The Originator Error](#the-originator-error)
3. [Solution](#solution)
4. [Complete Working Example](#complete-working-example)
5. [WalletClient Architecture](#walletclient-architecture)
6. [Alternative Approaches](#alternative-approaches)
7. [Best Practices](#best-practices)

## Overview

The `WalletClient` from `@bsv/sdk` is designed to work in **both browser and Node.js environments**, but it requires different initialization parameters depending on the environment.

### Browser vs Node.js

| Environment | Originator Required? | How it Works |
|-------------|---------------------|--------------|
| **Browser** | ❌ No | The browser automatically sends the `Origin` header with every HTTP request |
| **Node.js** | ✅ Yes | Node.js doesn't have an automatic origin, so you must provide an `originator` string |

## The Originator Error

### What You See

```bash
Originator is required in Node.js environments
Failed to connect to BSV Desktop Wallet: No wallet available over any communication substrate
```

### Why It Happens

When `WalletClient` runs in Node.js, it detects it's not in a browser environment and requires an `originator` parameter to identify your application. This is used to set the `Origin` and `Originator` HTTP headers when communicating with the wallet.

From the SDK source code (`HTTPWalletJSON.js`):

```javascript
const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined' && window?.origin !== 'file://';

// In browser environments, let the browser handle Origin header automatically
// In Node.js environments, we need to set it manually if originator is provided
const origin = !isBrowser && this.originator
  ? toOriginHeader(this.originator, 'http')
  : undefined;

if (!isBrowser && origin === undefined) {
  console.error('Originator is required in Node.js environments');
}
```

## Solution

### Step 1: Add Originator to Environment Variables

Update your `.env` file:

```bash
# Application Originator (REQUIRED for Node.js CLI apps)
# This identifies your application to the BSV Desktop Wallet
# Use a domain-style identifier (can be fake for local development)
ORIGINATOR=tokenisation-workshop.local
```

**Important Notes:**
- The originator should be a domain-style string (e.g., `myapp.local`, `my-token-app.dev`)
- It doesn't need to be a real domain for local development
- It's used to identify your application to the wallet (similar to CORS origins)
- Format: lowercase letters, numbers, dots, and hyphens only

### Step 2: Update Your Code

**Before (Broken in Node.js):**

```typescript
import { WalletClient } from '@bsv/sdk'

class MintApp {
  private wallet: WalletClient

  constructor() {
    // ❌ This fails in Node.js!
    this.wallet = new WalletClient()
  }
}
```

**After (Works in Node.js):**

```typescript
import { WalletClient } from '@bsv/sdk'

const {
  ORIGINATOR = 'tokenisation-workshop.local'
} = process.env

class MintApp {
  private wallet: WalletClient

  constructor() {
    // ✅ This works in Node.js!
    this.wallet = new WalletClient('auto', ORIGINATOR)
  }
}
```

## Complete Working Example

Here's a full example of a Node.js CLI app that mints tokens using BSV Desktop Wallet:

```typescript
import 'dotenv/config'
import { WalletClient, Script, Utils, Hash } from '@bsv/sdk'

const {
  ORIGINATOR = 'tokenisation-workshop.local'
} = process.env

interface TokenMetadata {
  name: string
  symbol: string
  decimals: number
  totalSupply: number
}

class MintApp {
  private wallet: WalletClient
  private identityKey: string | null = null

  constructor() {
    // Initialize WalletClient with originator (required in Node.js)
    this.wallet = new WalletClient('auto', ORIGINATOR)
  }

  async initialize(): Promise<void> {
    console.log('🔌 Connecting to BSV Desktop Wallet...')

    // Get identity key from wallet
    const keyResult = await this.wallet.getPublicKey({ identityKey: true })
    this.identityKey = keyResult.publicKey

    console.log('✅ Wallet connected!')
    console.log(`📍 Identity Key: ${this.identityKey}`)
  }

  generateTokenId(): string {
    const timestamp = Date.now().toString()
    const combined = (this.identityKey || 'default') + timestamp
    const hashBytes = Hash.hash256(combined, 'utf8')
    return Utils.toHex(hashBytes)
  }

  createTokenScript(tokenId: string, amount: number, metadata: TokenMetadata): Script {
    const amountBuffer = new Array(8).fill(0)
    let remaining = amount
    for (let i = 0; i < 8; i++) {
      amountBuffer[i] = remaining % 256
      remaining = Math.floor(remaining / 256)
    }

    const fields = [
      Utils.toArray('TOKEN', 'utf8'),
      Utils.toArray(tokenId, 'hex'),
      amountBuffer,
      Utils.toArray(JSON.stringify(metadata), 'utf8')
    ]

    return Script.fromASM([
      'OP_FALSE',
      'OP_RETURN',
      ...fields.map(field => Utils.toHex(field))
    ].join(' '))
  }

  async mint(metadata: TokenMetadata): Promise<{ txid: string, tokenId: string }> {
    console.log('\n🪙  Minting new token...')

    const tokenId = this.generateTokenId()
    const tokenScript = this.createTokenScript(tokenId, metadata.totalSupply, metadata)

    // Create transaction with wallet
    const createResult = await this.wallet.createAction({
      outputs: [{
        satoshis: 0,
        script: tokenScript.toHex()
      }],
      description: `Mint ${metadata.name} (${metadata.symbol})`
    })

    // Sign and broadcast
    const signResult = await this.wallet.signAction({
      inputs: createResult.inputs || {},
      createResult: createResult,
      accept: true,
      description: `Mint ${metadata.name} token`
    })

    const txid = signResult.txid || signResult.tx?.txid
    if (!txid) throw new Error('No TXID returned from wallet')

    console.log(`✅ Transaction broadcast successful!`)
    console.log(`   TXID: ${txid}`)
    console.log(`   Explorer: https://whatsonchain.com/tx/${txid}`)

    return { txid, tokenId }
  }
}

// Usage
async function main() {
  const app = new MintApp()
  await app.initialize()

  await app.mint({
    name: 'My Token',
    symbol: 'MTK',
    decimals: 0,
    totalSupply: 1000000
  })
}

main().catch(console.error)
```

## WalletClient Architecture

### Constructor Signature

```typescript
constructor(
  substrate?: 'auto' | 'Cicada' | 'XDM' | 'window.CWI' | 'json-api' | 'react-native' | 'secure-json-api' | WalletInterface,
  originator?: string
)
```

### Substrate Options

| Substrate | Description | When to Use |
|-----------|-------------|-------------|
| `'auto'` (default) | Automatically detects available substrate | ✅ **Recommended for most cases** |
| `'window.CWI'` | Browser window.CWI interface | Browser apps with wallet extension |
| `'XDM'` | Cross-Document Messaging | Browser iframes |
| `'json-api'` | HTTP JSON API (localhost:3321) | Node.js apps, local wallet |
| `'secure-json-api'` | HTTPS JSON API (localhost:2121) | Node.js apps, secure local wallet |
| `'Cicada'` | WalletWire protocol | Node.js apps, remote wallet |
| `'react-native'` | React Native WebView | Mobile apps |

### Auto-Detection Order (Node.js)

When you use `'auto'`, the SDK tries substrates in this order:

1. **Fast attempts (parallel):**
   - `window.CWI` (browser extension)
   - `HTTPWalletJSON` on `https://localhost:2121` (secure)
   - `HTTPWalletJSON` on `http://localhost:3321` (default)
   - `ReactNativeWebView` (mobile)
   - `WalletWireTransceiver` (Cicada)

2. **Slow fallback:**
   - `XDM` (Cross-Document Messaging, 200ms timeout)

3. **Error:**
   - Throws "No wallet available over any communication substrate"

## Alternative Approaches

### Option 1: WalletClient (Recommended) ✅

**Pros:**
- ✅ User's existing wallet and keys
- ✅ User approves each transaction
- ✅ Secure (keys never leave wallet)
- ✅ Works on mainnet with real funds
- ✅ Follows BRC-100 standard

**Cons:**
- ⚠️ Requires BSV Desktop Wallet running
- ⚠️ User must approve each transaction
- ⚠️ Requires `originator` in Node.js

**Use Cases:**
- Production applications
- User-facing applications
- Applications handling real funds
- Multi-user applications

**Example:**
```typescript
import { WalletClient } from '@bsv/sdk'

const wallet = new WalletClient('auto', 'myapp.local')

const createResult = await wallet.createAction({
  outputs: [{ satoshis: 0, script: tokenScript.toHex() }],
  description: 'Mint token'
})

const signResult = await wallet.signAction({
  inputs: createResult.inputs || {},
  createResult,
  accept: true
})
```

### Option 2: Direct PrivateKey Signing

**Pros:**
- ✅ No wallet required
- ✅ Fully automated (no user approval)
- ✅ Works in any environment

**Cons:**
- ⚠️ Must manage private keys yourself
- ⚠️ Security risk if keys exposed
- ⚠️ No user approval mechanism

**Use Cases:**
- Testing and development
- Automated scripts/bots
- Server-side operations
- Single-user applications

**Example:**
```typescript
import {
  Transaction,
  PrivateKey,
  P2PKH,
  ARC
} from '@bsv/sdk'

// Load private key from secure storage
const privKey = PrivateKey.fromWif(process.env.PRIVATE_KEY!)

const tx = new Transaction()

// Add input with unlocking script template
tx.addInput({
  sourceTransaction: parentTx,
  sourceOutputIndex: 0,
  unlockingScriptTemplate: new P2PKH().unlock(privKey)
})

// Add token output
tx.addOutput({
  lockingScript: Script.fromASM('OP_FALSE OP_RETURN ' + tokenData),
  satoshis: 0
})

// Add change output
tx.addOutput({
  lockingScript: new P2PKH().lock(privKey.toPublicKey().toAddress()),
  change: true
})

// Calculate fee, sign, and broadcast
await tx.fee()
await tx.sign()

const arc = new ARC('https://api.taal.com/arc', {
  apiKey: 'mainnet_xxxxx'
})
await tx.broadcast(arc)
```

### Option 3: ProtoWallet (Advanced)

**Pros:**
- ✅ Implements BRC-42 key derivation
- ✅ Hierarchical deterministic keys
- ✅ Privacy-enhanced transactions
- ✅ Protocol-specific key isolation

**Cons:**
- ⚠️ More complex setup
- ⚠️ Still need to manage root key
- ⚠️ Requires understanding of BRC-42/43

**Use Cases:**
- Advanced privacy features
- Protocol-specific key derivation
- Building wallet applications
- Multi-protocol applications

**Example:**
```typescript
import { ProtoWallet, PrivateKey } from '@bsv/sdk'

// Initialize with root key
const rootKey = PrivateKey.fromWif(process.env.ROOT_KEY!)
const protoWallet = new ProtoWallet(rootKey)

// Derive protocol-specific keys
const mintKey = await protoWallet.derivePrivateKey(
  [2, 'token-minting'],  // protocol ID
  'mint-001',             // key ID
  'self'                  // counterparty
)

// Use derived key for signing
const tx = new Transaction()
tx.addInput({
  sourceTransaction: parentTx,
  sourceOutputIndex: 0,
  unlockingScriptTemplate: new P2PKH().unlock(mintKey)
})
// ... rest of transaction
```

## Best Practices

### 1. Environment Configuration

Always use environment variables for sensitive configuration:

```bash
# .env
ORIGINATOR=myapp.local
IDENTITY_KEY=your_identity_key_here

# Never commit:
# - Private keys
# - API keys
# - Real identity keys in production
```

### 2. Error Handling

Provide helpful error messages for common issues:

```typescript
async initialize(): Promise<void> {
  try {
    const keyResult = await this.wallet.getPublicKey({ identityKey: true })
    this.identityKey = keyResult.publicKey
  } catch (error: any) {
    throw new Error(
      `Failed to connect to BSV Desktop Wallet: ${error.message}\n\n` +
      `Make sure:\n` +
      `  1. BSV Desktop Wallet is running\n` +
      `  2. Your wallet is unlocked\n` +
      `  3. ORIGINATOR is set in .env file\n` +
      `  4. Wallet connection is available`
    )
  }
}
```

### 3. Transaction Descriptions

Always provide clear descriptions for user approval:

```typescript
const createResult = await this.wallet.createAction({
  outputs: [...],
  description: 'Mint 1,000,000 MyToken (MTK)' // Clear, specific description
})

const signResult = await this.wallet.signAction({
  inputs: createResult.inputs || {},
  createResult,
  accept: true,
  description: 'Mint MyToken' // Same or similar description
})
```

### 4. TypeScript Types

Use proper TypeScript types for safety:

```typescript
import {
  WalletClient,
  CreateActionResult,
  SignActionResult
} from '@bsv/sdk'

async mint(metadata: TokenMetadata): Promise<{ txid: string, tokenId: string }> {
  const createResult: CreateActionResult = await this.wallet.createAction({...})
  const signResult: SignActionResult = await this.wallet.signAction({...})

  const txid = signResult.txid || signResult.tx?.txid
  if (!txid) throw new Error('No TXID returned from wallet')

  return { txid, tokenId }
}
```

### 5. Security Considerations

**For WalletClient:**
- ✅ Use domain-style originators
- ✅ Let users approve transactions
- ✅ Don't bypass approval dialogs
- ✅ Keep originator consistent per app

**For PrivateKey:**
- ✅ Never commit keys to git
- ✅ Use environment variables
- ✅ Rotate keys regularly
- ✅ Use different keys for test/prod
- ✅ Consider hardware wallets for production

### 6. Testing

**Development:**
```bash
# Use testnet for development
NETWORK=test
ORIGINATOR=myapp-dev.local
```

**Production:**
```bash
# Use mainnet for production
NETWORK=main
ORIGINATOR=myapp.com
```

## Troubleshooting

### "Originator is required in Node.js environments"

**Fix:** Pass originator to WalletClient constructor:
```typescript
new WalletClient('auto', 'myapp.local')
```

### "No wallet available over any communication substrate"

**Possible causes:**
1. BSV Desktop Wallet not running
2. Wallet locked
3. Originator not provided (Node.js)
4. Wallet not listening on expected ports

**Fix:**
1. Start BSV Desktop Wallet
2. Unlock the wallet
3. Verify wallet is listening on http://localhost:3321
4. Check ORIGINATOR is set in .env

### "Failed to connect to BSV Desktop Wallet"

**Check:**
```bash
# Test wallet API endpoint
curl http://localhost:3321/getVersion

# Should return:
# {"version":"1.x.x"}
```

### Transaction Approval Dialog Not Appearing

**Possible causes:**
1. Wallet window minimized
2. Notification permissions disabled
3. Transaction validation failed

**Fix:**
1. Check wallet window
2. Enable notifications for BSV Desktop
3. Review transaction outputs/description

## Additional Resources

- **SDK Documentation:** https://bsv-blockchain.github.io/ts-sdk
- **BRC-100 (Wallet Interface):** https://github.com/bitcoin-sv/BRCs/blob/master/wallet/0100.md
- **BSV Desktop Wallet:** https://www.yours.org/wallet/
- **WalletClient Source:** `@bsv/sdk/src/wallet/WalletClient.ts`
- **HTTPWalletJSON Source:** `@bsv/sdk/src/wallet/substrates/HTTPWalletJSON.ts`

## Summary

### Quick Checklist for Node.js CLI Apps

- [ ] Add `ORIGINATOR=myapp.local` to `.env`
- [ ] Load originator from environment: `const { ORIGINATOR = 'myapp.local' } = process.env`
- [ ] Pass originator to WalletClient: `new WalletClient('auto', ORIGINATOR)`
- [ ] Ensure BSV Desktop Wallet is running
- [ ] Ensure wallet is unlocked
- [ ] Test with a simple getPublicKey call first
- [ ] Provide clear transaction descriptions
- [ ] Handle errors gracefully with helpful messages

### The Key Difference

```typescript
// ❌ Browser (automatic origin)
new WalletClient() // Works in browser

// ✅ Node.js (manual originator)
new WalletClient('auto', 'myapp.local') // Required in Node.js
```

That's it! You're now ready to integrate BSV Desktop Wallet into your Node.js CLI applications using the proper SDK patterns. 🚀
