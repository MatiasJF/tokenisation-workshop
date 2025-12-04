import { TopicManager, AdmittanceInstructions } from '@bsv/overlay'
import { Transaction, PushDrop, Utils } from '@bsv/sdk'

/**
 * TokenTopicManager validates token transactions for the overlay.
 *
 * Token Protocol (PushDrop - BRC-48):
 * - Output format: <lockingKey> OP_DROP <protocol> <tokenId> <amount> <ownerKey> [<metadata>]
 * - lockingKey: 33-byte compressed public key (who can spend this UTXO)
 * - protocol: 'TOKEN' (UTF-8)
 * - tokenId: 32-byte hex identifier
 * - amount: 8-byte integer (token amount)
 * - ownerKey: 33-byte identity key (who owns these tokens)
 * - metadata: optional JSON data
 */
export default class TokenTopicManager implements TopicManager {

  async identifyAdmissibleOutputs(
    beef: number[],
    previousCoins: number[]
  ): Promise<AdmittanceInstructions> {
    const outputsToAdmit: number[] = []

    try {
      // Parse transaction from BEEF
      const tx = Transaction.fromBEEF(beef)

      // Check each output
      for (let i = 0; i < tx.outputs.length; i++) {
        try {
          const output = tx.outputs[i]

          // Decode using PushDrop (BRC-48)
          const result = PushDrop.decode({
            script: output.lockingScript.toHex(),
            fieldFormat: 'buffer'
          } as any)

          // Validate token protocol (PushDrop has lockingKey as field 0)
          if (result.fields.length < 5) continue // Need at least: lockingKey, protocol, tokenId, amount, ownerKey

          const lockingKey = Utils.toHex(result.fields[0] as number[])
          const protocol = Utils.toUTF8(result.fields[1] as number[])

          if (protocol !== 'TOKEN') continue

          // Validate lockingKey (33 bytes compressed public key)
          if (lockingKey.length !== 66) continue

          const tokenId = Utils.toHex(result.fields[2] as number[])
          const amountBuffer = result.fields[3] as number[]
          const ownerKey = Utils.toHex(result.fields[4] as number[])

          // Validate tokenId (32 bytes)
          if (tokenId.length !== 64) continue

          // Validate amount (8 bytes)
          if (amountBuffer.length !== 8) continue

          // Validate ownerKey (33 bytes compressed public key)
          if (ownerKey.length !== 66) continue

          // Parse amount as 64-bit integer
          const amount = this.parseAmount(amountBuffer)
          if (amount <= 0) continue

          // Optional metadata validation (field 5)
          if (result.fields.length >= 6) {
            try {
              const metadata = Utils.toUTF8(result.fields[5] as number[])
              JSON.parse(metadata) // Ensure valid JSON
            } catch {
              // Invalid metadata, skip
              continue
            }
          }

          // Output is valid
          outputsToAdmit.push(i)

        } catch (err) {
          // Skip invalid outputs silently
          continue
        }
      }

    } catch (error) {
      console.error('Error processing transaction:', error)
    }

    return {
      outputsToAdmit,
      coinsToRetain: []
    }
  }

  /**
   * Parse 8-byte buffer to integer (little-endian)
   */
  private parseAmount(buffer: number[]): number {
    let amount = 0
    for (let i = 0; i < 8; i++) {
      amount += buffer[i] * Math.pow(256, i)
    }
    return amount
  }

  async getDocumentation(): Promise<string> {
    return `# Token Overlay Service (Spendable PushDrop)

## Purpose
Validates and tracks fungible token transactions on the BSV blockchain using spendable PushDrop (BRC-48) outputs.

## Token Protocol

### Output Format (PushDrop - BRC-48)
\`\`\`
<lockingKey> OP_DROP <protocol> <tokenId> <amount> <ownerKey> [<metadata>]
\`\`\`

### Fields
- **lockingKey**: 33-byte compressed public key (who can spend this UTXO)
- **protocol**: 'TOKEN' (UTF-8 string)
- **tokenId**: 32-byte hex identifier (unique per token type)
- **amount**: 8-byte integer (token units, little-endian)
- **ownerKey**: 33-byte identity key (who owns these tokens)
- **metadata**: Optional JSON object with token information

### Spendable Tokens
Unlike OP_RETURN, PushDrop tokens are **spendable UTXOs**:
- Can be spent as inputs in transactions
- Require signature from the lockingKey to spend
- Contain both token data AND value (satoshis)
- Enable true P2P token transfers

### Examples

#### Mint New Token
\`\`\`
lockingKey: '02ea3bcf...' (33 bytes - minter's public key)
protocol: 'TOKEN'
tokenId: 'a1b2c3d4...' (32 bytes)
amount: 1000000 (1 million tokens)
ownerKey: '02ea3bcf...' (33 bytes - minter's identity key)
metadata: {
  "name": "Workshop Token",
  "symbol": "WST",
  "decimals": 6,
  "description": "Example fungible token"
}
\`\`\`

#### Transfer Token
\`\`\`
lockingKey: '03b1b8a7...' (33 bytes - recipient's public key)
protocol: 'TOKEN'
tokenId: 'a1b2c3d4...' (same as minted)
amount: 50000 (50k tokens)
ownerKey: '03b1b8a7...' (33 bytes - recipient's identity key)
metadata: {} (inherited from mint)
\`\`\`

## Validation Rules
1. Must have at least 5 fields (lockingKey, protocol, tokenId, amount, ownerKey)
2. LockingKey must be exactly 33 bytes (compressed public key)
3. Protocol must be 'TOKEN'
4. TokenId must be exactly 32 bytes
5. Amount must be 8 bytes and greater than 0
6. OwnerKey must be exactly 33 bytes (compressed public key)
7. Metadata must be valid JSON if present
8. Outputs not matching these rules are rejected

## Usage
- Mint Service: Creates new spendable token UTXOs
- Wallet Service: Spends token UTXOs and creates new outputs for recipients
- Lookup Service: Queries balances and transaction history
`
  }

  async getMetaData() {
    return {
      name: 'Token Overlay',
      shortDescription: 'Fungible token minting and transfers',
      iconURL: 'https://example.com/token-icon.png',
      version: '1.0.0',
      informationURL: 'https://example.com/token-docs'
    }
  }
}
