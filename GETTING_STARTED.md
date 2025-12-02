# Getting Started - How to Use This Workshop

This guide walks you through using the tokenization workshop from scratch.

## Step 1: Start Your Databases

First, make sure Docker Desktop is running, then start your existing databases:

```bash
# Check if they're already running
docker ps | grep -E "(mongo|mysql)"

# If not running, start them
docker start db-mongo db-mysql

# Verify they're up
docker ps | grep -E "(mongo|mysql)"
```

You should see both `db-mongo` and `db-mysql` in the output.

## Step 2: Start the Overlay Server

Open a terminal in the workshop directory and start the server:

```bash
cd /Users/matiasjackson/Documents/Proyects/tokenisation-workshop

# Start the overlay server (will auto-reload on file changes)
npm run dev
```

**What to expect:**
```
🚀 Starting Tokenisation Workshop Overlay Server...
tokenworkshop constructed 🎉
🌐 Server port set to 8080
📦 Knex successfully configured.
✓ MySQL/Knex connected
🍃 MongoDB successfully configured and connected.
✓ MongoDB connected
🗂️ Configured topic manager tm_tokens
🔍 Configured lookup service ls_tokens with MongoDB
✓ Token service registered
🔄 GASP synchronization disabled.
🚀 Engine has been configured.

✨ Tokenisation Workshop Server Running!

🌐 Overlay URL: http://localhost:8080
📦 Node Name: tokenworkshop
🎯 Services: Token Mint & Wallet

Available Services:
  - Token Topic Manager: tm_tokens
  - Token Lookup Service: ls_tokens

Health Check: http://localhost:8080/health
```

**Test it works:**
```bash
# In another terminal
curl http://localhost:8080/health
```

Should return:
```json
{
  "status": "healthy",
  "node": "tokenworkshop",
  "services": ["tokens"],
  "timestamp": "2025-12-01T18:00:00.000Z"
}
```

**Leave this terminal running!** The overlay server needs to stay up.

## Step 3: Mint Your First Token

Open a **NEW terminal** (keep the overlay server running in the first one):

```bash
cd /Users/matiasjackson/Documents/Proyects/tokenisation-workshop

# Run the mint app
npm run mint
```

**You'll see an interactive prompt:**

```
╔════════════════════════════════════════╗
║     BSV Token Minting Workshop         ║
║     Simple Fungible Token Creator      ║
╚════════════════════════════════════════╝

Token Name:
```

**Example interaction:**

```
Token Name: Workshop Coin
Token Symbol: WSC
Decimals (default 0): 2
Total Supply: 1000000
Description (optional): My first BSV token for learning
```

**What happens:**
1. Generates a unique 32-byte token ID
2. Creates token metadata
3. Builds a transaction with OP_RETURN output
4. Shows you the token ID and transaction structure

**Expected output:**
```
🪙  Minting new token...
Token ID: a1b2c3d4e5f6789abcdef0123456789abcdef0123456789abcdef0123456789a

✓ Token script created
  Name: Workshop Coin
  Symbol: WSC
  Decimals: 2
  Total Supply: 1000000

╔════════════════════════════════════════╗
║          Minting Successful!           ║
╚════════════════════════════════════════╝

Token ID: a1b2c3d4e5f6789abcdef0123456789abcdef0123456789abcdef0123456789a
Transaction ID: tx_abc123...

Note: This is a workshop example. In production:
- Use proper wallet UTXO management
- Broadcast to ARC network
- Implement fee calculation
- Add proper error handling
```

**Important:** Copy the Token ID - you'll need it for the wallet!

## Step 4: Use the Wallet

Open **ANOTHER new terminal** (keep both the overlay server and mint app terminals):

```bash
cd /Users/matiasjackson/Documents/Proyects/tokenisation-workshop

# Run the wallet app
npm run wallet
```

**You'll see a menu:**

```
╔════════════════════════════════════════╗
║      BSV Token Wallet Workshop         ║
║      Transfer & View Balances          ║
╚════════════════════════════════════════╝

Address: 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa
Overlay: http://localhost:8080

Options:
  1. View Balances
  2. Transfer Tokens
  3. Exit

Choice:
```

