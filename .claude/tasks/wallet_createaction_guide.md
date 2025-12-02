# BSV Desktop Wallet `createAction` - Complete Reference Guide

## Problem You Encountered

**HTTP 500 Error** when calling `createAction` with 0-satoshi OP_RETURN outputs.

## Root Causes Identified

1. **Zero satoshi outputs** - BSV Desktop Wallet requires minimum 1 satoshi for OP_RETURN outputs
2. **Misunderstanding of `inputs` parameter** - It's not basket-based, it's an array of explicit outpoints

## Correct `createAction` Format

### Minimum Valid Call (Recommended)

```typescript
const createResult = await wallet.createAction({
  outputs: [{
    lockingScript: scriptHex,
    satoshis: 1,                    // Minimum 1 satoshi for OP_RETURN
    outputDescription: 'Description'
  }],
  description: 'Transaction description'
  // Wallet automatically selects UTXOs and creates change
})
```

### Full Parameter Reference

```typescript
interface CreateActionArgs {
  // Required: Transaction description (5-50 characters)
  description: string
  
  // Optional: BEEF data for input transactions
  inputBEEF?: number[]
  
  // Optional: Explicit inputs (array of outpoints)
  inputs?: Array<{
    outpoint: string              // Format: "txid.outputIndex"
    inputDescription: string      // 5-50 characters
    unlockingScript?: string      // Hex string (optional)
    unlockingScriptLength?: number
    sequenceNumber?: number
  }>
  
  // Optional: Transaction outputs
  outputs?: Array<{
    lockingScript: string         // Hex-encoded locking script
    satoshis: number              // Output amount (min 1 for OP_RETURN)
    outputDescription: string     // 5-50 characters
    basket?: string               // Basket name for tracking this output
    customInstructions?: string
    tags?: string[]
  }>
  
  // Optional: Additional parameters
  lockTime?: number
  version?: number
  labels?: string[]
  options?: {
    signAndProcess?: boolean
    acceptDelayedBroadcast?: boolean
    trustSelf?: 'known'
    knownTxids?: string[]
    returnTXIDOnly?: boolean
    noSend?: boolean
    noSendChange?: string[]
    sendWith?: string[]
    randomizeOutputs?: boolean
  }
}
```

## How UTXO Selection Works

### Automatic Selection (When inputs omitted)

When you **don't specify `inputs`**, the wallet automatically:

1. **Selects UTXOs** from available balance to cover:
   - Sum of all output satoshis
   - Transaction fee (calculated by size)
2. **Creates change output** if selected UTXOs exceed requirements
3. **Handles signing** and broadcasts to network

```typescript
// Wallet automatically handles everything
await wallet.createAction({
  outputs: [{
    lockingScript: script.toHex(),
    satoshis: 1,
    outputDescription: 'Token output'
  }],
  description: 'Mint token'
})

// Result: Wallet selects UTXOs, creates change, signs, broadcasts
```

### Manual Selection (When inputs specified)

When you **do specify `inputs`**, you're explicitly choosing which UTXOs to use:

```typescript
await wallet.createAction({
  inputs: [{
    outpoint: '7a1e5c...abc.0',  // Specific UTXO to spend
    inputDescription: 'My UTXO'
  }],
  outputs: [{
    lockingScript: script.toHex(),
    satoshis: 1,
    outputDescription: 'Token output'
  }],
  description: 'Mint token'
})

// Result: Wallet uses ONLY specified UTXO, you must ensure it has enough funds
```

## Important: Baskets Are NOT For Input Selection

**Common Misconception:**
```typescript
// ❌ WRONG - This format doesn't exist
inputs: {
  default: { satoshis: 1000 }
}
```

**Correct Understanding:**
- **Baskets** are used for **OUTPUT tracking** (where to store received UTXOs)
- **Inputs** are explicit outpoint references (which UTXOs to spend)
- For automatic UTXO selection, **omit `inputs` entirely**

```typescript
// ✅ CORRECT - Let wallet select UTXOs automatically
await wallet.createAction({
  outputs: [{
    lockingScript: script.toHex(),
    satoshis: 1,
    outputDescription: 'Token output',
    basket: 'tokens'  // ← Basket specifies WHERE to track this output
  }],
  description: 'Mint token'
  // No inputs = wallet selects automatically from available UTXOs
})
```

## Satoshi Requirements

### OP_RETURN Outputs

**Minimum: 1 satoshi** (not 0)

```typescript
// ❌ WRONG - May cause HTTP 500
{
  lockingScript: opReturnScript.toHex(),
  satoshis: 0,
  outputDescription: 'Token'
}

// ✅ CORRECT
{
  lockingScript: opReturnScript.toHex(),
  satoshis: 1,  // Minimum 1 satoshi
  outputDescription: 'Token'
}
```

