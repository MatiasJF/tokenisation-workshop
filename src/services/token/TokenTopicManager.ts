import { TopicManager, AdmittanceInstructions } from '@bsv/overlay'
import { Transaction, PushDrop, Utils, BigNumber } from '@bsv/sdk'

/**
 * TokenTopicManager validates token transactions for the overlay.
 */
export default class TokenTopicManager implements TopicManager {

  async identifyAdmissibleOutputs(
    beef: number[],
    previousCoins: number[]
  ): Promise<AdmittanceInstructions> {
    console.log('Identifying admissible outputs...')
    const outputsToAdmit: number[] = []

    try {
      // Parse transaction from BEEF
      const tx = Transaction.fromBEEF(beef)

      // Check each output
      for (let i = 0; i < tx.outputs.length; i++) {
        try {
          const output = tx.outputs[i]

          // Decode using PushDrop (BRC-48)
          const { fields } = PushDrop.decode(output.lockingScript)

          // Validate token protocol (PushDrop has lockingKey as field 0)
          if (fields.length < 5) {
            console.log(`Output ${i}: Rejected - insufficient fields (need at least 5, got ${fields.length})`)
            continue
          }

          const field0Value = Utils.toUTF8(fields[0])
          if (field0Value !== 'TOKEN') {
            console.log(`Output ${i}: Rejected - field[0] is not 'TOKEN' (got '${field0Value}')`)
            continue
          }

          const field1Value = Utils.toHex(fields[1])
          if (field1Value !== '0000000000000000000000000000000000000000000000000000000000000001') {
            console.log(`Output ${i}: Rejected - field[1] tokenId mismatch (expected '0000000000000000000000000000000000000000000000000000000000000001', got '${field1Value}')`)
            continue
          }

          const reader = new Utils.Reader(fields[2])
          const amount = reader.readUInt64LEBn()
          if (amount < new BigNumber(0) || amount > new BigNumber(BigInt(Number.MAX_SAFE_INTEGER))) {
            console.log(`Output ${i}: Rejected - amount out of range (got ${amount.toString()})`)
            continue
          }

          const jsonMetadata = JSON.parse(Utils.toUTF8(fields[3]))
          if (!jsonMetadata) {
            console.log(`Output ${i}: Rejected - no metadata found`)
            continue
          }

          if (jsonMetadata.name !== 'goose') {
            console.log(`Output ${i}: Rejected - metadata.name is not 'goose' (got '${jsonMetadata.name}')`)
            continue
          }

          if (jsonMetadata.symbol !== 'GOOSE') {
            console.log(`Output ${i}: Rejected - metadata.symbol is not 'GOOSE' (got '${jsonMetadata.symbol}')`)
            continue
          }

          if (jsonMetadata.decimals !== 5) {
            console.log(`Output ${i}: Rejected - metadata.decimals is not 5 (got ${jsonMetadata.decimals})`)
            continue
          }

          if (jsonMetadata.description !== 'something nice') {
            console.log(`Output ${i}: Rejected - metadata.description is not 'something nice' (got '${jsonMetadata.description}')`)
            continue
          }

          // Output is valid
          console.log(`Output ${i}: ACCEPTED - all validation checks passed`)
          outputsToAdmit.push(i)

        } catch (err) {
          // Skip invalid outputs silently
          console.log(`Output ${i}: Rejected - error during processing: ${err}`)
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
