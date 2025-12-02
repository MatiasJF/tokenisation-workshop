# Token Protocol Specification

## Overview

This document describes the token protocol used in the workshop, based on BRC-48 PushDrop format.

## Transaction Output Structure

### Complete Output

```
┌─────────────────────────────────────────────────────────────┐
│                     Transaction Output                       │
├─────────────────────────────────────────────────────────────┤
│  Satoshis: 0 (unspendable, data-only output)               │
│  Locking Script:                                            │
│    OP_FALSE (0x00)                                          │
│    OP_RETURN (0x6a)                                         │
│    <protocol>  ← Field 0: 'TOKEN' (UTF-8)                  │
│    <tokenId>   ← Field 1: 32 bytes (hex)                   │
│    <amount>    ← Field 2: 8 bytes (little-endian integer)  │
│    <metadata>  ← Field 3: JSON string (optional)           │
└─────────────────────────────────────────────────────────────┘
```

## Field Specifications

### Field 0: Protocol Identifier

**Purpose**: Identify this as a token output

```
Type: UTF-8 String
Value: 'TOKEN'
Encoding: Bytes [0x54, 0x4f, 0x4b, 0x45, 0x4e]
Validation: Must match exactly 'TOKEN'
```

**Example**:
```javascript
Utils.toArray('TOKEN', 'utf8')
// [84, 79, 75, 69, 78]
```

### Field 1: Token ID

**Purpose**: Unique identifier for the token type

```
Type: Hex String
Size: Exactly 32 bytes (64 hex characters)
Generation: hash256(publicKey + timestamp)
Validation: Must be exactly 32 bytes
```

**Example**:
```javascript
const tokenId = 'a1b2c3d4e5f6789abcdef0123456789abcdef0123456789abcdef0123456789a'
Utils.toArray(tokenId, 'hex')
// [161, 178, 195, 212, 229, 246, ... ] (32 bytes)
```

**Generation Algorithm**:
```javascript
function generateTokenId(privateKey: PrivateKey): string {
  const pubKey = privateKey.toPublicKey().toString()
  const timestamp = Date.now().toString()
  const combined = pubKey + timestamp
  const hash = Utils.hash256(Utils.toArray(combined, 'utf8'))
  return Utils.toHex(hash)
}
```

### Field 2: Amount

**Purpose**: Number of token units in this output

```
Type: Integer
Size: Exactly 8 bytes
Encoding: Little-endian (LSB first)
Range: 1 to 2^64-1 (0 reserved for future use like burning)
Validation: Must be > 0, exactly 8 bytes
```

**Encoding Algorithm**:
```javascript
function encodeAmount(amount: number): number[] {
  const buffer = new Array(8).fill(0)
  let remaining = amount

  for (let i = 0; i < 8; i++) {
    buffer[i] = remaining % 256
    remaining = Math.floor(remaining / 256)
  }

  return buffer
}
```

**Examples**:

| Decimal | Hex (LE) | Bytes |
|---------|----------|-------|
| 1 | 0x0100000000000000 | [1,0,0,0,0,0,0,0] |
| 1000 | 0xe803000000000000 | [232,3,0,0,0,0,0,0] |
| 1000000 | 0x40420f0000000000 | [64,66,15,0,0,0,0,0] |

**Decoding Algorithm**:
```javascript
function decodeAmount(buffer: number[]): number {
  let amount = 0
  for (let i = 0; i < 8; i++) {
    amount += buffer[i] * Math.pow(256, i)
  }
  return amount
}
```

### Field 3: Metadata (Optional)

**Purpose**: Human-readable token information

```
Type: JSON String
Size: Variable (practical limit ~1KB)
Encoding: UTF-8
Validation: Must be valid JSON if present
```

**Standard Schema**:
```json
{
  "name": "string",          // Human-readable name
  "symbol": "string",        // Ticker symbol (3-5 chars)
  "decimals": "number",      // Display decimal places (0-18)
  "description": "string",   // Optional description
  "totalSupply": "number",   // Initial supply (for reference)
  "icon": "string",          // Optional icon URL/data
  "website": "string",       // Optional project website
  "custom": "any"            // Custom fields allowed
}
```

**Example Metadata**:
```json
{
  "name": "Workshop Token",
  "symbol": "WST",
  "decimals": 6,
  "description": "Educational token for BSV workshop",
  "totalSupply": 1000000,
  "website": "https://example.com"
}
```

**Encoding**:
```javascript
const metadata = {
  name: "Workshop Token",
  symbol: "WST",
  decimals: 6
}
Utils.toArray(JSON.stringify(metadata), 'utf8')
```

## Complete Example

### Creating a Token Output