### P2PKH Payment Outputs

**Any amount >= 1 satoshi**

```typescript
{
  lockingScript: p2pkhScript.toHex(),
  satoshis: 10000,  // 0.0001 BSV payment
  outputDescription: 'Payment'
}
```

## Response Format

### Success Response (Automatic Broadcast)

```typescript
{
  txid: '7a1e5c...',              // Transaction ID
  tx: [0x01, 0x00, ...],          // Raw transaction (Atomic BEEF format)
  // No signableTransaction means already signed and broadcast
}
```

### Success Response (Manual Signing Required)

```typescript
{
  signableTransaction: {
    tx: [0x01, 0x00, ...],        // Raw transaction (Atomic BEEF)
    reference: 'abc123...'        // Reference for signing
  }
  // No txid means needs signing
}
```

Then sign with:
```typescript
const signResult = await wallet.signAction({
  spends: {},
  reference: createResult.signableTransaction.reference
})
// signResult.txid will contain the transaction ID after signing
```

## Common Issues and Solutions

### Issue 1: HTTP 500 Error

**Symptom:** Server error when calling `createAction`

**Possible Causes & Solutions:**

1. **Zero satoshi OP_RETURN output**
   - Solution: Use `satoshis: 1` (minimum)

2. **Description too short or too long**
   - Solution: Use 5-50 characters for `description`
   - Solution: Use 5-50 characters for `outputDescription`

3. **Invalid locking script format**
   - Solution: Ensure script is valid hex string
   - Solution: Use `Script.toHex()` to get proper format

4. **Wallet connection issue**
   - Solution: Ensure BSV Desktop Wallet is running and unlocked
   - Solution: Check originator is correctly specified

### Issue 2: Insufficient Funds

**Symptom:** "Not enough funds" or similar error

**Solutions:**

1. **Check wallet balance** - Ensure you have BSV for outputs + fees
2. **Reduce output amounts** - Lower the satoshi amounts in outputs
3. **Fund wallet** - Add more BSV to your wallet

### Issue 3: Type Errors with inputs

**Symptom:** TypeScript error `'default' does not exist in type 'CreateActionInput[]'`

**Cause:** Using incorrect basket-style syntax

**Solution:** Either omit `inputs` or use proper array format:
```typescript
// ✅ Option 1: Omit inputs (recommended)
await wallet.createAction({
  outputs: [...],
  description: '...'
})

// ✅ Option 2: Explicit inputs
await wallet.createAction({
  inputs: [{
    outpoint: 'txid.0',
    inputDescription: 'My input'
  }],
  outputs: [...],
  description: '...'
})
```

### Issue 4: Transaction Rejected by User

**Symptom:** User rejects signing dialog in wallet

**Solution:**
- Ensure clear, descriptive `description` text
- User must approve transaction in wallet UI
- Handle rejection gracefully in your code

## Working Examples

### Example 1: Token Minting (OP_RETURN)

```typescript
import { WalletClient, Script, Utils } from '@bsv/sdk'

const wallet = new WalletClient('auto', 'myapp.local')

// Create OP_RETURN script
const tokenScript = Script.fromASM([
  'OP_FALSE',
  'OP_RETURN',
  Utils.toHex(Utils.toArray('TOKEN', 'utf8')),
  Utils.toHex(tokenId),
  Utils.toHex(amountBuffer),
  Utils.toHex(Utils.toArray(JSON.stringify(metadata), 'utf8'))
].join(' '))

// Create and broadcast transaction
const result = await wallet.createAction({
  outputs: [{
    lockingScript: tokenScript.toHex(),
    satoshis: 1,                      // Minimum 1 satoshi
    outputDescription: 'Token mint'
  }],
  description: `Mint ${metadata.name}`
})

console.log('Transaction ID:', result.txid)
```

### Example 2: Token Transfer (Multiple Outputs)

```typescript
const recipientScript = createTokenScript(tokenId, transferAmount)
const changeScript = createTokenScript(tokenId, changeAmount)

const result = await wallet.createAction({
  outputs: [
    {
      lockingScript: recipientScript.toHex(),
      satoshis: 1,
      outputDescription: 'Token to recipient'
    },
    {
      lockingScript: changeScript.toHex(),
      satoshis: 1,
      outputDescription: 'Token change'
    }
  ],
  description: `Transfer ${transferAmount} tokens`
})
```

### Example 3: P2PKH Payment

