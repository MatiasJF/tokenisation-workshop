import 'dotenv/config'
import {
  WalletClient,
  Script,
  Utils,
  Hash,
  PushDrop
} from '@bsv/sdk'
import * as readline from 'readline/promises'
import { stdin as input, stdout as output } from 'process'

const {
  IDENTITY_KEY,
  ORIGINATOR = 'tokenisation-workshop.local',
  OVERLAY_URL = 'http://localhost:8080'
} = process.env

interface TokenMetadata {
  name: string
  symbol: string
  decimals: number
  description?: string
  totalSupply: number
}

/**
 * Mint App - Create and broadcast real token transactions using BSV Desktop Wallet
 *
 * Usage:
 *   npm run mint
 *
 * Prerequisites:
 *   - BSV Desktop Wallet running
 *   - Wallet unlocked
 *   - BSV funds for transaction fees
 *
 * Creates token outputs with this format:
 *   OP_0 OP_RETURN 'TOKEN' <tokenId> <amount> <metadata>
 */
class MintApp {
  private wallet: WalletClient
  private identityKey: string | null = null

  constructor() {
    // Initialize WalletClient with originator (required in Node.js)
    // The originator identifies your application to the wallet
    this.wallet = new WalletClient('auto', ORIGINATOR)
  }

  /**
   * Initialize wallet connection
   */
  async initialize(): Promise<void> {
    try {
      console.log('🔌 Connecting to BSV Desktop Wallet...')

      // Get identity key from wallet
      const keyResult = await this.wallet.getPublicKey({ identityKey: true })
      this.identityKey = keyResult.publicKey

      console.log('✅ Wallet connected!')
      console.log(`📍 Identity Key: ${this.identityKey}`)

      // Verify it matches expected key
      if (IDENTITY_KEY && this.identityKey !== IDENTITY_KEY) {
        console.log(`⚠️  Warning: Identity key doesn't match .env (wallet might be different)`)
      }
    } catch (error: any) {
      throw new Error(
        `Failed to connect to BSV Desktop Wallet: ${error.message}\n\n` +
        `Make sure:\n` +
        `  1. BSV Desktop Wallet is running\n` +
        `  2. Your wallet is unlocked\n` +
        `  3. Wallet connection is available`
      )
    }
  }

  /**
   * Generate a unique token ID (32 bytes from identity key + timestamp)
   */
  generateTokenId(): string {
    const timestamp = Date.now().toString()
    const combined = (this.identityKey || 'default') + timestamp

    // Double SHA256 to get 32 bytes
    const hashBytes = Hash.hash256(combined, 'utf8')
    return Utils.toHex(hashBytes)
  }

  /**
   * Create spendable PushDrop token script
   * Format: <lockingKey> OP_DROP <protocol> <tokenId> <amount> <ownerKey> <metadata> OP_DROP
   */
  async createTokenScript(
    tokenId: string,
    amount: number,
    metadata: TokenMetadata
  ): Promise<Script> {
    // Convert amount to 8-byte little-endian buffer
    const amountBuffer = new Array(8).fill(0)
    let remaining = amount
    for (let i = 0; i < 8; i++) {
      amountBuffer[i] = remaining % 256
      remaining = Math.floor(remaining / 256)
    }

    // Get locking key from wallet
    const lockingKeyResult = await this.wallet.getPublicKey({
      protocolID: [0, 'tokens'],
      keyID: tokenId.slice(0, 32)
    })
    const lockingPublicKey = lockingKeyResult.publicKey

    // Build PushDrop script manually with OP_DROP
    // Format: <lockingKey> OP_DROP <data fields> OP_DROP
    const script = new Script()

    // Push locking key (33 bytes)
    script.writeBin(Utils.toArray(lockingPublicKey, 'hex'))

    // OP_DROP (0x75)
    script.writeOpCode(117)

    // Push protocol
    script.writeBin(Utils.toArray('TOKEN', 'utf8'))

    // Push tokenId
    script.writeBin(Utils.toArray(tokenId, 'hex'))

    // Push amount
    script.writeBin(amountBuffer)

    // Push owner key
    script.writeBin(Utils.toArray(this.identityKey || '', 'hex'))

    // Push metadata
    script.writeBin(Utils.toArray(JSON.stringify(metadata), 'utf8'))

    // OP_DROP (0x75)
    script.writeOpCode(117)

    return script
  }

