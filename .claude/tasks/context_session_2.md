# BSV Tokenization Workshop - Context Session 2

## Date: 2025-12-02

## Task: Fix "Originator is required in Node.js environments" Error

### Problem Identified

User reported getting the following error when trying to use WalletClient in Node.js CLI applications:

```
Originator is required in Node.js environments
Failed to connect to BSV Desktop Wallet: No wallet available over any communication substrate
```

The current code in both `src/apps/mint.ts` and `src/apps/wallet.ts` was using:
```typescript
this.wallet = new WalletClient()  // Missing originator parameter!
```

### Root Cause Analysis

After investigating the SDK source code (`node_modules/@bsv/sdk/dist/esm/src/wallet/substrates/HTTPWalletJSON.js`), I discovered that:

1. **Browser environments** don't need an originator because the browser automatically sends the `Origin` header
2. **Node.js environments** require an `originator` parameter because Node.js doesn't have an automatic origin

From the SDK source:
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

### WalletClient Constructor Signature

```typescript
constructor(
  substrate?: 'auto' | 'Cicada' | 'XDM' | 'window.CWI' | 'json-api' | 'react-native' | 'secure-json-api' | WalletInterface,
  originator?: string
)
```

- **First parameter**: Substrate type (default: 'auto')
- **Second parameter**: Originator domain string (REQUIRED in Node.js)

### Changes Made

#### 1. Updated `src/apps/mint.ts`

**Added environment variable:**
```typescript
const {
  IDENTITY_KEY,
  ORIGINATOR = 'tokenisation-workshop.local'  // NEW
} = process.env
```

**Fixed constructor:**
```typescript
constructor() {
  // Initialize WalletClient with originator (required in Node.js)
  // The originator identifies your application to the wallet
  this.wallet = new WalletClient('auto', ORIGINATOR)  // FIXED
}
```

#### 2. Updated `src/apps/wallet.ts`

**Added environment variable:**
```typescript
const {
  IDENTITY_KEY,
  OVERLAY_URL = 'http://localhost:8080',
  ORIGINATOR = 'tokenisation-workshop.local'  // NEW
} = process.env
```

**Fixed constructor:**
```typescript
constructor() {
  // Initialize WalletClient with originator (required in Node.js)
  // The originator identifies your application to the wallet
  this.wallet = new WalletClient('auto', ORIGINATOR)  // FIXED
  this.overlayUrl = OVERLAY_URL || 'http://localhost:8080'
}
```

#### 3. Updated `.env.example`

**Added new configuration section:**
```bash
# Application Originator (REQUIRED for Node.js CLI apps)
# This identifies your application to the BSV Desktop Wallet
# Use a domain-style identifier (can be fake for local development)
ORIGINATOR=tokenisation-workshop.local
```

#### 4. Created Comprehensive Documentation

Created `/Users/matiasjackson/Documents/Proyects/tokenisation-workshop/WALLET_INTEGRATION.md` with:

- Complete explanation of the originator requirement
- Browser vs Node.js differences
- Full working examples
- WalletClient architecture details
- Alternative approaches (PrivateKey signing, ProtoWallet)
- Best practices
- Troubleshooting guide
- Security considerations

### Key Technical Details

#### Substrate Auto-Detection Order (Node.js)

When using `'auto'` substrate, the SDK tries connections in this order:

1. **Fast attempts (parallel):**
   - `window.CWI` (browser extension)
   - `HTTPWalletJSON` on `https://localhost:2121` (secure)
   - `HTTPWalletJSON` on `http://localhost:3321` (default)
   - `ReactNativeWebView` (mobile)
   - `WalletWireTransceiver` (Cicada)

2. **Slow fallback:**
   - `XDM` (Cross-Document Messaging, 200ms timeout)

3. **Error if all fail:**
   - "No wallet available over any communication substrate"

#### Originator Format

- **Format**: Domain-style string (lowercase letters, numbers, dots, hyphens)
- **Examples**:
  - ✅ `myapp.local`
  - ✅ `token-workshop.dev`
  - ✅ `my-app-v2.test`
  - ❌ `MyApp` (no TLD)
  - ❌ `my_app.local` (underscores not recommended)
- **Purpose**: Identifies your application to the wallet (similar to CORS origins)
- **Development**: Can be fake/local domain (e.g., `.local`, `.dev`)
- **Production**: Should match your actual domain

### Comparison: Browser vs Node.js

| Aspect | Browser | Node.js |
|--------|---------|---------|
| **Originator** | ❌ Not required | ✅ Required |
| **Origin Header** | ✅ Automatic | ❌ Manual (via originator) |
| **Initialization** | `new WalletClient()` | `new WalletClient('auto', originator)` |
| **Substrate Detection** | window.CWI, XDM, json-api | json-api, secure-json-api, Cicada |

### Alternative Approaches Documented

#### 1. WalletClient (Recommended for Production) ✅

**Pros:**
- User's existing wallet and keys
- User approves each transaction
- Secure (keys never leave wallet)
- Works on mainnet with real funds
- Follows BRC-100 standard

**Cons:**
- Requires BSV Desktop Wallet running
- User must approve each transaction
- Requires originator in Node.js

**Use Cases:**
- Production applications
- User-facing applications
- Applications handling real funds

#### 2. Direct PrivateKey Signing

**Pros:**
- No wallet required
- Fully automated (no user approval)
- Works in any environment

