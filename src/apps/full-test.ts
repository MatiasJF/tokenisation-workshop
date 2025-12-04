import 'dotenv/config'
import { WalletClient, Script, Utils, Hash } from '@bsv/sdk'

const ORIGINATOR = 'tokenisation-workshop.local'
const OVERLAY_URL = 'http://localhost:8080'

interface TokenMetadata {
  name: string
  symbol: string
  decimals: number
  totalSupply: number
  description?: string
}

async function fullTest() {
  console.log('\n╔════════════════════════════════════════╗')
  console.log('║     FULL END-TO-END TOKEN TEST        ║')
  console.log('╚════════════════════════════════════════╝\n')

  try {
    // Step 1: Connect to wallet
    console.log('📋 Step 1: Connecting to BSV Desktop Wallet...')
    const wallet = new WalletClient('auto', ORIGINATOR)
    const keyResult = await wallet.getPublicKey({ identityKey: true })
    const identityKey = keyResult.publicKey
    console.log(`   ✓ Connected! Identity: ${identityKey}\n`)

    // Step 2: Check initial balance
    console.log('📋 Step 2: Checking initial token balance...')
    const initialResponse = await fetch(`${OVERLAY_URL}/token-balances?ownerKey=${identityKey}`)
    const initialTokens = await initialResponse.json()
    console.log(`   ✓ Current tokens: ${initialTokens.length}\n`)

    // Step 3: Generate token ID
    console.log('📋 Step 3: Generating unique token ID...')
    const timestamp = Date.now().toString()
    const combined = identityKey + timestamp
    const hashBytes = Hash.hash256(combined, 'utf8')
    const tokenId = Utils.toHex(hashBytes)
    console.log(`   ✓ Token ID: ${tokenId}\n`)

    // Step 4: Create token script
    console.log('📋 Step 4: Creating PushDrop token script...')
    const metadata: TokenMetadata = {
      name: 'FullTest',
      symbol: 'TEST',
      decimals: 0,
      totalSupply: 99,
      description: 'Automated full test'
    }

    const amount = metadata.totalSupply
    const amountBuffer = new Array(8).fill(0)
    let remaining = amount
    for (let i = 0; i < 8; i++) {
      amountBuffer[i] = remaining % 256
      remaining = Math.floor(remaining / 256)
    }

    // Get locking key
    const lockingKeyResult = await wallet.getPublicKey({
      protocolID: [0, 'tokens'],
      keyID: tokenId.slice(0, 32)
    })
    const lockingPublicKey = lockingKeyResult.publicKey

    // Build script
    const script = new Script()
    script.writeBin(Utils.toArray(lockingPublicKey, 'hex'))
    script.writeOpCode(117) // OP_DROP
    script.writeBin(Utils.toArray('TOKEN', 'utf8'))
    script.writeBin(Utils.toArray(tokenId, 'hex'))
    script.writeBin(amountBuffer)
    script.writeBin(Utils.toArray(identityKey, 'hex'))
    script.writeBin(Utils.toArray(JSON.stringify(metadata), 'utf8'))
    script.writeOpCode(117) // OP_DROP

    console.log(`   ✓ Script created (${script.toHex().length / 2} bytes)\n`)

    // Step 5: Create and broadcast transaction
    console.log('📋 Step 5: Creating transaction with wallet...')
    const createResult = await wallet.createAction({
      outputs: [{
        lockingScript: script.toHex(),
        satoshis: 1000,
        outputDescription: 'PushDrop token mint',
        basket: 'tokens'
      }],
      options: { randomizeOutputs: false },
      description: `Mint ${metadata.name} (${metadata.symbol})`
    })

    console.log('   ✓ Transaction created\n')

    let txid: string | undefined

    if (createResult.txid) {
      txid = createResult.txid
      console.log('   ✓ Transaction auto-signed and broadcast')
    } else if (createResult.signableTransaction) {
      console.log('   ℹ️  Signing transaction...')
      const signResult = await wallet.signAction({
        spends: {},
        reference: createResult.signableTransaction.reference
      })
      txid = signResult.txid
      console.log('   ✓ Transaction signed and broadcast')
    }

    if (!txid) {
      throw new Error('No TXID returned')
    }

    console.log(`\n✅ Transaction broadcast successful!`)
    console.log(`   TXID: ${txid}`)
    console.log(`   Explorer: https://whatsonchain.com/tx/${txid}\n`)

    // Step 6: Wait for confirmation and submit to overlay
    console.log('📋 Step 6: Waiting for blockchain confirmation...')
    let confirmed = false
    for (let attempt = 1; attempt <= 6; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 5000))
      console.log(`   Attempt ${attempt}/6...`)

      const wocResponse = await fetch(`https://api.whatsonchain.com/v1/bsv/main/tx/${txid}/hex`)
      if (wocResponse.ok) {
        confirmed = true
        console.log('   ✓ Transaction confirmed!\n')
        break
      }
    }

    if (!confirmed) {
      throw new Error('Transaction not confirmed after 30 seconds')
    }

    // Step 7: Submit to overlay
    console.log('📋 Step 7: Submitting to overlay server...')
    const overlayResponse = await fetch(`${OVERLAY_URL}/submit-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txid })
    })

    if (!overlayResponse.ok) {
      const error = await overlayResponse.json()
      throw new Error(error.error || 'Overlay submission failed')
    }

    const overlayResult = await overlayResponse.json()
    console.log(`   ✓ Indexed: ${overlayResult.tokensFound} token output(s)\n`)

    // Step 8: Verify token appears in balance
    console.log('📋 Step 8: Verifying token appears in wallet...')
    const finalResponse = await fetch(`${OVERLAY_URL}/token-balances?ownerKey=${identityKey}`)
    const finalTokens = await finalResponse.json()

    const newToken = finalTokens.find((t: any) => t.tokenId === tokenId)

    if (!newToken) {
      throw new Error('Token not found in wallet balance!')
    }

    console.log('   ✓ Token found in wallet!')
    console.log(`\n╔════════════════════════════════════════╗`)
    console.log(`║          TEST SUCCESSFUL! ✓            ║`)
    console.log(`╚════════════════════════════════════════╝\n`)

    console.log(`Token Details:`)
    console.log(`  Name: ${newToken.name}`)
    console.log(`  Symbol: ${newToken.symbol}`)
    console.log(`  Amount: ${newToken.totalAmount}`)
    console.log(`  UTXOs: ${newToken.utxos?.length || 0}`)
    console.log(`\nTotal tokens in wallet: ${finalTokens.length}`)

  } catch (error: any) {
    console.error(`\n❌ TEST FAILED: ${error.message}`)
    console.error(error.stack)
    process.exit(1)
  }
}

fullTest()