```typescript
import { Script, Utils } from '@bsv/sdk'

// Token parameters
const protocol = 'TOKEN'
const tokenId = 'a1b2c3d4e5f6789abcdef0123456789abcdef0123456789abcdef0123456789a'
const amount = 1000000  // 1 million tokens
const metadata = {
  name: "Workshop Token",
  symbol: "WST",
  decimals: 6,
  totalSupply: 1000000
}

// Encode amount (8 bytes, little-endian)
const amountBuffer = new Array(8).fill(0)
let remaining = amount
for (let i = 0; i < 8; i++) {
  amountBuffer[i] = remaining % 256
  remaining = Math.floor(remaining / 256)
}

// Create fields
const fields = [
  Utils.toArray(protocol, 'utf8'),          // 'TOKEN'
  Utils.toArray(tokenId, 'hex'),            // 32 bytes
  amountBuffer,                             // 8 bytes
  Utils.toArray(JSON.stringify(metadata), 'utf8')
]

// Build script
const script = Script.fromASM([
  'OP_FALSE',
  'OP_RETURN',
  ...fields.map(field => Utils.toHex(field))
].join(' '))

// Add to transaction
tx.addOutput({
  satoshis: 0,
  lockingScript: script
})
```

### Parsing a Token Output

```typescript
import { Transaction, PushDrop, Utils } from '@bsv/sdk'

// Parse transaction
const tx = Transaction.fromBEEF(beef)
const output = tx.outputs[0]

// Decode PushDrop
const result = PushDrop.decode({
  script: output.lockingScript.toHex(),
  fieldFormat: 'buffer'
})

// Extract fields
const protocol = Utils.toUTF8(result.fields[0])  // 'TOKEN'
const tokenId = Utils.toHex(result.fields[1])     // 64 hex chars
const amountBuffer = result.fields[2]             // 8 bytes

// Decode amount
let amount = 0
for (let i = 0; i < 8; i++) {
  amount += amountBuffer[i] * Math.pow(256, i)
}

// Parse metadata (if present)
let metadata = undefined
if (result.fields.length >= 4) {
  const metadataStr = Utils.toUTF8(result.fields[3])
  metadata = JSON.parse(metadataStr)
}

console.log({
  protocol,  // 'TOKEN'
  tokenId,   // 'a1b2c3d4...'
  amount,    // 1000000
  metadata   // { name: 'Workshop Token', ... }
})
```

## Validation Rules

### Validation Flow

```
1. Parse transaction from BEEF
   ↓
2. For each output:
   ↓
3. Try to decode as PushDrop
   ↓ (if fails, skip)
4. Check field count ≥ 3
   ↓ (if fails, skip)
5. Validate Field 0 = 'TOKEN'
   ↓ (if fails, skip)
6. Validate Field 1 = 32 bytes
   ↓ (if fails, skip)
7. Validate Field 2 = 8 bytes, > 0
   ↓ (if fails, skip)
8. If Field 3 exists, validate JSON
   ↓ (if fails, skip)
9. Accept output ✓
```

### Validation Code

```typescript
async identifyAdmissibleOutputs(
  beef: number[],
  previousCoins: number[]
): Promise<AdmittanceInstructions> {
  const outputsToAdmit: number[] = []

  try {
    const tx = Transaction.fromBEEF(beef)

    for (let i = 0; i < tx.outputs.length; i++) {
      try {
        const output = tx.outputs[i]

        // Decode PushDrop
        const result = PushDrop.decode({
          script: output.lockingScript.toHex(),
          fieldFormat: 'buffer'
        })

        // Must have at least 3 fields
        if (result.fields.length < 3) continue

        // Field 0: Protocol
        const protocol = Utils.toUTF8(result.fields[0] as number[])
        if (protocol !== 'TOKEN') continue

        // Field 1: Token ID (32 bytes)
        const tokenId = Utils.toHex(result.fields[1] as number[])
        if (tokenId.length !== 64) continue

        // Field 2: Amount (8 bytes, > 0)
        const amountBuffer = result.fields[2] as number[]
        if (amountBuffer.length !== 8) continue

        const amount = this.parseAmount(amountBuffer)
        if (amount <= 0) continue

        // Field 3: Metadata (optional, must be valid JSON)
        if (result.fields.length >= 4) {
          try {
            const metadata = Utils.toUTF8(result.fields[3] as number[])
            JSON.parse(metadata)
          } catch {
            continue  // Invalid JSON
          }
        }

        // All validations passed
        outputsToAdmit.push(i)

      } catch {
        // Skip invalid outputs silently
        continue
      }
    }
  } catch (error) {
    console.error('Error processing transaction:', error)
  }

  return {
    outputsToAdmit,
    coinsToRetain: []
  }
}
```

## Token Operations

### Operation 1: Minting (Creating New Tokens)

**Description**: Create initial supply of a new token type

**Requirements**:
- Generate unique tokenId (32 bytes)
- Specify totalSupply in metadata
- Create single output with full supply

**Transaction Structure**:
```
Inputs:
  - [Bitcoin UTXOs for fees]

Outputs:
  - Token output (0 sats):
      OP_RETURN 'TOKEN' <tokenId> <totalSupply> <metadata>
  - Change output (P2PKH):
      Remaining satoshis back to minter
```

