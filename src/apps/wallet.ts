import 'dotenv/config'
import {
  WalletClient,
  Script,
  Utils,
  PushDrop
} from '@bsv/sdk'
import * as readline from 'readline/promises'
import { stdin as input, stdout as output } from 'process'

const {
  IDENTITY_KEY,
  OVERLAY_URL = 'http://localhost:8080',
  ORIGINATOR = 'tokenisation-workshop.local'
} = process.env

interface TokenBalance {
  tokenId: string
  name?: string
  symbol?: string
  decimals?: number
  totalAmount: number
  utxos?: Array<{
    txid: string
    outputIndex: number
    amount: number
  }>
}

interface TokenUTXO {
  txid: string
  outputIndex: number
  amount: number
  lockingScript: string
  satoshis: number
}

/**
 * Wallet App - Transfer tokens and view balances using BSV Desktop Wallet
 *
 * Usage:
 *   npm run wallet
 *
 * Prerequisites:
 *   - BSV Desktop Wallet running
 *   - Wallet unlocked
 *   - BSV funds for transaction fees
 *
 * Features:
 * - View token balances from overlay server
 * - Transfer tokens to another address
 * - Sign transactions with BSV Desktop Wallet
 */
class WalletApp {
  private wallet: WalletClient
  private identityKey: string | null = null
  private overlayUrl: string

