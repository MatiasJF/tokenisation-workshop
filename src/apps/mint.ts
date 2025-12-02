import 'dotenv/config'
import {
  WalletClient,
  Script,
  Utils,
  Hash
} from '@bsv/sdk'
import * as readline from 'readline/promises'
import { stdin as input, stdout as output } from 'process'

const {
  IDENTITY_KEY,
  ORIGINATOR = 'tokenisation-workshop.local'
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
   * Create token output script
   */
  createTokenScript(
    tokenId: string,
    amount: number,
    metadata: TokenMetadata
  ): Script {
    // Convert amount to 8-byte little-endian buffer
    const amountBuffer = new Array(8).fill(0)
    let remaining = amount
    for (let i = 0; i < 8; i++) {
      amountBuffer[i] = remaining % 256
      remaining = Math.floor(remaining / 256)
    }

    // Build OP_RETURN script with PushDrop format
    const fields = [
      Utils.toArray('TOKEN', 'utf8'),           // Protocol
      Utils.toArray(tokenId, 'hex'),            // Token ID (32 bytes)
      amountBuffer,                             // Amount (8 bytes)
      Utils.toArray(JSON.stringify(metadata), 'utf8')  // Metadata
    ]

    return Script.fromASM([
      'OP_FALSE',
      'OP_RETURN',
      ...fields.map(field => Utils.toHex(field))
    ].join(' '))
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

    // Create the token output script
    console.log('\n📝 Creating transaction...')
    const tokenScript = this.createTokenScript(tokenId, metadata.totalSupply, metadata)

    // Create transaction with wallet
    console.log('   Requesting transaction from wallet...')
    const createResult = await this.wallet.createAction({
      outputs: [
        {
          lockingScript: tokenScript.toHex(),
          satoshis: 1, // BSV requires minimum 1 satoshi for OP_RETURN outputs
          outputDescription: 'Token mint output'
        }
      ],
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
