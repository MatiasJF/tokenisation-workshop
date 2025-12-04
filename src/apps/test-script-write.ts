import { Script, Utils } from '@bsv/sdk'

console.log('=== Testing different ways to write OP_DROP at end ===\n')

// Method 1: writeOpCode
console.log('Method 1: writeOpCode(117)')
const script1 = new Script()
script1.writeBin([1, 2, 3])
script1.writeOpCode(117)
console.log(`Hex: ${script1.toHex()}`)
console.log(`Chunks: ${script1.chunks.length}`)
script1.chunks.forEach((c, i) => {
  console.log(`  Chunk ${i}: op=${c.op}, data=${c.data ? Utils.toHex(c.data) : 'null'}`)
})

// Method 2: Manually set the script bytes
console.log('\nMethod 2: Manual hex construction')
const script2Hex = '03010203' + '75'  // data + OP_DROP
const script2 = Script.fromHex(script2Hex)
console.log(`Hex: ${script2.toHex()}`)
console.log(`Chunks: ${script2.chunks.length}`)
script2.chunks.forEach((c, i) => {
  console.log(`  Chunk ${i}: op=${c.op}, data=${c.data ? Utils.toHex(c.data) : 'null'}`)
})

// Method 3: Try using toHex() then appending
console.log('\nMethod 3: Build script, get hex, append OP_DROP')
const script3 = new Script()
script3.writeBin([1, 2, 3])
const hex3 = script3.toHex() + '75'
const script3Final = Script.fromHex(hex3)
console.log(`Hex: ${hex3}`)
console.log(`Chunks: ${script3Final.chunks.length}`)
script3Final.chunks.forEach((c, i) => {
  console.log(`  Chunk ${i}: op=${c.op}, data=${c.data ? Utils.toHex(c.data) : 'null'}`)
})
