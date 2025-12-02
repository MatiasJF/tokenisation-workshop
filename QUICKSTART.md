# Quick Start Guide

Get up and running with BSV tokenization in 5 minutes!

## Prerequisites

1. **BSV Desktop Wallet**
   - Download from https://yours.org/
   - Install and create/restore your wallet
   - Unlock your wallet
   - Ensure you have BSV for transaction fees (~$0.10 USD minimum)

2. **Docker Desktop** running

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Start Databases

Using Docker (recommended):

```bash
docker-compose up -d mongodb mysql
```

Or start them separately:

```bash
# MongoDB
docker run -d -p 27017:27017 --name mongo mongo:latest

# MySQL
docker run -d -p 3306:3306 --name mysql \
  -e MYSQL_ROOT_PASSWORD=password \
  -e MYSQL_DATABASE=tokenworkshop \
  mysql:latest
```

## Step 3: Configure Environment

Create `.env` file:

```bash
cp .env.example .env
```

Generate a private key for the overlay server:

```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Edit `.env`:

```bash
# Overlay server key
SERVER_PRIVATE_KEY=your_generated_key

# BSV Desktop Wallet URLs (use these defaults)
WAB_SERVER_URL=https://wab.babbage.systems
WALLET_STORAGE_URL=https://storage.babbage.systems
MESSAGE_BOX_URL=https://messagebox.babbage.systems

# Network
NETWORK=main
```

**Note**: You DON'T need `MINTER_PRIVATE_KEY` or `WALLET_PRIVATE_KEY` anymore - BSV Desktop Wallet handles all signing!

## Step 4: Start Overlay Server

```bash
npm run dev
```

You should see:

```
✨ Tokenisation Workshop Server Running!

🌐 Overlay URL: http://localhost:8080
📦 Node Name: tokenworkshop
🎯 Services: Token Mint & Wallet
```

## Step 5: Mint Your First Token

**IMPORTANT**: Make sure BSV Desktop Wallet is running and unlocked!

In a new terminal:

```bash
npm run mint
```

Example interaction:

```
╔════════════════════════════════════════╗
║     BSV Token Minting Workshop         ║
║     Using Your BSV Desktop Wallet      ║
╚════════════════════════════════════════╝

🔌 Connecting to BSV Desktop Wallet...
   WAB Server: https://wab.babbage.systems
✅ Wallet connected!
📍 Identity Key: 03b1b8...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Token Name: My First Token
Token Symbol: MFT
Decimals (default 0): 2
Total Supply: 100000
Description (optional): My workshop token

🪙  Minting new token...
🆔 Token ID: a1b2c3d4e5f6789...

📝 Creating transaction...
   Requesting transaction from wallet...
   ✓ Transaction created

📡 Signing and broadcasting to BSV mainnet...
   (Check your BSV Desktop Wallet for approval dialog)

✅ Transaction broadcast successful!
   TXID: abc123def456...
   Explorer: https://whatsonchain.com/tx/abc123def456...

🎉 Your token has been created on the BSV blockchain!
```

**You just created a REAL token on BSV mainnet!**

## Step 6: Check Balance

In another terminal:

```bash
npm run wallet
```

Choose option 1 to view balances:

```
Token: My First Token (MFT)
  ID: a1b2c3d4e5f6789...
  Balance: 1,000.00
  UTXOs: 1
  Decimals: 2
```

## Step 7: Transfer Tokens

In the wallet, choose option 2:

```
Token ID: a1b2c3d4e5f6789...
Amount: 50000
Recipient Address: 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa

📤 Transferring tokens...
  Token ID: a1b2c3d4...
  Amount: 50000
  To: 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa

📝 Creating transaction...
   Inputs: 100000
   To recipient: 50000
   Change: 50000

📡 Signing and broadcasting to BSV mainnet...
   (Check your BSV Desktop Wallet for approval dialog)

✅ Transaction broadcast successful!
   TXID: def456abc789...
   Explorer: https://whatsonchain.com/tx/def456abc789...

✓ Transfer successful!
  Transaction: def456abc789...
  Explorer: https://whatsonchain.com/tx/def456abc789...
```

**You just transferred real tokens on BSV mainnet!**

## What You've Learned

✅ How to set up an overlay node for tokens
✅ Token protocol structure (OP_RETURN format)
✅ **Minting real tokens on BSV mainnet**
✅ **Using BSV Desktop Wallet for signing**
✅ Querying balances via overlay
✅ **Creating real token transfers on-chain**
✅ **Broadcasting to BSV blockchain**

## Next Steps

1. **Explore the Code**
   - `src/services/token/TokenTopicManager.ts` - Transaction validation
   - `src/services/token/TokenLookupService.ts` - Query handling
   - `src/apps/mint.ts` - Token creation
   - `src/apps/wallet.ts` - Token transfers

2. **Read the Documentation**
   - See `README.md` for full details
   - Check BSV SDK docs for advanced features

3. **Extend the Functionality**
   - Add NFT support
   - Implement token burning
   - Create a web UI
   - Add multi-signature support

## Troubleshooting

### "Failed to connect to BSV Desktop Wallet"
1. Make sure BSV Desktop Wallet is **running**
2. Unlock your wallet if it's locked
3. Check your wallet has BSV for fees (~$0.01)
4. Verify `WAB_SERVER_URL` in `.env` is correct
5. Try restarting BSV Desktop Wallet

### "No wallet available over any communication substrate"
This error means WalletClient can't find BSV Desktop Wallet:
- Ensure BSV Desktop Wallet is open and not minimized
- Unlock your wallet with your password
- Check network connectivity
- Verify the WAB server URLs in `.env`

### "Cannot connect to MongoDB"
```bash
# Check MongoDB is running
docker ps | grep mongo

# Restart if needed
docker restart mongo
```

### "Cannot connect to MySQL"
```bash
# Check MySQL is running
docker ps | grep mysql

# Restart if needed
docker restart mysql
```

### "Port 8080 already in use"
Change `HOSTING_URL` in `.env`:
```bash
HOSTING_URL=http://localhost:8081
```

And update the server port in `src/index.ts`.

## Using Docker Compose (All-in-One)

For complete Docker setup:

```bash
# Start everything
docker-compose up

# In new terminals, run apps
npm run mint
npm run wallet
```

## Production Deployment

For production:

1. **Already using mainnet!** ✅ Your tokens are real
2. **Already using BSV Desktop Wallet!** ✅ Secure signing
3. Enable SSL/TLS (HTTPS) for overlay server
4. Add authentication to overlay API endpoints
5. Set up monitoring and logging
6. Use production databases with backups
7. Implement rate limiting
8. Add transaction confirmation tracking

See `README.md` for detailed production considerations.

---

**You're now building REAL applications on BSV!** 🚀

Check your transactions on: https://whatsonchain.com/
