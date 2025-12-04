import { PushDrop, Script, Utils, PrivateKey } from '@bsv/sdk'

console.log('=== Testing PushDrop Format Requirements ===\n')

// Let's understand what PushDrop.decode() actually expects by looking at the source
// From PushDrop.ts line 70: it expects script.chunks[0].data to contain the locking public key
// From line 74: it iterates from chunk index 2 onwards to get fields
// This means: chunk 0 = locking key push, chunk 1 = OP_DROP, chunks 2+ = data fields, last chunk = OP_DROP

console.log('Understanding from PushDrop.decode() source code:')
console.log('  - Chunk 0: Must be PUSH of locking public key (script.chunks[0].data)')
console.log('  - Chunk 1: Should be OP_DROP (skipped in iteration)')
console.log('  - Chunks 2+: Data fields')
console.log('  - Last chunk: OP_DROP (stops iteration)')
console.log()

// Let's manually create a script that matches this exact structure
console.log('=== Creating test script matching expected structure ===\n')

const lockingKey = '02bab8e5984fd25618e2350fd4df8371c9afd90a7745d25751d52a519e31084eca'
const tokenId = 'a15a336cd7581b2a7424c53c68b678c7a2e89beb64d6df3e3ee18e410d5f404f'
const amount = [12, 0, 0, 0, 0, 0, 0, 0]
const ownerKey = '03b1b8a7dd0231e0bde4f1adf8f5fe54db8c0bc7647d95d62a6d66d5900d6da077'
const metadata = JSON.stringify({name: "test", symbol: "TST", decimals: 0, totalSupply: 12})

// Method 1: Using our current approach
console.log('Method 1: Current writeBin + writeOpCode approach')
const script1 = new Script()
script1.writeBin(Utils.toArray(lockingKey, 'hex'))
script1.writeOpCode(117) // OP_DROP
script1.writeBin(Utils.toArray('TOKEN', 'utf8'))
script1.writeBin(Utils.toArray(tokenId, 'hex'))
script1.writeBin(amount)
script1.writeBin(Utils.toArray(ownerKey, 'hex'))
script1.writeBin(Utils.toArray(metadata, 'utf8'))
script1.writeOpCode(117) // OP_DROP

console.log(`Chunks: ${script1.chunks.length}`)
script1.chunks.forEach((c, i) => {
  console.log(`  ${i}: op=${c.op} (${c.op === 117 ? 'OP_DROP' : 'push'}), data=${c.data ? c.data.length + 'b' : 'null'}`)
})

console.log('\nTrying to decode with PushDrop.decode():')
try {
  const result = PushDrop.decode({
    script: script1.toHex(),
    fieldFormat: 'buffer'
  } as any)

  console.log('✅ SUCCESS! Decoded fields:')
  console.log(`  Locking key: ${result.lockingPublicKey}`)
  console.log(`  Fields: ${result.fields.length}`)
  result.fields.forEach((f, i) => {
    const field = f as number[]
    console.log(`    Field ${i}: ${field.length} bytes - ${Utils.toHex(field).slice(0, 40)}...`)
  })
} catch (e: any) {
  console.log(`❌ FAILED: ${e.message}`)
  console.log(`   Error at: ${e.stack?.split('\n')[1]?.trim()}`)

  // Debug: Check what chunk 0 contains
  console.log('\n   Debugging chunk 0:')
  console.log(`   chunks[0].op: ${script1.chunks[0]?.op}`)
  console.log(`   chunks[0].data: ${script1.chunks[0]?.data ? 'exists (' + script1.chunks[0].data.length + ' bytes)' : 'NULL/UNDEFINED'}`)

  if (script1.chunks[0]?.data) {
    console.log(`   chunks[0].data hex: ${Utils.toHex(script1.chunks[0].data)}`)
  }
}

// Method 2: Try creating via fromHex to see if serialization is the issue
console.log('\n\n=== Method 2: Serialize and re-parse ===')
const script2 = Script.fromHex(script1.toHex())
console.log(`Chunks after re-parsing: ${script2.chunks.length}`)
script2.chunks.forEach((c, i) => {
  console.log(`  ${i}: op=${c.op}, data=${c.data ? c.data.length + 'b' : 'null'}`)
})

try {
  const result2 = PushDrop.decode({
    script: script2.toHex(),
    fieldFormat: 'buffer'
  } as any)
  console.log('✅ SUCCESS after re-parsing!')
} catch (e: any) {
  console.log(`❌ STILL FAILS: ${e.message}`)
}
