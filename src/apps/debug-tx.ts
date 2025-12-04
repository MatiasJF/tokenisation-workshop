import { Transaction, PushDrop, Utils } from '@bsv/sdk'

const txHex = `0100000001884e36027fbb3f897deb5bce24acbc09fa550db5fb7a5ce28e24b4f1ed862450020000006a473044022042462eef478aeb20e853017887b4033fa6adca2b1699074a32e3c13ba85a65f202206ffaacecd6283f9a2bca2c78009b7e87fc21a96e41aa7096978d22f956a294e7412102f1d724dfd266d9a6fd089f80ca2d59592cee669350a69a5ba5ba2a6c4a8b7328ffffffff03e803000000000000fd1d012103f6ea6d2cd146a7ea1ca84977446392a15c91763cf007f9540848dd0978f141b5ac05544f4b454e2037abfe013c024259138e73331ef424ab3a1291a666969841bbf1272517c103fc080c000000000000002103b1b8a7dd0231e0bde4f1adf8f5fe54db8c0bc7647d95d62a6d66d5900d6da077b50100000000000076a9143b3b8b7d5fcb05b67b1d55ee52ecbb4ad7e3f3ae88ace60401000000000017a9140b9ebf0e0c40bb0023a6e06cfeba0e06b51f478b8700000000`

const tx = Transaction.fromHex(txHex)
console.log(`Transaction has ${tx.outputs.length} outputs\n`)

for (let i = 0; i < tx.outputs.length; i++) {
  console.log(`\n===== Output ${i} =====`)
  const output = tx.outputs[i]
  console.log(`Satoshis: ${output.satoshis}`)
  console.log(`Script hex: ${output.lockingScript.toHex()}`)
  console.log(`Script length: ${output.lockingScript.toHex().length / 2} bytes`)

  try {
    const result = PushDrop.decode({
      script: output.lockingScript.toHex(),
      fieldFormat: 'buffer'
    } as any)

    console.log(`\nPushDrop decoded successfully!`)
    console.log(`Number of fields: ${result.fields.length}`)

    for (let j = 0; j < result.fields.length; j++) {
      const field = result.fields[j] as number[]
      console.log(`\nField ${j}:`)
      console.log(`  Length: ${field.length} bytes`)
      console.log(`  Hex: ${Utils.toHex(field)}`)

      // Try to interpret
      if (field.length === 33 && (field[0] === 2 || field[0] === 3)) {
        console.log(`  Type: Likely a compressed public key`)
      } else if (field.length <= 10) {
        try {
          const str = Utils.toUTF8(field)
          if (/^[a-zA-Z0-9]+$/.test(str)) {
            console.log(`  String: "${str}"`)
          }
        } catch {}
      }
    }
  } catch (e: any) {
    console.log(`Failed to decode as PushDrop: ${e.message}`)
  }
}