  /**
   * Mint new tokens and broadcast to BSV blockchain
   */
  async mint(metadata: TokenMetadata): Promise<{
    txid: string
    tokenId: string
    amount: number
  }> {
    console.log('\n🪙  Minting new token...')

    // Generate unique token ID
    const tokenId = this.generateTokenId()
    console.log(`🆔 Token ID: ${tokenId}`)

    // Create the spendable token output script using PushDrop
    console.log('\n📝 Creating transaction...')
    const tokenScript = await this.createTokenScript(tokenId, metadata.totalSupply, metadata)

    // Create transaction with wallet
    console.log('   Requesting transaction from wallet...')
    const createResult = await this.wallet.createAction({
      outputs: [
        {
          lockingScript: tokenScript.toHex(),
          satoshis: 1000, // Minimum satoshis for spendable output (1000 sats = ~$0.0005)
          outputDescription: 'Spendable PushDrop token mint',
          basket: 'tokens'
        }
      ],
      options: {
        randomizeOutputs: false
      },
      description: `Mint ${metadata.name} (${metadata.symbol})`
      // Wallet will automatically select UTXOs to fund transaction + outputs
    })

    console.log('   ✓ Transaction created')

    // Check if transaction was signed and broadcast automatically
    if (createResult.txid) {
      console.log('\n✅ Transaction broadcast successful!')
      console.log(`   TXID: ${createResult.txid}`)

      const txid = createResult.txid

      // Show blockchain explorer link
      const explorerUrl = `https://whatsonchain.com/tx/${txid}`
      console.log(`   Explorer: ${explorerUrl}`)

      // Submit to overlay
      await this.submitToOverlay(txid)

      return {
        txid,
        tokenId,
        amount: metadata.totalSupply
      }
    } else if (createResult.signableTransaction) {
      // Transaction needs manual signing
      console.log('\n📡 Signing and broadcasting...')
      console.log('   (Check your BSV Desktop Wallet for approval dialog)')

      const signResult = await this.wallet.signAction({
        spends: {},
        reference: createResult.signableTransaction.reference
      })

      const txid = signResult.txid

      if (!txid) {
        throw new Error('No TXID returned from wallet')
      }

      console.log(`\n✅ Transaction broadcast successful!`)
      console.log(`   TXID: ${txid}`)

      // Show blockchain explorer link
      const explorerUrl = `https://whatsonchain.com/tx/${txid}`
      console.log(`   Explorer: ${explorerUrl}`)

      // Submit to overlay
      await this.submitToOverlay(txid)

      return {
        txid,
        tokenId,
        amount: metadata.totalSupply
      }
    } else {
      throw new Error('Unexpected createAction result: no txid or signableTransaction')
    }
  }

  /**
   * Submit transaction to overlay server for indexing
   */
  async submitToOverlay(txid: string): Promise<void> {
    try {
      console.log('\n📤 Submitting transaction to overlay server...')
      console.log('   Waiting for transaction to be confirmed...')

      // Retry up to 6 times (30 seconds total)
      let txFound = false
      for (let attempt = 1; attempt <= 6; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 5000))

        console.log(`   Attempt ${attempt}/6: Checking blockchain...`)
        const wocResponse = await fetch(`https://api.whatsonchain.com/v1/bsv/main/tx/${txid}/hex`)

        if (wocResponse.ok) {
          txFound = true
          console.log('   ✓ Transaction confirmed on blockchain')
          break
        } else if (attempt < 6) {
          console.log(`   Transaction not yet available, waiting...`)
        }
      }

      if (!txFound) {
        throw new Error('Transaction not found on WhatsOnChain after 30 seconds')
      }

      // Submit to overlay using direct endpoint
      console.log('   Submitting to overlay...')
      const response = await fetch(`${OVERLAY_URL}/submit-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ txid })
      })

      if (!response.ok) {
        const error = await response.json() as { error?: string }
        throw new Error(error.error || 'Overlay submission failed')
      }

      const result = await response.json() as { tokensFound: number }
      console.log(`   ✅ Transaction indexed: ${result.tokensFound} token output(s) stored`)
    } catch (error: any) {
      console.warn(`   ⚠️  Could not submit to overlay: ${error.message}`)
      console.warn(`   You may need to restart the overlay server or check the logs`)
    }
  }

  /**
   * Interactive CLI for minting tokens
   */
  async runInteractive() {
    const rl = readline.createInterface({ input, output })

    console.log(`
╔════════════════════════════════════════╗
║     BSV Token Minting Workshop         ║
║     Using Your BSV Desktop Wallet      ║
╚════════════════════════════════════════╝
`)

    try {
      // Initialize wallet connection
      await this.initialize()

      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

      const name = await rl.question('Token Name: ')
      const symbol = await rl.question('Token Symbol: ')
      const decimalsStr = await rl.question('Decimals (default 0): ')
      const supplyStr = await rl.question('Total Supply: ')
      const description = await rl.question('Description (optional): ')

      const decimals = decimalsStr ? parseInt(decimalsStr) : 0
      const totalSupply = parseInt(supplyStr)

      if (!name || !symbol || !totalSupply) {
        throw new Error('Name, symbol, and total supply are required')
      }

      if (isNaN(totalSupply) || totalSupply <= 0) {
        throw new Error('Total supply must be a positive number')
      }

      const metadata: TokenMetadata = {
        name,
        symbol,
        decimals,
        totalSupply,
        description: description || undefined
      }

      const result = await this.mint(metadata)

      console.log(`
╔════════════════════════════════════════╗
║          Minting Successful!           ║
╚════════════════════════════════════════╝

🎉 Your token has been created on the BSV blockchain!

Token Details:
  Name: ${metadata.name}
  Symbol: ${metadata.symbol}
  Decimals: ${metadata.decimals}
  Total Supply: ${metadata.totalSupply.toLocaleString()}

Token ID: ${result.tokenId}
Transaction: ${result.txid}

Next Steps:
1. Transaction will be confirmed in ~5-10 seconds
2. Your overlay server will automatically detect and index it
3. View on blockchain: https://whatsonchain.com/tx/${result.txid}
4. Use 'npm run wallet' to view and transfer your tokens

💡 Tip: Save the Token ID for future reference!

Copy this for quick access:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Token ID: ${result.tokenId}
TXID: ${result.txid}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)

    } catch (error) {
      console.error('\n❌ Error:', error instanceof Error ? error.message : error)

      if (error instanceof Error) {
        if (error.message.includes('BSV Desktop Wallet') || error.message.includes('connect')) {
          console.log('\n💡 Troubleshooting:')
          console.log('   1. Make sure BSV Desktop Wallet is running')
          console.log('   2. Unlock your wallet if it\'s locked')
          console.log('   3. Check your wallet has BSV for fees (~$0.01)')
          console.log('   4. Ensure wallet connection is available')
        }
      }
    } finally {
      rl.close()
    }
  }
}

// Run the app
async function main() {
  const app = new MintApp()
  await app.runInteractive()
}

main().catch(console.error)
