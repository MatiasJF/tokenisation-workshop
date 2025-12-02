# Quick Fix for HTTP 500 Error

## The Problem
```
HTTP Client error 500 when calling createAction
```

## The Fix (2 Simple Changes)

### Change 1: Use 1 Satoshi Instead of 0

```typescript
// ❌ BEFORE (causes HTTP 500)
{
  lockingScript: tokenScript.toHex(),
  satoshis: 0,  // ← This causes the error
  outputDescription: 'Token mint output'
}

// ✅ AFTER (works correctly)
{
  lockingScript: tokenScript.toHex(),
  satoshis: 1,  // ← Minimum 1 satoshi required
  outputDescription: 'Token mint output'
}
```

### Change 2: Don't Specify inputs

```typescript
// ❌ BEFORE (incorrect syntax)
await wallet.createAction({
  outputs: [...],
  description: '...',
  inputs: {
    default: { satoshis: 1000 }  // ← This format doesn't exist
  }
})

// ✅ AFTER (let wallet auto-select)
await wallet.createAction({
  outputs: [...],
  description: '...'
  // ← No inputs parameter = wallet selects UTXOs automatically
})
```

## Complete Working Example

```typescript
import { WalletClient, Script, Utils } from '@bsv/sdk'

const wallet = new WalletClient('auto', 'myapp.local')

// Create token script
const tokenScript = Script.fromASM([
  'OP_FALSE',
  'OP_RETURN',
  Utils.toHex(Utils.toArray('TOKEN', 'utf8')),
  Utils.toHex(tokenId),
  Utils.toHex(amountBuffer),
  Utils.toHex(Utils.toArray(JSON.stringify(metadata), 'utf8'))
].join(' '))

// Create transaction (correct way)
const result = await wallet.createAction({
  outputs: [{
    lockingScript: tokenScript.toHex(),
    satoshis: 1,  // ✅ 1. Use 1 satoshi
    outputDescription: 'Token mint output'
  }],
  description: `Mint token`
  // ✅ 2. No inputs parameter
})

console.log('Success! TXID:', result.txid)
```

## Why This Works

1. **1 satoshi minimum**: BSV Desktop Wallet requires OP_RETURN outputs to have at least 1 satoshi
2. **Automatic UTXO selection**: When you don't specify `inputs`, the wallet:
   - Automatically selects UTXOs from your balance
   - Calculates the required fee
   - Creates a change output
   - Signs and broadcasts the transaction

## Test It

```bash
npm run mint
```

You should now see:
- ✅ No HTTP 500 error
- ✅ Transaction created successfully
- ✅ TXID displayed

## Cost

For a token mint transaction:
- Output: 1 satoshi (goes to OP_RETURN output)
- Fee: ~150-250 satoshis (paid to miners)
- **Total cost: ~200-300 satoshis** (≈ $0.0001 USD)

The wallet will automatically select UTXOs to cover this and return the change to you.

## Files Changed

1. `src/apps/mint.ts` - Lines 144, 148-150
2. `src/apps/wallet.ts` - Lines 239, 248, 262-264

Both files now use the correct format shown above.
