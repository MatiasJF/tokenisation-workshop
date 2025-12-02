# BSV Desktop Wallet Integration - Troubleshooting Guide

## HTTP 500 Error Checklist

If you get an HTTP 500 error from BSV Desktop Wallet, check these items:

### ✅ 1. Minimum Satoshi Requirement
```typescript
// ❌ Wrong - causes HTTP 500
satoshis: 0

// ✅ Correct
satoshis: 1  // Minimum 1 satoshi for OP_RETURN
```

### ✅ 2. Don't Use Basket-Style inputs
```typescript
// ❌ Wrong - this format doesn't exist
inputs: {
  default: { satoshis: 1000 }
}

// ✅ Correct - omit inputs entirely
// No inputs parameter = automatic UTXO selection
```

### ✅ 3. Description Length
```typescript
// ❌ Too short (less than 5 characters)
description: 'Mint'

// ✅ Correct (5-50 characters)
description: 'Mint token'
```

### ✅ 4. Output Description Length
```typescript
// ❌ Too short
outputDescription: 'Out'

// ✅ Correct (5-50 characters)
outputDescription: 'Token mint output'
```

### ✅ 5. Valid Locking Script
```typescript
// ✅ Ensure script is valid hex string
lockingScript: tokenScript.toHex()  // Use .toHex() method
```

### ✅ 6. Wallet Connection
- Ensure BSV Desktop Wallet is running
- Unlock your wallet if it's locked
- Check originator is specified correctly:
```typescript
const wallet = new WalletClient('auto', 'myapp.local')
```

### ✅ 7. Sufficient Balance
- Your wallet needs BSV for:
  - Output amounts (1 satoshi per OP_RETURN)
  - Transaction fees (~150-300 satoshis)
- Check balance: Should have at least 500-1000 satoshis available

## Other Common Errors

### "Not enough funds" / Insufficient Balance

**Symptoms:**
- Error message about insufficient funds
- Transaction creation fails

**Solutions:**
1. Check wallet balance (needs ~500+ satoshis minimum)
2. Fund your wallet with BSV
3. Wait for pending transactions to confirm

### TypeScript Type Errors

**Error:** `'default' does not exist in type 'CreateActionInput[]'`

**Cause:** Using incorrect inputs syntax

**Solution:**
```typescript
// ❌ Remove this
inputs: {
  default: { satoshis: 1000 }
}

// ✅ Use this (omit inputs)
// Let wallet auto-select
```

### Transaction Rejected by User

**Symptoms:**
- "User rejected" or "User denied" error
- Transaction doesn't complete

**Solutions:**
1. Check transaction details in BSV Desktop Wallet UI
2. Approve the transaction when prompted
3. Ensure description is clear so user knows what they're approving

### Connection Refused / Wallet Not Found

**Symptoms:**
- "Failed to connect to BSV Desktop Wallet"
- Connection timeout errors

**Solutions:**
1. Start BSV Desktop Wallet application
2. Unlock the wallet (enter password)
3. Check wallet is on correct network (mainnet/testnet)
4. Verify originator is set in code

### signableTransaction Returned Instead of txid

**Symptoms:**
- Result contains `signableTransaction` but no `txid`
- Transaction not automatically broadcast

**This is not an error!** Handle it:
```typescript
if (createResult.txid) {
  // Transaction auto-signed and broadcast
  console.log('TXID:', createResult.txid)
} else if (createResult.signableTransaction) {
  // Transaction needs signing
  const signResult = await wallet.signAction({
    spends: {},
    reference: createResult.signableTransaction.reference
  })
  console.log('TXID:', signResult.txid)
}
```

## Pre-Flight Checklist

Before running `npm run mint`:

- [ ] BSV Desktop Wallet is running
- [ ] Wallet is unlocked (password entered)
- [ ] Wallet has BSV balance (500+ satoshis minimum)
- [ ] Code uses `satoshis: 1` for OP_RETURN outputs
- [ ] Code does NOT include incorrect `inputs` parameter
- [ ] Descriptions are 5-50 characters
- [ ] Originator is specified in WalletClient constructor
- [ ] Network matches (mainnet/testnet)

## Debugging Commands

### Check Wallet Balance
```bash
npm run check-balance
```

### Test Basic Connection
```typescript
const wallet = new WalletClient('auto', 'myapp.local')
const keyResult = await wallet.getPublicKey({ identityKey: true })
console.log('Connected! Identity Key:', keyResult.publicKey)
```

### Verify Transaction Structure
```typescript
console.log('Transaction outputs:', JSON.stringify(outputs, null, 2))
console.log('Description length:', description.length)
```

## Getting Help

If you're still having issues:

1. **Check the error message** - It often indicates the specific problem
2. **Review the code examples** in `.claude/tasks/wallet_createaction_guide.md`
3. **Verify BSV SDK version**: Should be 1.8.2 or higher
4. **Check network configuration**: Ensure NETWORK env variable matches wallet network
5. **Review logs**: BSV Desktop Wallet may have additional error details

## Quick Test

Run this minimal test to verify wallet connection:

```typescript
import { WalletClient } from '@bsv/sdk'

async function test() {
  const wallet = new WalletClient('auto', 'test.local')
  
  try {
    const key = await wallet.getPublicKey({ identityKey: true })
    console.log('✅ Wallet connected!')
    console.log('Identity Key:', key.publicKey)
  } catch (error) {
    console.error('❌ Connection failed:', error.message)
  }
}

test()
```

If this works, your wallet connection is good. If not, check:
- BSV Desktop Wallet is running
- Wallet is unlocked
- Originator format is correct

## Summary of Changes Made

To fix the HTTP 500 error, we changed:

**mint.ts:**
- Line 144: `satoshis: 0` → `satoshis: 1`
- Removed lines 149-155: incorrect `inputs` parameter

**wallet.ts:**
- Line 239: `satoshis: 0` → `satoshis: 1`
- Line 248: `satoshis: 0` → `satoshis: 1`
- Removed lines 263-269: incorrect `inputs` parameter

These changes allow BSV Desktop Wallet to:
- Accept valid 1-satoshi OP_RETURN outputs
- Automatically select UTXOs for funding
- Calculate and pay appropriate fees
- Create change outputs automatically
