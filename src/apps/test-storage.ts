import 'dotenv/config'
import { MongoClient } from 'mongodb'
import TokenStorageManager from '../services/token/TokenStorageManager.js'

const { MONGO_URL = 'mongodb://localhost:27017/tokenworkshop' } = process.env

async function main() {
  const client = new MongoClient(MONGO_URL)
  await client.connect()
  const db = client.db()

  const storage = new TokenStorageManager(db)
  const balances = await storage.getAllBalances()

  console.log('getAllBalances result:')
  console.log(JSON.stringify(balances, null, 2))

  await client.close()
}

main().catch(console.error)