### View Your Balances

```
Choice: 1
```

**Expected output:**

```
💰 Fetching token balances...

╔═══════════════════════════════════════════════════╗
║              Token Balances                       ║
╚═══════════════════════════════════════════════════╝

Token: Workshop Coin (WSC)
  ID: a1b2c3d4e5f6789abcdef0123456789abcdef0123456789abcdef0123456789a
  Balance: 10,000.00
  UTXOs: 1
  Decimals: 2
```

### Transfer Tokens

```
Choice: 2
```

**You'll be prompted:**

```
Token ID: a1b2c3d4e5f6789abcdef0123456789abcdef0123456789abcdef0123456789a
Amount: 50000
Recipient Address: 1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2
```

**Expected output:**

```
📤 Transferring tokens...
  Token ID: a1b2c3d4...
  Amount: 50000
  To: 1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2

✓ Transaction created
  Inputs: 1000000
  To recipient: 50000
  Change: 950000

✓ Transfer successful!
  Transaction: tx_def456...

Note: This is a workshop example showing transaction structure.
```

## What's Actually Happening?

### Behind the Scenes Flow

```
1. Mint App creates token
   ↓
2. Transaction output format:
   OP_0 OP_RETURN 'TOKEN' <tokenId> <amount> <metadata>
   ↓
3. (In production: Broadcast to BSV blockchain)
   ↓
4. Overlay server detects transaction
   ↓
5. TokenTopicManager validates:
   - Protocol = 'TOKEN'
   - Token ID = 32 bytes
   - Amount = 8 bytes, > 0
   - Metadata = valid JSON
   ↓
6. If valid → Admitted to overlay
   ↓
7. TokenLookupService stores in MongoDB:
   - txid, outputIndex
   - tokenId, amount, metadata
   - lockingScript, satoshis
   ↓
8. Wallet queries overlay for balances
   ↓
9. Overlay returns UTXOs for that tokenId
   ↓
10. Wallet displays formatted balances
```

## Understanding the Components

### 1. Overlay Server (Terminal 1)

**What it does:**
- Validates token transactions
- Stores token data in MongoDB
- Provides query API for wallets
- Tracks UTXOs and spent status

**Files:**
- `src/index.ts` - Server setup
- `src/services/token/TokenTopicManager.ts` - Validation
- `src/services/token/TokenLookupService.ts` - Queries
- `src/services/token/TokenStorageManager.ts` - Database

### 2. Mint App (Terminal 2)

**What it does:**
- Interactive token creation
- Generates unique token IDs
- Builds proper OP_RETURN outputs
- Shows transaction structure

**Files:**
- `src/apps/mint.ts`

**Key code:**
```typescript
// Generate unique token ID
const tokenId = hash256(publicKey + timestamp)

// Create OP_RETURN output
OP_0 OP_RETURN 'TOKEN' <tokenId> <amount> <metadata>
```

### 3. Wallet App (Terminal 3)

**What it does:**
- Queries overlay for balances
- Displays token holdings
- Creates transfer transactions
- Shows UTXO management

**Files:**
- `src/apps/wallet.ts`

**Key operations:**
```typescript
// Query overlay
POST http://localhost:8080/lookup
{
  service: 'ls_tokens',
  query: { type: 'balances' }
}

// Get UTXOs for spending
POST http://localhost:8080/lookup
{
  service: 'ls_tokens',
  query: { type: 'utxos', tokenId: '...' }
}
```

## Workshop vs Production

### What This Workshop Does ✅

- Shows proper token protocol format
- Demonstrates overlay validation
- Illustrates UTXO management
- Explains transaction structure
- Teaches query patterns

### What's Missing for Production ⚠️

1. **Real Wallet Integration**
   - No actual UTXO fetching from blockchain
   - No transaction signing with real keys
   - No fee calculation

2. **Broadcasting**
   - Transactions aren't sent to BSV network
   - No ARC integration
   - No confirmation tracking

