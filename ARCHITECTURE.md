# Architecture Overview

## System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    BSV Blockchain                            │
│  (Immutable ledger with token transaction outputs)          │
└────────────────┬────────────────────────────┬────────────────┘
                 │                            │
                 │ Broadcast TX               │ Monitor TX
                 │                            │
        ┌────────▼────────┐         ┌─────────▼──────────┐
        │   ARC Network   │         │  Overlay Service   │
        │  (Broadcasting) │         │   (Validation &    │
        └─────────────────┘         │    Indexing)       │
                                    └─────────┬──────────┘
                                              │
                              ┌───────────────┼───────────────┐
                              │               │               │
                    ┌─────────▼────┐  ┌──────▼──────┐  ┌────▼─────┐
                    │ Topic Manager │  │  Lookup     │  │ Storage  │
                    │  (Validates)  │  │  Service    │  │ Manager  │
                    └───────────────┘  │  (Queries)  │  │ (MongoDB)│
                                       └──────┬──────┘  └──────────┘
                                              │
                              ┌───────────────┼───────────────┐
                              │               │               │
                    ┌─────────▼────┐  ┌──────▼──────┐
                    │  Mint App    │  │ Wallet App  │
                    │  (Create)    │  │ (Transfer)  │
                    └──────────────┘  └─────────────┘
```

## Data Flow

### 1. Minting Flow

```
User Input (Mint App)
    │
    ├─► Generate Token ID (32 bytes from pubkey + timestamp)
    │
    ├─► Create Transaction
    │   ├─► Add token output (OP_RETURN with protocol data)
    │   └─► Add change output (P2PKH)
    │
    ├─► Sign Transaction
    │
    └─► Broadcast to BSV
        │
        └─► ARC Network
            │
            └─► Blockchain Confirmation
                │
                └─► Overlay detects transaction
                    │
                    ├─► Topic Manager validates
                    │   ├─► Parse BEEF format
                    │   ├─► Decode PushDrop fields
                    │   ├─► Validate protocol = 'TOKEN'
                    │   ├─► Validate tokenId (32 bytes)
                    │   ├─► Validate amount (8 bytes, > 0)
                    │   └─► Validate metadata (JSON)
                    │
                    └─► If valid, admit to overlay
                        │
                        └─► Lookup Service stores
                            └─► MongoDB
```

### 2. Balance Query Flow

```
User Request (Wallet App)
    │
    └─► Query Overlay
        │
        ├─► POST /lookup
        │   {
        │     service: 'ls_tokens',
        │     query: { type: 'balances' }
        │   }
        │
        └─► Lookup Service
            │
            ├─► Query MongoDB
            │   └─► Find unspent outputs by tokenId
            │
            └─► Return balance
                {
                  tokenId, name, symbol, decimals,
                  totalAmount, utxos[]
                }
```

### 3. Transfer Flow

```
User Input (Wallet App)
    │
    ├─► Get UTXOs for tokenId from Overlay
    │
    ├─► Select UTXOs to spend (input amount >= transfer amount)
    │
    ├─► Create Transaction
    │   ├─► Add inputs (spent token UTXOs)
    │   ├─► Add output for recipient (token amount)
    │   └─► Add change output (remaining tokens)
    │
    ├─► Sign Transaction
    │
    └─► Broadcast to BSV
        │
        └─► Overlay validates & admits
            │
            ├─► Mark input UTXOs as spent
            └─► Store new output UTXOs
