# HTTP 500 Error Fix - Final Solution Summary

## Problem
HTTP 500 error from BSV Desktop Wallet when calling `createAction` for token minting and transfers.

## Root Causes

1. **Zero satoshi OP_RETURN outputs** - BSV Desktop Wallet requires minimum 1 satoshi
2. **Misunderstood `inputs` parameter** - Initially tried basket-based syntax which doesn't exist

## Solution

### Change 1: Use 1 Satoshi for OP_RETURN Outputs

**Before:**
```typescript
satoshis: 0
```

**After:**
```typescript
satoshis: 1  // BSV requires minimum 1 satoshi for OP_RETURN outputs
```

### Change 2: Remove inputs Parameter (Let Wallet Auto-Select)

**Before:**
```typescript
inputs: {
  default: { satoshis: 1000 }  // ❌ This format doesn't exist
}
```

**After:**
```typescript
// ✅ Omit inputs entirely - wallet automatically selects UTXOs
```

## Files Modified

1. **`/Users/matiasjackson/Documents/Proyects/tokenisation-workshop/src/apps/mint.ts`**
   - Line 144: Changed `satoshis: 0` to `satoshis: 1`
   - Line 148-150: Removed incorrect `inputs` parameter

2. **`/Users/matiasjackson/Documents/Proyects/tokenisation-workshop/src/apps/wallet.ts`**
   - Line 239: Changed `satoshis: 0` to `satoshis: 1` (recipient output)
   - Line 248: Changed `satoshis: 0` to `satoshis: 1` (change output)
   - Line 262-264: Removed incorrect `inputs` parameter

## How It Works Now

```typescript
// Token minting
const result = await wallet.createAction({
  outputs: [{
    lockingScript: tokenScript.toHex(),
    satoshis: 1,  // ✅ Minimum 1 satoshi
    outputDescription: 'Token mint output'
  }],
  description: `Mint ${metadata.name}`
  // ✅ Wallet automatically:
  //    - Selects UTXOs from balance
  //    - Calculates fee
  //    - Creates change output
  //    - Signs and broadcasts
})
```

## Testing

```bash
npm run mint
```

**Expected Result:**
- ✅ No HTTP 500 error
- ✅ Transaction creates successfully
- ✅ Wallet may prompt for approval
- ✅ Transaction broadcasts to blockchain
- ✅ TXID returned and displayed

## Key Learnings

### 1. Automatic UTXO Selection
When `inputs` is omitted, BSV Desktop Wallet automatically handles:
- UTXO selection from available balance
- Fee calculation based on transaction size
- Change output creation
- Transaction signing and broadcast

### 2. Minimum Satoshi Requirement
OP_RETURN outputs must have at least 1 satoshi to be valid transactions.

### 3. Correct inputs Interface
The `inputs` parameter is **NOT** basket-based. It's an array of explicit outpoints:

```typescript
// ✅ CORRECT (when needed)
inputs: [{
  outpoint: 'txid.outputIndex',
  inputDescription: 'My input'
}]

// ❌ WRONG
inputs: {
  default: { satoshis: 1000 }
}
```

For most use cases, **omit inputs entirely** and let the wallet handle it.

## BRC Standards Applied

- **BRC-100**: Wallet-to-Application Interface (correct createAction format)
- **BRC-29**: Simple P2PKH payment protocol
- **BRC-62**: BEEF format for transaction packages
- **BRC-83**: Scalable transaction processing

## Additional Documentation

- **`.claude/tasks/context_session_1.md`** - Full technical analysis and solution details
- **`.claude/tasks/wallet_createaction_guide.md`** - Complete `createAction` reference guide with examples

## Verification

✅ TypeScript compilation successful (no errors)
✅ Correct SDK interface types used
✅ Follows BSV Desktop Wallet best practices
✅ Minimum satoshi requirement met

## Quick Reference

| Issue | Solution |
|-------|----------|
| HTTP 500 error | Use `satoshis: 1` for OP_RETURN outputs |
| Type error with inputs | Omit `inputs` parameter for automatic selection |
| Zero satoshi outputs | Change to minimum 1 satoshi |
| Basket-based inputs | Not supported - omit inputs or use outpoint array |

## Next Steps

1. Ensure BSV Desktop Wallet is running and unlocked
2. Run `npm run mint` to test token minting
3. Approve transaction in wallet when prompted
4. Verify transaction on blockchain explorer
5. Test token transfers with `npm run wallet`
