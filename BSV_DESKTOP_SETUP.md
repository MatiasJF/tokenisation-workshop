# BSV Desktop Wallet Setup

This tokenization workshop now uses **BSV Desktop Wallet** for all operations - no private keys needed!

## 🎯 Quick Start

### 1. Install BSV Desktop Wallet

Download and install from: **https://yours.org/**

Available for:
- Windows
- macOS
- Linux

### 2. Set Up Your Wallet

1. **Open BSV Desktop Wallet**
2. **Create a new wallet** (or restore existing)
3. **Unlock your wallet** with your password
4. **Ensure you have some BSV** for transaction fees (~$0.01 per transaction)

### 3. Get Some BSV (if needed)

Buy BSV from:
- Coinbase
- Binance
- HandCash
- Other exchanges

Send to your BSV Desktop Wallet address.

## 🚀 Using the Workshop

Once BSV Desktop Wallet is running and unlocked:

### Mint Tokens (Terminal 1)

```bash
# Make sure overlay server is running first
npm run dev
```

### Create Tokens (Terminal 2)

```bash
npm run mint
```

The app will:
1. ✅ Connect to your BSV Desktop Wallet automatically
2. ✅ Ask for token details (name, symbol, supply)
3. ✅ Create the transaction
4. ✅ Show you a confirmation dialog in BSV Desktop Wallet
5. ✅ Broadcast to mainnet BSV blockchain
6. ✅ Give you the TXID to track on WhatsOnChain

### View & Transfer (Terminal 3)

```bash
npm run wallet
```

## 🔐 Security

**Why BSV Desktop Wallet?**

- ✅ Your private keys never leave your device
- ✅ No need to manage keys manually
- ✅ Built-in backup and recovery
- ✅ Secure transaction signing
- ✅ Works with real mainnet BSV

**What happens:**

1. App creates transaction structure
2. Sends to BSV Desktop Wallet for signing
3. You approve in wallet UI
4. Wallet signs and broadcasts
5. Transaction confirmed on blockchain

## 💰 Cost

**Transaction fees:**
- Minting a token: ~500-1000 satoshis (~$0.001-0.002 USD)
- Transferring tokens: ~500 satoshis (~$0.001 USD)

**You need**: Minimum ~$0.10 USD in BSV to mint several tokens

## 📝 Network

**Now using MAINNET**
- All transactions are real
- All tokens are permanent
- All costs are in real BSV
- View transactions on: https://whatsonchain.com

## ❓ Troubleshooting

### "Failed to connect to BSV Desktop Wallet"

1. Make sure BSV Desktop Wallet is **open**
2. Make sure your wallet is **unlocked**
3. Check the wallet is not minimized/hidden
4. Try restarting the wallet

### "Transaction failed"

1. Check you have enough BSV for fees
2. Make sure wallet is unlocked
3. Try again - network might be temporarily busy

### "No wallet found"

1. Create a new wallet in BSV Desktop Wallet
2. Wait for it to fully sync
3. Make sure it's unlocked
4. Try the mint command again

## 🎓 What You're Learning

- **Real blockchain development** - not simulation!
- **Proper wallet integration** - BSV Desktop Wallet API
- **Transaction construction** - OP_RETURN outputs, proper scripts
- **Overlay architecture** - validation and indexing
- **Production patterns** - secure, user-friendly token creation

## 🌟 Benefits of This Approach

Compared to managing private keys manually:

1. **Safer** - Keys stay in secure wallet
2. **Easier** - No key management needed
3. **Better UX** - Visual confirmation dialogs
4. **Real World** - How production apps work
5. **Educational** - Learn proper wallet integration

## 📚 Next Steps

Once you've minted tokens:

1. Check your transaction on WhatsOnChain
2. See it indexed in your overlay server
3. Transfer tokens to friends
4. Build a web UI for your tokens
5. Create advanced token features

---

**Ready to mint your first real BSV token!** 🚀
