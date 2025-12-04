import { PushDrop, Script, Utils } from '@bsv/sdk'

// Test what format PushDrop.decode() expects

// Our current script format (from transaction):
const ourScriptHex = '2102bab8e5984fd25618e2350fd4df8371c9afd90a7745d25751d52a519e31084eca7505544f4b454e20a15a336cd7581b2a7424c53c68b678c7a2e89beb64d6df3e3ee18e410d5f404f080c000000000000002103b1b8a7dd0231e0bde4f1adf8f5fe54db8c0bc7647d95d62a6d66d5900d6da0774c4f7b226e616d65223a22313233222c2273796d626f6c223a22313233222c22646563696d616c73223a302c22746f74616c537570706c79223a31322c226465736372697074696f6e223a22313233227d0175'

console.log('\n=== Testing PushDrop.decode() with our script ===')
console.log(`Script hex (first 80 chars): ${ourScriptHex.slice(0, 80)}...`)
console.log(`Script length: ${ourScriptHex.length / 2} bytes`)

// Check opcodes
console.log('\n=== Checking for OP_DROP (0x75) ===')
const dropPositions: number[] = []
for (let i = 0; i < ourScriptHex.length; i += 2) {
  const byte = ourScriptHex.slice(i, i + 2)
  if (byte === '75') {
    dropPositions.push(i / 2)
    console.log(`Found 0x75 at byte position ${i / 2}`)
  }
}

console.log('\n=== Attempting to decode ===')
try {
  const result = PushDrop.decode({
    script: ourScriptHex,
    fieldFormat: 'buffer'
  } as any)

  console.log('✅ Decode successful!')
  console.log(`Fields: ${result.fields.length}`)

  for (let i = 0; i < result.fields.length; i++) {
    const field = result.fields[i] as number[]
    console.log(`\nField ${i}:`)
    console.log(`  Length: ${field.length} bytes`)
    console.log(`  Hex: ${Utils.toHex(field).slice(0, 60)}${field.length > 30 ? '...' : ''}`)
  }
} catch (e: any) {
  console.log(`❌ Decode failed: ${e.message}`)
  console.log(`Stack: ${e.stack}`)
}

// Now test with PushDrop.lock() to see what IT creates
console.log('\n\n=== Testing PushDrop.lock() output ===')
try {
  const testFields = [
    Utils.toArray('TOKEN', 'utf8'),
    Utils.toArray('a15a336cd7581b2a7424c53c68b678c7a2e89beb64d6df3e3ee18e410d5f404f', 'hex'),
    [12, 0, 0, 0, 0, 0, 0, 0],
    Utils.toArray('03b1b8a7dd0231e0bde4f1adf8f5fe54db8c0bc7647d95d62a6d66d5900d6da077', 'hex')
  ]

  // We can't easily test PushDrop.lock() without a wallet, but we can examine the script structure
  console.log('Test fields prepared:')
  testFields.forEach((f, i) => {
    console.log(`  Field ${i}: ${f.length} bytes`)
  })
} catch (e: any) {
  console.log(`Error: ${e.message}`)
}
