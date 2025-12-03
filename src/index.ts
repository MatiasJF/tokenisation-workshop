import 'dotenv/config'
import OverlayExpress from '@bsv/overlay-express'
import TokenTopicManager from './services/token/TokenTopicManager.js'
import createTokenLookupService from './services/token/TokenLookupService.js'
import TokenStorageManager from './services/token/TokenStorageManager.js'
import { MongoClient } from 'mongodb'

const {
  NODE_NAME = 'tokenworkshop',
  SERVER_PRIVATE_KEY,
  HOSTING_URL = 'http://localhost:8080',
  ADMIN_TOKEN = 'admin',
  MONGO_URL = 'mongodb://localhost:27017/tokenworkshop',
  KNEX_URL = 'mysql://root:password@localhost:3306/tokenworkshop'
} = process.env

if (!SERVER_PRIVATE_KEY) {
  throw new Error('SERVER_PRIVATE_KEY environment variable is required')
}

async function main() {
  console.log('🚀 Starting Tokenisation Workshop Overlay Server...')

  // Create OverlayExpress server
  const server = new OverlayExpress(
    NODE_NAME,
    SERVER_PRIVATE_KEY,
    HOSTING_URL,
    ADMIN_TOKEN
  )

  // Configure port (from HOSTING_URL or default 8080)
  const port = new URL(HOSTING_URL).port || '8080'
  server.configurePort(Number(port))

  // Configure databases using OverlayExpress methods
  await server.configureKnex(KNEX_URL)
  console.log('✓ MySQL/Knex connected')

  await server.configureMongo(MONGO_URL)
  console.log('✓ MongoDB connected')

  // Register Token Service
  server.configureTopicManager('tm_tokens', new TokenTopicManager())
  server.configureLookupServiceWithMongo('ls_tokens', createTokenLookupService)

  console.log('✓ Token service registered')

  // Disable GASP sync for simple workshop setup
  server.configureEnableGASPSync(false)

  // Configure the overlay engine
  await server.configureEngine()

  // Add custom endpoint for health check
  server.app.get('/health', async (req, res) => {
    res.json({
      status: 'healthy',
      node: NODE_NAME,
      services: ['tokens'],
      timestamp: new Date().toISOString()
    })
  })

  // Add custom endpoint for token balances (bypasses overlay engine enrichment)
  server.app.get('/token-balances', async (req, res) => {
    try {
      // Connect to MongoDB directly to bypass overlay engine BEEF enrichment
      const client = new MongoClient(MONGO_URL)
      await client.connect()

      // Parse database name from MONGO_URL
      const dbName = MONGO_URL.split('/').pop()?.split('?')[0] || 'tokenworkshop'
      const lookupDbName = `${dbName}_lookup_services`

      const db = client.db(lookupDbName)
      const storage = new TokenStorageManager(db)
      const balances = await storage.getAllBalances()

      await client.close()
      res.json(balances)
    } catch (error: any) {
      console.error('Error in /token-balances:', error)
      res.status(500).json({ error: error.message })
    }
  })

  // Add custom endpoint for token UTXOs (bypasses overlay engine enrichment)
  server.app.get('/token-utxos/:tokenId', async (req, res) => {
    try {
      const { tokenId } = req.params

      // Connect to MongoDB directly to bypass overlay engine BEEF enrichment
      const client = new MongoClient(MONGO_URL)
      await client.connect()

      // Parse database name from MONGO_URL
      const dbName = MONGO_URL.split('/').pop()?.split('?')[0] || 'tokenworkshop'
      const lookupDbName = `${dbName}_lookup_services`

      const db = client.db(lookupDbName)
      const storage = new TokenStorageManager(db)
      const records = await storage.findUnspentByTokenId(tokenId)

      await client.close()

      // Map to UTXO format expected by wallet
      const utxos = records.map(r => ({
        txid: r.txid,
        outputIndex: r.outputIndex,
        amount: r.amount,
        lockingScript: r.lockingScript,
        satoshis: r.satoshis
      }))

      res.json(utxos)
    } catch (error: any) {
      console.error('Error in /token-utxos:', error)
      res.status(500).json({ error: error.message })
    }
  })

  // Start the server
  await server.start()

  console.log(`
✨ Tokenisation Workshop Server Running!

🌐 Overlay URL: ${HOSTING_URL}
📦 Node Name: ${NODE_NAME}
🎯 Services: Token Mint & Wallet

Available Services:
  - Token Topic Manager: tm_tokens
  - Token Lookup Service: ls_tokens

Health Check: ${HOSTING_URL}/health
`)
}

main().catch(error => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
