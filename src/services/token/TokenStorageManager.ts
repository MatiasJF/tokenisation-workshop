import { Db, Collection } from 'mongodb'
import { Transaction, PushDrop, Utils } from '@bsv/sdk'

export interface TokenRecord {
  txid: string
  outputIndex: number
  tokenId: string
  amount: number
  metadata?: any
  lockingScript: string
  satoshis: number
  createdAt: Date
  spent: boolean
}

export interface TokenBalance {
  tokenId: string
  name?: string
  symbol?: string
  decimals?: number
  totalAmount: number
  utxos: Array<{
    txid: string
    outputIndex: number
    amount: number
  }>
}

/**
 * TokenStorageManager handles MongoDB operations for token data
 */
export default class TokenStorageManager {
  private readonly collection: Collection<TokenRecord>

  constructor(private readonly db: Db) {
    console.log('🗄️ [STORAGE] Initializing TokenStorageManager')
    console.log('🗄️ [STORAGE] Database name:', db.databaseName)
    this.collection = db.collection<TokenRecord>('tokens')
    console.log('🗄️ [STORAGE] Collection: tokens')
    this.ensureIndexes()
  }

  private async ensureIndexes() {
    await this.collection.createIndex({ txid: 1, outputIndex: 1 }, { unique: true })
    await this.collection.createIndex({ tokenId: 1 })
    await this.collection.createIndex({ tokenId: 1, spent: 1 })
    await this.collection.createIndex({ spent: 1 })
  }

  /**
   * Store a new token output
   */
  async storeToken(
    txid: string,
    outputIndex: number,
    tokenId: string,
    amount: number,
    metadata: any,
    lockingScript: string,
    satoshis: number
  ): Promise<void> {
    await this.collection.insertOne({
      txid,
      outputIndex,
      tokenId,
      amount,
      metadata,
      lockingScript,
      satoshis,
      createdAt: new Date(),
      spent: false
    })
  }

  /**
   * Mark a token output as spent
   */
  async markAsSpent(txid: string, outputIndex: number): Promise<void> {
    await this.collection.updateOne(
      { txid, outputIndex },
      { $set: { spent: true } }
    )
  }

  /**
   * Delete a token output (when evicted)
   */
  async deleteToken(txid: string, outputIndex: number): Promise<void> {
    await this.collection.deleteOne({ txid, outputIndex })
  }

  /**
   * Find all unspent tokens for a specific tokenId
   */
  async findUnspentByTokenId(tokenId: string): Promise<TokenRecord[]> {
    return await this.collection
      .find({ tokenId, spent: false })
      .toArray()
  }

  /**
   * Get balance for a specific tokenId
   */
  async getBalance(tokenId: string): Promise<TokenBalance> {
    const records = await this.findUnspentByTokenId(tokenId)

    const totalAmount = records.reduce((sum, record) => sum + record.amount, 0)

    // Get metadata from first record
    const metadata = records[0]?.metadata || {}

    return {
      tokenId,
      name: metadata.name,
      symbol: metadata.symbol,
      decimals: metadata.decimals || 0,
      totalAmount,
      utxos: records.map(r => ({
        txid: r.txid,
        outputIndex: r.outputIndex,
        amount: r.amount
      }))
    }
  }

  /**
   * Get all token balances (grouped by tokenId)
   */
  async getAllBalances(): Promise<TokenBalance[]> {
    console.log('🗄️ [STORAGE] getAllBalances called')
    console.log('🗄️ [STORAGE] Querying collection:', this.collection.collectionName)
    console.log('🗄️ [STORAGE] Database:', this.db.databaseName)
    const records = await this.collection
      .find({ spent: false })
      .toArray()
    console.log('🗄️ [STORAGE] Found records:', records.length)

    // Group by tokenId
    const balanceMap = new Map<string, TokenRecord[]>()
    for (const record of records) {
      const existing = balanceMap.get(record.tokenId) || []
      existing.push(record)
      balanceMap.set(record.tokenId, existing)
    }

    // Calculate balances
    const balances: TokenBalance[] = []
    for (const [tokenId, tokenRecords] of balanceMap) {
      const totalAmount = tokenRecords.reduce((sum, r) => sum + r.amount, 0)
      const metadata = tokenRecords[0]?.metadata || {}

      balances.push({
        tokenId,
        name: metadata.name,
        symbol: metadata.symbol,
        decimals: metadata.decimals || 0,
        totalAmount,
        utxos: tokenRecords.map(r => ({
          txid: r.txid,
          outputIndex: r.outputIndex,
          amount: r.amount
        }))
      })
    }

    return balances
  }

  /**
   * Find a specific token record
   */
  async findToken(txid: string, outputIndex: number): Promise<TokenRecord | null> {
    return await this.collection.findOne({ txid, outputIndex })
  }

  /**
   * Get transaction history for a tokenId
   */
  async getHistory(tokenId: string, limit = 50): Promise<TokenRecord[]> {
    return await this.collection
      .find({ tokenId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray()
  }
}
