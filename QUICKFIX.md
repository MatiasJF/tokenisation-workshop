# Quick Fix: "Originator is required in Node.js environments"

## The Problem

```bash
Originator is required in Node.js environments
Failed to connect to BSV Desktop Wallet: No wallet available over any communication substrate
```

## The Solution (2 Steps)

### Step 1: Add to your `.env` file

```bash
ORIGINATOR=tokenisation-workshop.local
```

### Step 2: Already Fixed! ✅

The code has been updated to use the originator:

**`src/apps/mint.ts` and `src/apps/wallet.ts` now include:**

```typescript
const {
  ORIGINATOR = 'tokenisation-workshop.local'
} = process.env

class App {
  constructor() {
    this.wallet = new WalletClient('auto', ORIGINATOR)  // Fixed!
  }
}
```

## Test It Now

1. **Update your `.env` file:**
   ```bash
   echo "ORIGINATOR=tokenisation-workshop.local" >> .env
   ```

2. **Restart your terminal** (to load the new environment variable)

3. **Run the mint app:**
   ```bash
   npm run mint
   ```

4. **You should see:**
   ```
   🔌 Connecting to BSV Desktop Wallet...
   ✅ Wallet connected!
   📍 Identity Key: 02xxxxx...
   ```

## Why This Happens

- **Browser**: Automatically sends `Origin` header → No originator needed
- **Node.js**: No automatic origin → Must provide originator parameter

## What is an Originator?

A domain-style string that identifies your application to the wallet:
- Format: `myapp.local`, `token-app.dev`, `service.test`
- Can be fake for local development
- Similar to CORS origins in web apps

## Full Documentation

For detailed information, see:
- **Comprehensive Guide**: `/WALLET_INTEGRATION.md`
- **Context Session**: `/.claude/tasks/context_session_2.md`

## Still Having Issues?

### Check BSV Desktop Wallet is running:
```bash
curl http://localhost:3321/getVersion
```

Should return: `{"version":"1.x.x"}`

### Common Issues:
1. ❌ Wallet not running → Start BSV Desktop Wallet
2. ❌ Wallet locked → Unlock your wallet
3. ❌ Environment variable not loaded → Restart terminal
4. ❌ ORIGINATOR not in .env → Add it and restart terminal

## That's It!

The code is fixed. Just add `ORIGINATOR` to your `.env` and you're ready to go! 🚀
