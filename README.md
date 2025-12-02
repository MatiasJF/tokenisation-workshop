# BSV Tokenisation Workshop

A simple, educational implementation of fungible token minting and transfers on the BSV blockchain using overlays.

## 🚀 Quick Start

**New to this workshop?** → Read [BSV_DESKTOP_SETUP.md](BSV_DESKTOP_SETUP.md) for BSV Desktop Wallet setup!

**Prerequisites:**
- BSV Desktop Wallet running and unlocked (get it at https://yours.org/)
- BSV funds for transaction fees (~$0.01 per transaction)
- MongoDB and MySQL running

**Quick Start:**

1. **Terminal 1:** `npm run dev` (start overlay server)
2. **Terminal 2:** `npm run mint` (create real tokens on mainnet)
3. **Terminal 3:** `npm run wallet` (view/transfer tokens)

## Architecture

This workshop demonstrates three core components:

1. **Overlay Service** - Validates and tracks token transactions on the blockchain
2. **Mint App** - Creates new fungible tokens
3. **Wallet App** - Transfers tokens and views balances

### Design Philosophy

- **Simple & Clear**: Minimal code, maximum understanding
- **Lean Management**: No complex abstractions, direct BSV SDK usage
- **Educational**: Well-commented code showing token protocols
- **Production-Ready Patterns**: Real overlay architecture you can build on

## Project Structure

```
tokenisation-workshop/
├── src/
│   ├── index.ts                    # Overlay server entry point
│   ├── services/
│   │   └── token/
│   │       ├── TokenTopicManager.ts      # Validates token transactions
│   │       ├── TokenLookupService.ts     # Query token data
│   │       └── TokenStorageManager.ts    # MongoDB storage
│   └── apps/
│       ├── mint.ts                 # Token minting CLI
│       └── wallet.ts               # Token wallet CLI
├── package.json
├── tsconfig.json
└── .env                            # Configuration (create from .env.example)
```

## Token Protocol

Tokens are represented as OP_RETURN outputs with this format:

```
OP_0 OP_RETURN <protocol> <tokenId> <amount> [<metadata>]
```

### Fields

| Field | Type | Size | Description |
|-------|------|------|-------------|
| protocol | UTF-8 string | Variable | Always 'TOKEN' |
| tokenId | Hex string | 32 bytes | Unique token identifier |
| amount | Integer | 8 bytes | Token units (little-endian) |
| metadata | JSON | Variable | Optional token info (name, symbol, etc.) |

### Example Metadata

```json
{
  "name": "Workshop Token",
  "symbol": "WST",
  "decimals": 6,
  "description": "Example fungible token",
  "totalSupply": 1000000
}
```

## Setup

### Prerequisites

- Node.js 18+
- MongoDB (for token storage)
- MySQL (for overlay engine)
- **BSV Desktop Wallet** (download from https://yours.org/)
- BSV funds for transaction fees

### Installation

```bash
# Install dependencies
npm install

# Create environment configuration
cp .env.example .env

# Edit .env with your settings
nano .env
```

### Configuration

Edit `.env`:

```bash
# Your overlay node name
NODE_NAME=tokenworkshop

# BSV private key (hex) for the overlay server
SERVER_PRIVATE_KEY=your_32_byte_hex_key

# Where your overlay is hosted
HOSTING_URL=http://localhost:8080

# Database connections
MONGO_URL=mongodb://localhost:27017/tokenworkshop
KNEX_URL=mysql://root:password@localhost:3306/tokenworkshop

# BSV Desktop Wallet Configuration (REQUIRED for minting and transfers)
WAB_SERVER_URL=https://wab.babbage.systems
WALLET_STORAGE_URL=https://storage.babbage.systems
MESSAGE_BOX_URL=https://messagebox.babbage.systems
IDENTITY_KEY=your_identity_key_from_wallet

# Network (mainnet)
NETWORK=main
```

### Start Databases (Docker)

```bash
# Start MongoDB
docker run -d -p 27017:27017 --name mongo mongo:latest

# Start MySQL
docker run -d -p 3306:3306 --name mysql \
  -e MYSQL_ROOT_PASSWORD=password \
  -e MYSQL_DATABASE=tokenworkshop \
  mysql:latest
```

## Usage

### 1. Start the Overlay Server

```bash
npm run dev
```

This starts the overlay node on port 8080 with:
- Token Topic Manager (`tm_tokens`) - Validates token transactions
- Token Lookup Service (`ls_tokens`) - Queries token data

### 2. Mint New Tokens

**Important**: Make sure BSV Desktop Wallet is running and unlocked!

In a separate terminal:

```bash
npm run mint
```

Follow the interactive prompts:

```
Token Name: Workshop Token
Token Symbol: WST
Decimals (default 0): 6
Total Supply: 1000000
Description (optional): Example token for workshop
```

The mint app will:
1. Connect to your BSV Desktop Wallet
2. Generate a unique 32-byte token ID
3. Create a token output with metadata
4. Request your approval in BSV Desktop Wallet
5. Sign and broadcast the transaction to BSV mainnet
6. Display the transaction ID on WhatsOnChain

**This creates REAL tokens on the BSV blockchain!**

### 3. View Balances & Transfer Tokens

**Important**: Make sure BSV Desktop Wallet is running and unlocked!

```bash
npm run wallet
```

The wallet will:
1. Connect to your BSV Desktop Wallet
2. Display interactive menu

Menu options:
1. **View Balances** - Shows all tokens indexed by your overlay
2. **Transfer Tokens** - Send tokens to another address (requires wallet approval)
3. **Exit**

Example transfer:
```
Token ID: a1b2c3d4e5f6...
Amount: 50000
Recipient Address: 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa
```

The transfer will:
1. Create the token transfer transaction
2. Request your approval in BSV Desktop Wallet
3. Sign and broadcast to BSV mainnet
4. Show the transaction on WhatsOnChain

## API Reference

### Overlay Lookup Queries

The lookup service supports these query types:

#### Get Balance

```javascript
{
  type: 'balance',
  tokenId: 'a1b2c3d4...'
}
```

Returns:
```javascript
{
  type: 'output-list',
  outputs: [
    {
      txid: '...',
      outputIndex: 0,
      amount: 1000000,
      tokenId: '...',
      name: 'Workshop Token',
      symbol: 'WST',
      decimals: 6
    }
  ]
}
```

#### Get All Balances

```javascript
{
  type: 'balances'
}
```

Returns list of all token balances grouped by tokenId.

#### Get Transaction History

```javascript
{
  type: 'history',
  tokenId: 'a1b2c3d4...',
  limit: 50
}
```

#### Get UTXOs

```javascript
{
  type: 'utxos',
  tokenId: 'a1b2c3d4...'
}
```

Returns unspent token outputs for spending.

## BSV SDK Usage

This workshop demonstrates key BSV SDK patterns:

### Transaction Creation

```typescript
import { Transaction, Script, Utils } from '@bsv/sdk'

const tx = new Transaction()
tx.addOutput({
  satoshis: 0,
  lockingScript: tokenScript
})
```

### PushDrop Encoding (BRC-48)

```typescript
import { PushDrop } from '@bsv/sdk'

const result = PushDrop.decode({
  script: output.lockingScript.toHex(),
  fieldFormat: 'buffer'
})

const protocol = Utils.toUTF8(result.fields[0])
const tokenId = Utils.toHex(result.fields[1])
```

### BEEF Format

```typescript
const tx = Transaction.fromBEEF(beef)
```

### Keys and Addresses

```typescript
import { PrivateKey } from '@bsv/sdk'

const privateKey = PrivateKey.fromString(hex, 'hex')
const publicKey = privateKey.toPublicKey()
const address = publicKey.toAddress()
```

## Overlay Concepts

### Topic Manager

Validates transactions before admission to the overlay:

```typescript
class TokenTopicManager implements TopicManager {
  async identifyAdmissibleOutputs(
    beef: number[],
    previousCoins: number[]
  ): Promise<AdmittanceInstructions> {
    // Parse transaction
    // Validate token format
    // Return valid output indices
  }
}
```

### Lookup Service

Handles queries and tracks token state:

```typescript
class TokenLookupService implements LookupService {
  async outputAdmittedByTopic(payload): Promise<void> {
    // Store new token output
  }

  async outputSpent(payload): Promise<void> {
    // Mark token as spent
  }

  async lookup(question): Promise<LookupFormula> {
    // Handle balance/history queries
  }
}
```

### Storage Manager

Manages MongoDB operations:

```typescript
class TokenStorageManager {
  async storeToken(txid, outputIndex, tokenId, amount, metadata)
  async markAsSpent(txid, outputIndex)
  async getBalance(tokenId)
  async getAllBalances()
}
```

## Production Considerations

**This workshop uses REAL BSV mainnet!** Your tokens are permanent on the blockchain.

### What's Production-Ready ✅

- ✅ Real BSV Desktop Wallet integration
- ✅ Actual mainnet transactions
- ✅ Proper transaction signing and broadcasting
- ✅ Overlay validation and indexing
- ✅ Token protocol following BRC-48 (PushDrop)

### Additional Production Enhancements

### Security
- ⚡ Add authentication/authorization on overlay API
- ⚡ Implement rate limiting
- ⚡ Validate all user inputs server-side
- ⚡ Add audit logging

### Wallet Features
- ⚡ Handle chain reorganizations
- ⚡ Add transaction history tracking
- ⚡ Implement proper fee estimation
- ⚡ Add UTXO consolidation

### Broadcasting
- ⚡ Implement retry logic for network failures
- ⚡ Monitor transaction confirmation status
- ⚡ Handle double-spend detection

### Scalability
- ⚡ Add database indexing for faster queries
- ⚡ Implement caching layer
- ⚡ Use connection pooling
- ⚡ Add monitoring/logging (Prometheus, Grafana)

### Token Features
- ⚡ Add access controls (who can mint)
- ⚡ Implement token burning
- ⚡ Add supply management
- ⚡ Multi-signature support
- ⚡ Token metadata updates

## Extending This Workshop

Ideas for enhancement:

1. **NFTs** - Add unique token support with metadata
2. **Token Exchange** - Build atomic swap functionality
3. **Access Control** - Add owner-only minting
4. **Dividends** - Distribute tokens to holders
5. **Governance** - Voting with token weights
6. **DeFi** - Lending, staking, yield farming

## Learning Resources

- [BSV SDK Documentation](https://docs.bsvblockchain.org/sdk/)
- [Overlay Services](https://github.com/bitcoin-sv/overlay-services)
- [BRC Standards](https://brc.dev/)
- [PushDrop Protocol (BRC-48)](https://brc.dev/48)

## Troubleshooting

### BSV Desktop Wallet Connection Issues

**Error: "No wallet available over any communication substrate"**
- Make sure BSV Desktop Wallet is **running** and **unlocked**
- Verify `WAB_SERVER_URL` in `.env` is correct
- Check that your wallet has BSV for transaction fees
- Try restarting BSV Desktop Wallet

**Error: "Failed to connect to BSV Desktop Wallet"**
- Ensure BSV Desktop Wallet is open and not minimized
- Unlock your wallet with your password
- Check network connectivity
- Verify the WAB server URLs in `.env`

### Overlay server won't start

- Check MongoDB is running: `docker ps`
- Check MySQL is running: `docker ps`
- Verify `.env` configuration
- Check port 8080 is available

### Can't mint tokens

- Verify BSV Desktop Wallet is running and unlocked
- Check you have BSV funds for fees (~500-1000 satoshis)
- Ensure overlay server is running
- Check `WAB_SERVER_URL` in `.env`

### Balances not showing

- Wait for overlay to index transactions
- Check MongoDB connection
- Verify token transactions were broadcast successfully
- Check overlay logs for errors
- Confirm transactions on WhatsOnChain

## License

MIT

## Contributing

This is an educational workshop. Feel free to:
- Report issues
- Submit improvements
- Create tutorials
- Build on this foundation

---

**Workshop Goals Achieved:**
✅ Simple, clear code
✅ Good use of BSV SDK
✅ Proper overlay patterns
✅ Lean management
✅ Production-ready architecture
✅ Educational value

Happy tokenizing! 🚀
