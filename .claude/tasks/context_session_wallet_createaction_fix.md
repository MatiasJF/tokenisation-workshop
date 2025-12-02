# Context: WalletClient createAction Error Fix

## Issue Summary
User encountered "Cannot read properties of undefined (reading 'trim')" error when calling `wallet.createAction()` in Node.js app using WalletClient.

## Root Cause
The `CreateActionOutput` interface requires three properties, but the user's code was only providing two:

### User's Code (Incorrect):
```typescript
const createResult = await this.wallet.createAction({
  outputs: [
    {
      satoshis: 0,
      script: tokenScript.toHex()  // ❌ Wrong property name
      // ❌ Missing outputDescription
    }
  ],
  description: `Mint ${metadata.name} (${metadata.symbol})`
})
```

### Required Interface (from @bsv/sdk):
```typescript
export interface CreateActionOutput {
  lockingScript: HexString              // ✅ Required
  satoshis: SatoshiValue                 // ✅ Required
  outputDescription: DescriptionString5to50Bytes  // ✅ Required (5-2000 chars)
  basket?: BasketStringUnder300Bytes     // Optional
  customInstructions?: string            // Optional
  tags?: OutputTagStringUnder300Bytes[]  // Optional
}
```

## Error Location
The error occurred in `/Users/matiasjackson/Documents/Proyects/tokenisation-workshop/node_modules/@bsv/sdk/src/wallet/validationHelpers.ts`:

```typescript
export function validateCreateActionOutput (o: CreateActionOutput): ValidCreateActionOutput {
  const vo: ValidCreateActionOutput = {
    lockingScript: validateHexString(o.lockingScript, 'lockingScript'),
    satoshis: validateSatoshis(o.satoshis, 'satoshis'),
    outputDescription: validateStringLength(o.outputDescription, 'outputDescription', 5, 2000), // ← trim() called here
    // ...
  }
  return vo
}
```

When `outputDescription` is undefined, `validateStringLength()` tries to call `.trim()` on undefined, causing the error.

## Solution

### Correct Format for createAction():
```typescript
const createResult = await this.wallet.createAction({
  outputs: [
    {
      lockingScript: tokenScript.toHex(),  // ✅ Correct property name
      satoshis: 0,                         // ✅ 0 is valid for OP_RETURN
      outputDescription: 'Token output'    // ✅ Required (5-50 chars recommended)
    }
  ],
  description: `Mint ${metadata.name} (${metadata.symbol})`  // ✅ Required (5-50 chars)
})
```

## Files to Update

### 1. /Users/matiasjackson/Documents/Proyects/tokenisation-workshop/src/apps/mint.ts
- Line 140-148: Fix the `createAction` call in `mint()` method

### 2. /Users/matiasjackson/Documents/Proyects/tokenisation-workshop/src/apps/wallet.ts
- Line 258-261: Fix the `createAction` call in `transfer()` method

## Key Takeaways

1. **Property Name**: Use `lockingScript` not `script` (BSV SDK uses proper terminology)
2. **Required Fields**: Always include `outputDescription` for outputs (5-2000 characters)
3. **Description Length**: Keep descriptions between 5-50 characters for best compatibility
4. **Zero Satoshis**: OP_RETURN outputs can have 0 satoshis (valid)
5. **Hex Format**: The script hex format is correct when using `Script.toHex()`

## Related Files
- CreateActionOutput interface: `node_modules/@bsv/sdk/src/wallet/Wallet.interfaces.ts` (lines 267-274)
- Validation logic: `node_modules/@bsv/sdk/src/wallet/validationHelpers.ts`
- Token minting app: `src/apps/mint.ts`
- Token wallet app: `src/apps/wallet.ts`

## Status
✅ Root cause identified
✅ Implementation completed

## Changes Applied

### 1. Fixed mint.ts (lines 140-149)
**Before:**
```typescript
const createResult = await this.wallet.createAction({
  outputs: [
    {
      satoshis: 0,
      script: tokenScript.toHex()  // ❌ Wrong property name
      // ❌ Missing outputDescription
    }
  ],
  description: `Mint ${metadata.name} (${metadata.symbol})`
})
```

**After:**
```typescript
const createResult = await this.wallet.createAction({
  outputs: [
    {
      lockingScript: tokenScript.toHex(),  // ✅ Correct property name
      satoshis: 0,
      outputDescription: 'Token mint output'  // ✅ Added required field
    }
  ],
  description: `Mint ${metadata.name} (${metadata.symbol})`
})
```

### 2. Fixed wallet.ts (lines 237-263)
**Before:**
```typescript
outputs.push({
  satoshis: 0,
  script: recipientScript.toHex()  // ❌ Wrong property name
  // ❌ Missing outputDescription
})
```

**After:**
```typescript
outputs.push({
  lockingScript: recipientScript.toHex(),  // ✅ Correct property name
  satoshis: 0,
  outputDescription: 'Token transfer output'  // ✅ Added required field
})
```

## Testing Steps
1. Run `npm run mint` - should create token transactions without errors
2. Run `npm run wallet` - should transfer tokens without errors
3. Verify transactions appear on blockchain explorer

### 3. Fixed signAction API usage (both files)
The `signAction` API has changed in the newer SDK version:

**Old API (incorrect):**
```typescript
await this.wallet.signAction({
  inputs: createResult.inputs || {},  // ❌ Wrong property
  createResult: createResult,         // ❌ No longer exists
  accept: true,                       // ❌ No longer exists
  description: `...`                  // ❌ No longer exists
})
```

**New API (correct):**
```typescript
// Check if auto-signed
if (createResult.txid) {
  // Transaction already signed and broadcast
  return createResult.txid
} else if (createResult.signableTransaction) {
  // Manual signing required
  const signResult = await this.wallet.signAction({
    spends: {},  // ✅ Unlocking scripts per input (empty for wallet-managed)
    reference: createResult.signableTransaction.reference  // ✅ Reference from createAction
  })
  return signResult.txid
}
```

## Additional Notes
- The BSV SDK uses proper Bitcoin terminology: `lockingScript` instead of `scriptPubKey`
- All outputs in `createAction` must have an `outputDescription` (5-2000 characters)
- OP_RETURN outputs with 0 satoshis are valid according to the SDK
- The description helps wallets display transaction purposes to users
- When no inputs are provided, the wallet automatically selects and signs inputs
- `createResult.txid` is present when transaction is auto-signed
- `createResult.signableTransaction` is present when manual signing is required
- The `signAction` API changed from object-based to reference-based
