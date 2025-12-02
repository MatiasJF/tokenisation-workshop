import 'dotenv/config'
import { PrivateKey } from '@bsv/sdk'

const {
  MINTER_PRIVATE_KEY,
  WALLET_PRIVATE_KEY
} = process.env

async function checkBalance(name: string, privateKeyHex: string) {
  const privateKey = PrivateKey.fromString(privateKeyHex, 'hex')
  const address = privateKey.toPublicKey().toAddress()

  console.log(`\n${name}:`)
  console.log(`  Address: ${address}`)
  console.log(`  Check balance: https://whatsonchain.com/address/${address}`)

  try {
    const response = await fetch(`https://api.whatsonchain.com/v1/bsv/main/address/${address}/balance`)
    if (response.ok) {
      const data = await response.json()
      const balanceInBSV = data.confirmed / 100000000
      const balanceInUSD = balanceInBSV * 50 // Approximate BSV price

      console.log(`  Balance: ${data.confirmed} satoshis (${balanceInBSV} BSV ≈ $${balanceInUSD.toFixed(2)} USD)`)

      if (data.confirmed === 0) {
        console.log(`  ⚠️  No funds! Send BSV to this address to use it.`)
      } else if (data.confirmed < 10000) {
        console.log(`  ⚠️  Low balance! Consider adding more BSV for multiple transactions.`)
      } else {
        console.log(`  ✅ Sufficient balance for minting tokens!`)
      }
    }
  } catch (error) {
    console.log(`  Could not fetch balance`)
  }
}

async function main() {
  console.log('\n╔════════════════════════════════════════╗')
  console.log('║   BSV Address Balance Checker         ║')
  console.log('╚════════════════════════════════════════╝')

  if (MINTER_PRIVATE_KEY) {
    await checkBalance('Minter Address', MINTER_PRIVATE_KEY)
  }

  if (WALLET_PRIVATE_KEY) {
    await checkBalance('Wallet Address', WALLET_PRIVATE_KEY)
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('\n💡 To use your BSV Desktop Wallet funds:')
  console.log('   You need to export your private key from BSV Desktop')
  console.log('   and add it to your .env file as MINTER_PRIVATE_KEY')
  console.log('\n   OR send BSV to one of the addresses above.')
  console.log()
}

main().catch(console.error)