**Example**:
```typescript
const tokenId = generateTokenId(privateKey)
const totalSupply = 1000000

const tokenOutput = {
  satoshis: 0,
  lockingScript: createTokenScript(tokenId, totalSupply, {
    name: "My Token",
    symbol: "MTK",
    decimals: 6,
    totalSupply: totalSupply
  })
}
```

### Operation 2: Transferring Tokens

**Description**: Send tokens to another user

**Requirements**:
- Spend existing token UTXOs (inputs)
- Create token output for recipient
- Create change output if needed

**Transaction Structure**:
```
Inputs:
  - Token UTXO(s): Previous token outputs to spend
  - [Bitcoin UTXOs for fees]

Outputs:
  - Recipient token output (0 sats):
      OP_RETURN 'TOKEN' <tokenId> <amount>
  - Change token output (0 sats):
      OP_RETURN 'TOKEN' <tokenId> <changeAmount>
  - Bitcoin change output (P2PKH):
      Remaining satoshis
```

**Example**:
```typescript
// Transfer 100 tokens, have 500 total
const inputAmount = 500
const transferAmount = 100
const changeAmount = 400

tx.addInput({...})  // Spend token UTXO

tx.addOutput({      // Recipient
  satoshis: 0,
  lockingScript: createTokenScript(tokenId, transferAmount)
})

tx.addOutput({      // Change back to sender
  satoshis: 0,
  lockingScript: createTokenScript(tokenId, changeAmount)
})
```

### Operation 3: Burning (Future)

**Description**: Permanently remove tokens from supply

**Proposal**:
```
Amount: 0 (special value for burn)
Metadata: { action: 'burn', amount: <burned> }
```

**Not yet implemented** - reserved for future extension

## Display Formatting

### Handling Decimals

Tokens can specify decimal places for display:

```typescript
function formatAmount(amount: number, decimals: number): string {
  const divisor = Math.pow(10, decimals)
  const display = amount / divisor
  return display.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })
}

// Examples:
formatAmount(1000000, 0)  // "1,000,000"
formatAmount(1000000, 2)  // "10,000.00"
formatAmount(1000000, 6)  // "1.000000"
```

### Token Balance Display

```
Token: Workshop Token (WST)
  ID: a1b2c3d4e5f6789a...
  Balance: 1.000000 WST
  Raw Amount: 1000000
  Decimals: 6
  UTXOs: 3
```

## Security Considerations

### Token ID Collisions

**Risk**: Two tokens with same ID
**Mitigation**: Include timestamp + publicKey in hash
**Probability**: Astronomically low (2^256 space)

### Amount Overflow

**Risk**: Amount exceeds 8-byte integer
**Mitigation**: Validation rejects > 2^64-1
**JavaScript**: Use BigInt for very large amounts

### Metadata Injection

**Risk**: Malicious JSON in metadata
**Mitigation**: JSON.parse validation, display sanitization

### Transaction Malleability

**Risk**: Modifying amounts after broadcast
**Mitigation**: Blockchain immutability, signature verification

## Best Practices

### For Token Creators
1. Choose clear, unique names
2. Use standard symbols (3-5 characters)
3. Document decimals clearly
4. Include website/contact in metadata
5. Test on testnet first

### For Wallet Developers
1. Always validate all fields
2. Use BigInt for large amounts
3. Sanitize metadata for display
4. Cache token metadata
5. Handle decimals correctly

### For Overlay Operators
1. Index tokenId efficiently
2. Track spent status carefully
3. Validate before storing
4. Monitor database size
5. Backup regularly

## Testing

### Valid Token Output

```javascript
// Should be accepted
{
  protocol: 'TOKEN',
  tokenId: 'a1b2...6789',  // 32 bytes
  amount: 1000000,          // 8 bytes, > 0
  metadata: {
    name: 'Test',
    symbol: 'TST',
    decimals: 6
  }
}
```

### Invalid Examples

```javascript
// Wrong protocol
{ protocol: 'TOEKN', ... }  // ❌ Typo

// Short tokenId
{ tokenId: 'abc123', ... }  // ❌ Only 3 bytes

// Zero amount
{ amount: 0, ... }          // ❌ Must be > 0

// Invalid JSON
{ metadata: '{name:test}' } // ❌ Not valid JSON
```

## Future Extensions

### Proposed Features
1. **Burning**: Amount=0 with burn metadata
2. **Minting Rights**: Signature-based minting authority
3. **Freezing**: Temporary transfer restrictions
4. **Dividends**: Distribution to holders
5. **Governance**: Voting weights

### Backward Compatibility
All extensions should:
- Keep fields 0-3 unchanged
- Add new fields after field 3
- Remain optional (old clients ignore)
- Maintain validation rules

## References

- [BRC-48: PushDrop Protocol](https://brc.dev/48)
- [BSV SDK Documentation](https://docs.bsvblockchain.org/sdk/)
- [Overlay Services](https://github.com/bitcoin-sv/overlay-services)

---

This protocol provides a simple, extensible foundation for fungible tokens on BSV, suitable for educational purposes and real-world applications.