```

## Component Details

### Overlay Server (`src/index.ts`)

**Responsibilities:**
- Initialize OverlayExpress framework
- Connect to MongoDB (lookup data) and MySQL (overlay engine)
- Register Topic Manager and Lookup Service
- Expose REST API endpoints

**Key Technologies:**
- `@bsv/overlay-express` - Overlay framework
- MongoDB - Token data storage
- MySQL - Overlay engine internals

### Token Topic Manager (`TokenTopicManager.ts`)

**Responsibilities:**
- Validate incoming transactions
- Parse BEEF format
- Decode PushDrop outputs
- Apply protocol rules

**Protocol Rules:**
```typescript
1. Field[0] must be 'TOKEN' (UTF-8)
2. Field[1] must be 32 bytes (tokenId)
3. Field[2] must be 8 bytes, > 0 (amount)
4. Field[3] optional, must be valid JSON (metadata)
```

**Interface:**
```typescript
interface TopicManager {
  identifyAdmissibleOutputs(
    beef: number[],
    previousCoins: number[]
  ): Promise<AdmittanceInstructions>
}
```

### Token Lookup Service (`TokenLookupService.ts`)

**Responsibilities:**
- Handle token lifecycle events
- Process queries
- Coordinate with Storage Manager

**Events:**
- `outputAdmittedByTopic()` - New token created/transferred
- `outputSpent()` - Token UTXO consumed
- `outputEvicted()` - Token removed from overlay

**Query Types:**
- `balance` - Get balance for specific tokenId
- `balances` - Get all token balances
- `history` - Get transaction history
- `utxos` - Get unspent outputs for spending

### Token Storage Manager (`TokenStorageManager.ts`)

**Responsibilities:**
- MongoDB CRUD operations
- Index management
- Balance calculations

**Schema:**
```typescript
interface TokenRecord {
  txid: string
  outputIndex: number
  tokenId: string
  amount: number
  metadata?: {
    name: string
    symbol: string
    decimals: number
    description?: string
  }
  lockingScript: string
  satoshis: number
  createdAt: Date
  spent: boolean
}
```

**Indexes:**
```typescript
{ txid: 1, outputIndex: 1 }  // Unique
{ tokenId: 1 }                // Fast token lookup
{ tokenId: 1, spent: 1 }      // Balance queries
{ spent: 1 }                  // Cleanup queries
```

### Mint App (`mint.ts`)

**Responsibilities:**
- Interactive CLI for token creation
- Generate unique token IDs
- Create token output scripts
- Display transaction details

**Token ID Generation:**
```typescript
hash256(publicKey + timestamp) → 32 bytes
```

**Output Script:**
```
OP_FALSE OP_RETURN
  'TOKEN'           // Protocol identifier
  <tokenId>         // 32 bytes
  <amount>          // 8 bytes, little-endian
  <metadata>        // JSON string
```

### Wallet App (`wallet.ts`)

**Responsibilities:**
- View token balances
- Transfer tokens
- Query overlay for UTXOs
- Create transfer transactions

**Features:**
- Interactive CLI menu
- Balance display with formatting
- UTXO management
- Change calculation

## Token Protocol Specification

### Output Format (BRC-48 PushDrop)

```
OP_0 OP_RETURN <field0> <field1> <field2> [<field3>]
```

| Field | Name | Type | Size | Description |
|-------|------|------|------|-------------|
| 0 | Protocol | UTF-8 | Variable | Must be 'TOKEN' |
| 1 | Token ID | Hex | 32 bytes | Unique identifier |
| 2 | Amount | Integer | 8 bytes | Token units (little-endian) |
| 3 | Metadata | JSON | Variable | Optional token info |

### Amount Encoding

8-byte little-endian integer:

```typescript
const buffer = new Array(8).fill(0)
let remaining = amount
for (let i = 0; i < 8; i++) {
  buffer[i] = remaining % 256
  remaining = Math.floor(remaining / 256)
}
```

### Metadata Schema

```json
{
  "name": "Token Name",
  "symbol": "TKN",
  "decimals": 6,
  "description": "Optional description",
  "totalSupply": 1000000,
  "custom": "Any additional fields"
}
```

### Validation Rules

1. **Protocol Field**: Must be exactly 'TOKEN' (UTF-8)
2. **Token ID**: Must be exactly 32 bytes hex
3. **Amount**: Must be 8 bytes, value > 0
4. **Metadata**: Must be valid JSON if present
5. **Output Type**: Must be OP_RETURN (unspendable)

## Security Considerations

### Key Management
- Private keys stored in environment variables
- Never commit keys to version control
- Use separate keys for different purposes
- In production: Hardware wallets, KMS

### Transaction Validation
- Topic Manager validates all fields
- Reject malformed outputs silently
- No exceptions thrown during validation
- Prevent injection via metadata

### Database Security
- MongoDB indexes for performance
- Unique constraints on (txid, outputIndex)
- Input validation before storage
- Connection pooling with limits

### API Security
- Admin token for protected endpoints
- Rate limiting (production)
- Input sanitization
- CORS configuration

## Scalability Patterns

### Database Optimization
```typescript
// Indexes for fast queries
await collection.createIndex({ tokenId: 1, spent: 1 })