3. **Security**
   - Basic key management
   - No authentication on APIs
   - Simple error handling

4. **Features**
   - No access controls
   - No token burning
   - No multi-signature
   - No advanced metadata

## Next Steps

### Learn More

1. **Explore the Code:**
   ```bash
   # Open in your editor
   code /Users/matiasjackson/Documents/Proyects/tokenisation-workshop

   # Key files to study:
   # - src/services/token/TokenTopicManager.ts (validation)
   # - src/services/token/TokenLookupService.ts (queries)
   # - src/apps/mint.ts (token creation)
   # - src/apps/wallet.ts (wallet operations)
   ```

2. **Read Documentation:**
   - `README.md` - Complete reference
   - `ARCHITECTURE.md` - System design
   - `PROTOCOL.md` - Token format details

3. **Experiment:**
   - Create multiple token types
   - Mint different amounts
   - Try different decimals
   - Add custom metadata fields

### Extend the Workshop

Try these exercises:

**Easy:**
1. Modify token metadata to include icon URL
2. Add a "list all tokens" command to wallet
3. Create tokens with different decimal places

**Medium:**
1. Add transaction history viewing
2. Implement a "burn" operation (amount = 0)
3. Add validation for maximum supply

**Advanced:**
1. Integrate real ARC broadcasting
2. Add proper UTXO fetching from blockchain
3. Implement multi-signature token transfers
4. Build a web UI for the wallet

## Troubleshooting

### Overlay server won't start

```bash
# Check databases are running
docker ps | grep -E "(mongo|mysql)"

# Check port 8080 is free
lsof -i :8080

# Kill any process on 8080
lsof -ti :8080 | xargs kill -9

# Restart
npm run dev
```

### Can't see balances

1. Make sure overlay server is running
2. Check MongoDB is connected
3. Verify you minted tokens first
4. Check the token ID matches

### Database connection errors

```bash
# Restart databases
docker restart db-mongo db-mysql

# Check they're healthy
docker ps | grep -E "(mongo|mysql)"
```

## Quick Reference

### Terminal Setup

```
Terminal 1: npm run dev           # Overlay server
Terminal 2: npm run mint          # Create tokens
Terminal 3: npm run wallet        # View/transfer tokens
```

### Key Commands

```bash
# Server
npm run dev                       # Start with hot-reload
npm start                         # Production mode
curl http://localhost:8080/health # Health check

# Apps
npm run mint                      # Create new tokens
npm run wallet                    # Wallet operations

# Utilities
node scripts/generate-keys.js     # Generate private keys
docker start db-mongo db-mysql    # Start databases
docker ps                         # Check databases running
```

### Important Files

```
.env                    # Configuration (keys, URLs)
src/index.ts           # Overlay server
src/apps/mint.ts       # Mint app
src/apps/wallet.ts     # Wallet app
src/services/token/    # Token service logic
```

## Example Session

Here's a complete example workflow:

```bash
# Terminal 1 - Start overlay
$ npm run dev
# Wait for "Server Running!" message

# Terminal 2 - Mint tokens
$ npm run mint
Token Name: TestCoin
Token Symbol: TST
Decimals: 0
Total Supply: 1000
Description: Test token

# Copy the Token ID from output
# Token ID: abc123...

# Terminal 3 - Check balance
$ npm run wallet
Choice: 1
# See your TestCoin balance: 1000

# Terminal 3 - Transfer some
Choice: 2
Token ID: abc123...
Amount: 100
Recipient: 1ABC...
# Transfer successful!

# Check balance again
Choice: 1
# Balance now: 900 (sent 100)
```

## Summary

You now know how to:
- ✅ Start the overlay server
- ✅ Mint new tokens
- ✅ View token balances
- ✅ Transfer tokens
- ✅ Understand the architecture
- ✅ Extend the workshop

**Ready to tokenize on BSV!** 🚀

For questions or issues, check:
- README.md for detailed reference
- ARCHITECTURE.md for system design
- PROTOCOL.md for token format specs
