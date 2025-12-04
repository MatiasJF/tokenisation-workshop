import { Script, Utils } from '@bsv/sdk'

// Test what chunks our script creates
const ourScriptHex = '2102bab8e5984fd25618e2350fd4df8371c9afd90a7745d25751d52a519e31084eca7505544f4b454e20a15a336cd7581b2a7424c53c68b678c7a2e89beb64d6df3e3ee18e410d5f404f080c000000000000002103b1b8a7dd0231e0bde4f1adf8f5fe54db8c0bc7647d95d62a6d66d5900d6da0774c4f7b226e616d65223a22313233222c2273796d626f6c223a22313233222c22646563696d616c73223a302c22746f74616c537570706c79223a31322c226465736372697074696f6e223a22313233227d0175'

console.log('=== Analyzing Script Chunks ===\n')

const script = Script.fromHex(ourScriptHex)
console.log(`Total chunks: ${script.chunks.length}\n`)

for (let i = 0; i < script.chunks.length; i++) {
  const chunk = script.chunks[i]
  console.log(`Chunk ${i}:`)
  console.log(`  op: ${chunk.op} (0x${chunk.op.toString(16)})`)
  console.log(`  data: ${chunk.data ? `${chunk.data.length} bytes - ${Utils.toHex(chunk.data).slice(0, 40)}${chunk.data.length > 20 ? '...' : ''}` : 'null'}`)

  // Identify opcode
  if (chunk.op === 117) {
    console.log(`  → OP_DROP`)
  } else if (chunk.op === 172) {
    console.log(`  → OP_CHECKSIG`)
  } else if (chunk.data) {
    console.log(`  → PUSH DATA`)
  }
  console.log()
}