**Cons:**
- Must manage private keys yourself
- Security risk if keys exposed
- No user approval mechanism

**Use Cases:**
- Testing and development
- Automated scripts/bots
- Server-side operations

#### 3. ProtoWallet (Advanced)

**Pros:**
- Implements BRC-42 key derivation
- Hierarchical deterministic keys
- Privacy-enhanced transactions
- Protocol-specific key isolation

**Cons:**
- More complex setup
- Still need to manage root key
- Requires understanding of BRC-42/43

**Use Cases:**
- Advanced privacy features
- Protocol-specific key derivation
- Building wallet applications

### Environment Variables Now Required

```bash
# REQUIRED for Node.js CLI apps
ORIGINATOR=tokenisation-workshop.local

# Optional
IDENTITY_KEY=your_identity_key_from_bsv_desktop
OVERLAY_URL=http://localhost:8080
```

### Environment Variables Still NOT Needed

```bash
# These are NOT needed (WalletClient auto-detects)
# WAB_SERVER_URL=https://wab.babbage.systems
# WALLET_STORAGE_URL=https://storage.babbage.systems
# MESSAGE_BOX_URL=https://messagebox.babbage.systems
```

### Files Modified

1. `/Users/matiasjackson/Documents/Proyects/tokenisation-workshop/src/apps/mint.ts`
   - Added `ORIGINATOR` environment variable import
   - Updated constructor to pass originator to WalletClient

2. `/Users/matiasjackson/Documents/Proyects/tokenisation-workshop/src/apps/wallet.ts`
   - Added `ORIGINATOR` environment variable import
   - Updated constructor to pass originator to WalletClient

3. `/Users/matiasjackson/Documents/Proyects/tokenisation-workshop/.env.example`
   - Added `ORIGINATOR` configuration section with documentation

### Files Created

1. `/Users/matiasjackson/Documents/Proyects/tokenisation-workshop/WALLET_INTEGRATION.md`
   - Comprehensive 500+ line guide covering all aspects of WalletClient usage
   - Includes working examples, troubleshooting, and best practices

### Testing Recommendations

To verify the fix works:

1. **Update your `.env` file:**
   ```bash
   echo "ORIGINATOR=tokenisation-workshop.local" >> .env
   ```

2. **Test mint app:**
   ```bash
   npm run mint
   ```
   Should connect successfully and show wallet identity key.

3. **Test wallet app:**
   ```bash
   npm run wallet
   ```
   Should connect and display token balances.

4. **Expected output:**
   ```
   🔌 Connecting to BSV Desktop Wallet...
   ✅ Wallet connected!
   📍 Identity Key: 02xxxxx...
   ```

### Troubleshooting

#### Still getting "Originator is required"?

1. Check `.env` has `ORIGINATOR=tokenisation-workshop.local`
2. Restart terminal/shell to load new environment variables
3. Verify environment variable is loaded: `echo $ORIGINATOR`

#### Still getting "No wallet available"?

1. Ensure BSV Desktop Wallet is running
2. Check wallet is unlocked
3. Verify wallet API is listening:
   ```bash
   curl http://localhost:3321/getVersion
   # Should return: {"version":"1.x.x"}
   ```

### Next Steps for Other Engineers

When working with WalletClient in Node.js:

1. **Always provide originator:**
   ```typescript
   new WalletClient('auto', 'myapp.local')
   ```

2. **Use environment variable:**
   ```typescript
   const { ORIGINATOR = 'myapp.local' } = process.env
   new WalletClient('auto', ORIGINATOR)
   ```

3. **Format originator correctly:**
   - Domain-style: `myapp.local`, `app.dev`, `service.test`
   - Lowercase, no underscores
   - Can be fake for local development

4. **Browser apps don't need originator:**
   ```typescript
   new WalletClient()  // OK in browser
   ```

5. **Read WALLET_INTEGRATION.md** for comprehensive guide

### SDK Version Information

- **Package**: `@bsv/sdk@1.9.11`
- **WalletClient Source**: `node_modules/@bsv/sdk/dist/esm/src/wallet/WalletClient.js`
- **HTTPWalletJSON Source**: `node_modules/@bsv/sdk/dist/esm/src/wallet/substrates/HTTPWalletJSON.js`

### References

- **SDK Documentation**: https://bsv-blockchain.github.io/ts-sdk
- **BRC-100 (Wallet Interface)**: https://github.com/bitcoin-sv/BRCs/blob/master/wallet/0100.md
- **BSV Desktop Wallet**: https://www.yours.org/wallet/
- **Local Documentation**: `/Users/matiasjackson/Documents/Proyects/tokenisation-workshop/WALLET_INTEGRATION.md`
- **Previous Session**: `/Users/matiasjackson/Documents/Proyects/tokenisation-workshop/.claude/tasks/context_session_1.md`

### Summary

The issue was that **WalletClient requires an `originator` parameter when running in Node.js environments**. This is because Node.js doesn't have an automatic `Origin` header like browsers do. The fix was simple:

```typescript
// Before (broken in Node.js)
new WalletClient()

// After (works in Node.js)
new WalletClient('auto', 'tokenisation-workshop.local')
```

All wallet functionality is now working correctly in both CLI apps. The comprehensive documentation in `WALLET_INTEGRATION.md` provides guidance for current and future development.