  constructor() {
    // Initialize WalletClient with originator (required in Node.js)
    // The originator identifies your application to the wallet
    this.wallet = new WalletClient('auto', ORIGINATOR)
    this.overlayUrl = OVERLAY_URL || 'http://localhost:8080'
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
   * Query overlay for token balances
   */
  async getBalances(): Promise<TokenBalance[]> {
    try {
      // Filter by this wallet's identity key
      const url = `${this.overlayUrl}/token-balances?ownerKey=${this.identityKey}`
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`Lookup failed: ${response.statusText}`)
      }

      const result = await response.json()
      return Array.isArray(result) ? result : []
    } catch (error) {
      console.error('Error fetching balances:', error)
      return []
    }
  }

  /**
   * Query overlay for UTXOs of a specific token
   */
  async getTokenUTXOs(tokenId: string): Promise<TokenUTXO[]> {
    try {
      const response = await fetch(`${this.overlayUrl}/token-utxos/${tokenId}`)

      if (!response.ok) {
        throw new Error(`Lookup failed: ${response.statusText}`)
      }

      const result = await response.json()
      return Array.isArray(result) ? result : []
    } catch (error) {
      console.error('Error fetching UTXOs:', error)
      return []
    }
  }

  /**
   * Display all token balances
   */
  async showBalances() {
    console.log('\n💰 Fetching token balances...\n')

    const balances = await this.getBalances()

    if (balances.length === 0) {
      console.log('No tokens found. Mint some tokens first!')
      return
    }

    console.log('╔═══════════════════════════════════════════════════╗')
    console.log('║              Token Balances                       ║')
    console.log('╚═══════════════════════════════════════════════════╝\n')

    for (const balance of balances) {
      const displayAmount = balance.decimals
        ? balance.totalAmount / Math.pow(10, balance.decimals)
        : balance.totalAmount

      console.log(`Token: ${balance.name || 'Unknown'} (${balance.symbol || 'N/A'})`)
      console.log(`  ID: ${balance.tokenId}`)
      console.log(`  Balance: ${displayAmount.toLocaleString()}`)
      console.log(`  UTXOs: ${balance.utxos?.length || 0}`)
      console.log(`  Decimals: ${balance.decimals || 0}`)
      console.log()
    }
  }

  /**
   * Create spendable PushDrop token transfer script
   */
  createTransferScript(
    tokenId: string,
    amount: number,
    recipientKey: string,
    lockingPublicKey: string,
    metadata?: any
  ): string {
    // Convert amount to 8-byte little-endian buffer
    const amountBuffer = new Array(8).fill(0)
    let remaining = amount
    for (let i = 0; i < 8; i++) {
      amountBuffer[i] = remaining % 256
      remaining = Math.floor(remaining / 256)
    }

    const fields = [
      Utils.toHex(Utils.toArray(lockingPublicKey, 'hex')),   // Locking public key (who can spend)
      Utils.toHex(Utils.toArray('TOKEN', 'utf8')),
      Utils.toHex(Utils.toArray(tokenId, 'hex')),
      Utils.toHex(amountBuffer),
      Utils.toHex(Utils.toArray(recipientKey, 'hex'))  // Add recipient/owner field
    ]

    if (metadata) {
      fields.push(Utils.toHex(Utils.toArray(JSON.stringify(metadata), 'utf8')))
    }

    // Create script: <data pushes> OP_DROP (75)
    return Script.fromASM(fields.join(' ') + ' OP_DROP').toHex()
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
      const response = await fetch(`${this.overlayUrl}/submit-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ txid })
      })

      if (!response.ok) {
        const error: any = await response.json()
        throw new Error(error.error || 'Overlay submission failed')
      }

      const result: any = await response.json()
      console.log(`   ✅ Transaction indexed: ${result.tokensFound} token output(s) stored`)
    } catch (error: any) {
      console.warn(`   ⚠️  Could not submit to overlay: ${error.message}`)
      console.warn(`   You may need to restart the overlay server or check the logs`)
    }
  }

  /**
   * Transfer tokens to another address using BSV Desktop Wallet (spendable PushDrop)
   */
  async transfer(tokenId: string, amount: number, recipientAddress: string) {
    console.log(`\n📤 Transferring tokens...`)
    console.log(`  Token ID: ${tokenId}`)
    console.log(`  Amount: ${amount}`)
    console.log(`  To: ${recipientAddress}`)

    // Get UTXOs for this token
    const utxos = await this.getTokenUTXOs(tokenId)

    if (utxos.length === 0) {
      throw new Error('No UTXOs found for this token')
    }

    // Calculate total available
    const totalAvailable = utxos.reduce((sum, utxo) => sum + utxo.amount, 0)

    if (totalAvailable < amount) {
      throw new Error(`Insufficient balance. Available: ${totalAvailable}, Requested: ${amount}`)
    }

    // Calculate change
    const change = totalAvailable - amount

    // Get locking keys for recipient and change outputs
    console.log('   Getting locking keys from wallet...')
    const recipientLockingKeyResult = await this.wallet.getPublicKey({
      protocolID: [0, 'tokens'],
      keyID: `${tokenId.slice(0, 16)}-recipient-${Date.now()}`
    })
    const recipientLockingKey = recipientLockingKeyResult.publicKey

    // Create token outputs
    const outputs = []

    // Recipient's token output
    const recipientScript = this.createTransferScript(tokenId, amount, recipientAddress, recipientLockingKey)
    outputs.push({
      lockingScript: recipientScript,
      satoshis: 1000, // Minimum satoshis for spendable output
      outputDescription: 'Token transfer output'
    })

    // Change output if needed (back to sender)
    if (change > 0) {
      const changeLockingKeyResult = await this.wallet.getPublicKey({
        protocolID: [0, 'tokens'],
        keyID: `${tokenId.slice(0, 16)}-change-${Date.now()}`
      })
      const changeLockingKey = changeLockingKeyResult.publicKey

      const changeScript = this.createTransferScript(tokenId, change, this.identityKey!, changeLockingKey)
      outputs.push({
        lockingScript: changeScript,
        satoshis: 1000, // Minimum satoshis for spendable output
        outputDescription: 'Token change output'
      })
    }

    console.log('\n📝 Creating transaction...')
    console.log(`   Inputs: ${totalAvailable} tokens from ${utxos.length} UTXO(s)`)
    console.log(`   To recipient: ${amount}`)
    console.log(`   Change: ${change}`)

    // For now, we'll create the transaction without explicitly providing the token UTXOs as inputs
    // The wallet will handle funding the transaction with BSV UTXOs for fees
    // Note: This is a simplified approach - in production you'd want to properly spend the token UTXOs
    console.log('   ⚠️  Note: Token UTXO spending not yet implemented - creating new tokens')
    console.log('   Requesting transaction from wallet...')
    const createResult = await this.wallet.createAction({
      outputs,
      options: {
        randomizeOutputs: false
      },
      description: `Transfer ${amount} tokens`
    })

    console.log('   ✓ Transaction created')

    // Check if transaction was signed and broadcast automatically
    if (createResult.txid) {
      console.log('\n✅ Transaction broadcast successful!')
      console.log(`   TXID: ${createResult.txid}`)

      // Show blockchain explorer link
      const explorerUrl = `https://whatsonchain.com/tx/${createResult.txid}`
      console.log(`   Explorer: ${explorerUrl}`)

      // Submit to overlay
      await this.submitToOverlay(createResult.txid)

      return {
        txid: createResult.txid,
        amount,
        change
      }
    } else if (createResult.signableTransaction) {
      // Transaction needs manual signing
      console.log('\n📡 Signing and broadcasting...')
      console.log('   (Check your BSV Desktop Wallet for approval dialog)')

      try {
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
          amount,
          change
        }
      } catch (error: any) {
        console.error('\n❌ Transaction failed:', error.message)

        if (error.message.includes('denied') || error.message.includes('rejected')) {
          console.log('\n💡 You may have rejected the transaction in BSV Desktop Wallet')
          console.log('   Try again and approve when prompted')
        }

        throw error
      }
    } else {
      throw new Error('Unexpected createAction result: no txid or signableTransaction')
    }
  }

  /**
   * Interactive CLI menu
   */
  async runInteractive() {
    const rl = readline.createInterface({ input, output })

    console.log(`
╔════════════════════════════════════════╗
║      BSV Token Wallet Workshop         ║
║      Using Your BSV Desktop Wallet     ║
╚════════════════════════════════════════╝
`)

    try {
      // Initialize wallet connection
      await this.initialize()

      console.log(`
Overlay: ${this.overlayUrl}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)

      while (true) {
        console.log('\nOptions:')
        console.log('  1. View Balances')
        console.log('  2. Transfer Tokens')
        console.log('  3. Exit')

        const choice = await rl.question('\nChoice: ')

        try {
          switch (choice) {
            case '1':
              await this.showBalances()
              break

            case '2':
              const tokenId = await rl.question('Token ID: ')
              const amountStr = await rl.question('Amount: ')
              const recipient = await rl.question('Recipient Address: ')

              const amount = parseInt(amountStr)
              if (!tokenId || !amount || !recipient) {
                console.log('❌ All fields are required')
                break
              }

              const result = await this.transfer(tokenId, amount, recipient)
              console.log(`\n✓ Transfer successful!`)
              console.log(`  Transaction: ${result.txid}`)
              console.log(`  Explorer: https://whatsonchain.com/tx/${result.txid}`)
              break

            case '3':
              console.log('\n👋 Goodbye!')
              rl.close()
              return

            default:
              console.log('❌ Invalid choice')
          }
        } catch (error) {
          console.error('\n❌ Error:', error instanceof Error ? error.message : error)
        }
      }
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
  const app = new WalletApp()
  await app.runInteractive()
}

main().catch(console.error)