```typescript
import { P2PKH } from '@bsv/sdk'

const p2pkh = new P2PKH()
const lockingScript = p2pkh.lock(recipientAddress)

const result = await wallet.createAction({
  outputs: [{
    lockingScript: lockingScript.toHex(),
    satoshis: 10000,  // 0.0001 BSV
    outputDescription: 'Payment'
  }],
  description: 'Send payment'
})
```

### Example 4: Mixed Outputs (Payment + Data)

```typescript
const p2pkhScript = new P2PKH().lock(recipientAddress)
const dataScript = Script.fromASM([
  'OP_FALSE',
  'OP_RETURN',
  Utils.toHex(Utils.toArray('Hello BSV', 'utf8'))
].join(' '))

const result = await wallet.createAction({
  outputs: [
    {
      lockingScript: p2pkhScript.toHex(),
      satoshis: 5000,
      outputDescription: 'Payment'
    },
    {
      lockingScript: dataScript.toHex(),
      satoshis: 1,
      outputDescription: 'Data'
    }
  ],
  description: 'Payment with message'
})
```

### Example 5: Explicit Input Selection (Advanced)

```typescript
// Get available UTXOs first (using listOutputs or similar)
const utxos = await wallet.listOutputs({
  basket: 'default',
  limit: 10
})

// Select specific UTXO
const selectedUtxo = utxos[0]

const result = await wallet.createAction({
  inputs: [{
    outpoint: `${selectedUtxo.txid}.${selectedUtxo.vout}`,
    inputDescription: 'Selected UTXO'
  }],
  outputs: [{
    lockingScript: script.toHex(),
    satoshis: 1,
    outputDescription: 'Token'
  }],
  description: 'Mint with specific UTXO'
})
```

### Example 6: Using Baskets for Output Tracking

```typescript
const result = await wallet.createAction({
  outputs: [{
    lockingScript: tokenScript.toHex(),
    satoshis: 1,
    outputDescription: 'New token',
    basket: 'tokens',              // Track in 'tokens' basket
    tags: ['mint', 'testnet']      // Add tags for filtering
  }],
  description: 'Mint token',
  labels: ['workshop', 'demo']     // Transaction-level labels
})

// Later, list outputs from this basket
const tokenUtxos = await wallet.listOutputs({
  basket: 'tokens'
})
```

## Fee Calculation

BSV Desktop Wallet automatically:
- Calculates required fee based on transaction size
- Uses ~0.5 sat/byte for mainnet (configurable)
- Selects enough UTXOs to cover outputs + fee
- Creates change output for excess satoshis

**Typical fees:**
- Simple transaction (1 input, 2 outputs): ~100-200 sats
- Token mint (1 input, 1 OP_RETURN, 1 change): ~150-250 sats
- Token transfer (1 input, 2 OP_RETURN, 1 change): ~200-300 sats

## Best Practices

1. **Use automatic UTXO selection** - Omit `inputs` unless you need specific UTXOs
2. **Minimum 1 satoshi for OP_RETURN** - Never use 0 satoshis
3. **Clear descriptions** - Help users understand what they're approving
4. **Handle both response types** - Check for both `txid` and `signableTransaction`
5. **Error handling** - Catch and handle rejections/insufficient funds
6. **Test on testnet first** - Before deploying to mainnet
7. **Keep descriptions short** - 5-50 characters for both description and outputDescription
8. **Use baskets for organization** - Track different token types in different baskets

## BRC Standards

This implementation follows:
- **BRC-100**: Wallet-to-Application Interface specification
- **BRC-29**: Simple P2PKH payment protocol
- **BRC-62**: BEEF format for transaction data
- **BRC-43**: Security levels and protocol IDs
- **BRC-83**: Scalable transaction processing

## Additional Resources

- **BSV SDK Documentation**: https://bsv-blockchain.github.io/ts-sdk
- **BRC-100 Specification**: https://github.com/bitcoin-sv/BRCs/blob/master/wallet/0100.md
- **BSV Desktop Wallet**: https://github.com/bitcoin-sv/bsv-wallet
- **BRC Standards**: https://github.com/bitcoin-sv/BRCs

## Quick Reference

| Task | Solution |
|------|----------|
| Basic transaction | Omit `inputs`, let wallet select UTXOs |
| OP_RETURN output | Use `satoshis: 1` (minimum) |
| P2PKH payment | Use `satoshis: amount` (any value >= 1) |
| Track in basket | Add `basket: 'name'` to output |
| Specific UTXO | Provide `inputs: [{ outpoint: 'txid.vout', ... }]` |
| Multiple outputs | Array of outputs, wallet handles change |
| Check result | If `txid` exists, already broadcast; if `signableTransaction`, needs signing |
