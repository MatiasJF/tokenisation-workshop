import 'dotenv/config'
import { WalletClient } from '@bsv/sdk'

const ORIGINATOR = 'tokenisation-workshop.local'
const OVERLAY_URL = 'http://localhost:8080'

async function testMintFlow() {
  console.log('=== AUTOMATED MINT TEST ===\n')

  // Step 1: Connect to wallet
  console.log('1. Connecting to wallet...')
  const wallet = new WalletClient('auto', ORIGINATOR)
  const keyResult = await wallet.getPublicKey({ identityKey: true })
  const identityKey = keyResult.publicKey
  console.log(`   ✓ Connected! Identity: ${identityKey}\n`)

  // Step 2: Check initial balance
  console.log('2. Checking initial balance...')
  const initialBalance = await fetch(`${OVERLAY_URL}/token-balances?ownerKey=${identityKey}`)
  const initialTokens = await initialBalance.json()
  console.log(`   ✓ Current tokens: ${initialTokens.length}\n`)

  // Step 3: Mint via npm run mint (simulated by importing the mint logic)
  console.log('3. Minting test token...')
  console.log('   Please run: npm run mint')
  console.log('   Enter the following:')
  console.log('     Name: AutoTest')
  console.log('     Symbol: AUTO')
  console.log('     Decimals: 0')
  console.log('     Total Supply: 100')
  console.log('     Description: Automated test token')
  console.log('\n   Waiting for mint...')
}

testMintFlow().catch(console.error)
