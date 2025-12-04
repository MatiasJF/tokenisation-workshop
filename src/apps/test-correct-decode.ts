import { PushDrop, Script, Utils } from '@bsv/sdk'

console.log('=== Testing CORRECT PushDrop.decode() usage ===\n')

const lockingKey = '02bab8e5984fd25618e2350fd4df8371c9afd90a7745d25751d52a519e31084eca'
const tokenId = 'a15a336cd7581b2a7424c53c68b678c7a2e89beb64d6df3e3ee18e410d5f404f'
const amount = [12, 0, 0, 0, 0, 0, 0, 0]
const ownerKey = '03b1b8a7dd0231e0bde4f1adf8f5fe54db8c0bc7647d95d62a6d66d5900d6da077'
const metadata = JSON.stringify({name: "test", symbol: "TST", decimals: 0, totalSupply: 12})

// Create our script
const script = new Script()
script.writeBin(Utils.toArray(lockingKey, 'hex'))
script.writeOpCode(117) // OP_DROP
script.writeBin(Utils.toArray('TOKEN', 'utf8'))
script.writeBin(Utils.toArray(tokenId, 'hex'))
script.writeBin(amount)
script.writeBin(Utils.toArray(ownerKey, 'hex'))
script.writeBin(Utils.toArray(metadata, 'utf8'))
script.writeOpCode(117) // OP_DROP

console.log(`Script created with ${script.chunks.length} chunks`)
console.log(`Script hex (first 60): ${script.toHex().slice(0, 60)}...\n`)

// WRONG WAY (what we were doing):
console.log('❌ WRONG: Passing object with script property')
try {
  const wrongResult = PushDrop.decode({
    script: script.toHex(),
    fieldFormat: 'buffer'
  } as any)
  console.log('  Unexpectedly succeeded!')
} catch (e: any) {
  console.log(`  Failed as expected: ${e.message}`)
}

// CORRECT WAY: Pass the Script object directly
console.log('\n✅ CORRECT: Passing Script object directly')
try {
  const result = PushDrop.decode(script)

  console.log('  SUCCESS! Decoded:')
  console.log(`  Locking key: ${result.lockingPublicKey}`)
  console.log(`  Fields: ${result.fields.length}`)

  result.fields.forEach((field, i) => {
    console.log(`\n  Field ${i}:`)
    console.log(`    Length: ${field.length} bytes`)
    console.log(`    Hex: ${Utils.toHex(field).slice(0, 60)}${field.length > 30 ? '...' : ''}`)

    // Try to interpret
    if (i === 0) {
      try {
        const str = Utils.toUTF8(field)
        console.log(`    String: "${str}"`)
      } catch {}
    } else if (i === 1) {
      console.log(`    Token ID: ${Utils.toHex(field)}`)
    } else if (i === 2) {
      let amt = 0
      for (let j = 0; j < 8; j++) {
        amt += field[j] * Math.pow(256, j)
      }
      console.log(`    Amount: ${amt}`)
    } else if (i === 3) {
      console.log(`    Owner key: ${Utils.toHex(field)}`)
    } else if (i === 4) {
      try {
        const str = Utils.toUTF8(field)
        console.log(`    Metadata: ${str}`)
      } catch {}
    }
  })

  console.log('\n🎉 PushDrop decode works correctly!')

} catch (e: any) {
  console.log(`  FAILED: ${e.message}`)
  console.log(`  Stack: ${e.stack}`)
}