// Compound queries
await collection.find({ tokenId: 'xxx', spent: false })

// Aggregation for balances
await collection.aggregate([
  { $match: { spent: false } },
  { $group: { _id: '$tokenId', total: { $sum: '$amount' } } }
])
```

### Caching Strategy
- Cache token metadata (rarely changes)
- Cache balance aggregations (invalidate on new TX)
- Redis for distributed caching (production)

### Connection Pooling
```typescript
// MySQL
connectionLimit: 10,
queueLimit: 0

// MongoDB
maxPoolSize: 10,
minPoolSize: 2
```

## Extension Points

### Adding New Features

1. **Token Burning**
   ```typescript
   // Add to protocol: amount = 0 for burn
   if (amount === 0 && metadata.action === 'burn') {
     // Process burn logic
   }
   ```

2. **Access Control**
   ```typescript
   // Add signature verification
   const signature = result.fields[4]
   if (!verifyOwnerSignature(tokenId, signature)) {
     continue // Reject
   }
   ```

3. **NFT Support**
   ```typescript
   // Add NFT protocol
   protocol: 'NFT'
   tokenId: 32 bytes
   nftId: 32 bytes (unique per token)
   metadata: { uri, traits, ... }
   ```

4. **Dividends**
   ```typescript
   // Query all holders
   const holders = await storage.getHolders(tokenId)

   // Create dividend TX
   for (const holder of holders) {
     const share = holder.amount / totalSupply
     // Create output for holder
   }
   ```

## Testing Strategy

### Unit Tests
- Topic Manager validation logic
- Storage Manager CRUD operations
- Amount encoding/decoding
- Metadata parsing

### Integration Tests
- Overlay server startup
- Database connections
- Transaction admission
- Query responses

### End-to-End Tests
- Mint → Query → Transfer flow
- Error handling
- Transaction broadcasting
- Balance updates

## Monitoring & Observability

### Metrics to Track
- Transaction admission rate
- Query latency
- Database connection pool usage
- Error rates by type

### Logging
```typescript
console.log(`✓ Token admitted: ${tokenId} amount=${amount}`)
console.log(`✓ Token spent: ${txid}:${outputIndex}`)
console.error('Error processing transaction:', error)
```

### Health Checks
```typescript
GET /health
{
  status: 'healthy',
  node: 'tokenworkshop',
  services: ['tokens'],
  timestamp: '2025-12-01T00:00:00.000Z'
}
```

## Production Deployment

### Infrastructure
- Load balancer (Nginx, HAProxy)
- Multiple overlay nodes (horizontal scaling)
- Database replication (MongoDB replica set)
- Redis cache cluster
- Monitoring (Prometheus, Grafana)

### Configuration
- HTTPS/TLS termination
- Rate limiting per IP
- Authentication middleware
- Request validation
- Error tracking (Sentry)

### Backup Strategy
- Automated MongoDB backups
- Point-in-time recovery
- Disaster recovery plan
- Data retention policies

---

This architecture provides a solid foundation for BSV tokenization while remaining simple enough for educational purposes. All components follow established patterns from the overlay-express-examples and can be extended for production use.
