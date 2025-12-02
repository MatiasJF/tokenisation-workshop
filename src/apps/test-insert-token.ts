import 'dotenv/config'
import { MongoClient } from 'mongodb'

const { MONGO_URL = 'mongodb://localhost:27017/tokenworkshop' } = process.env

async function main() {
  const client = new MongoClient(MONGO_URL)

  try {
    await client.connect()
    const db = client.db()
    const collection = db.collection('tokens')

    // Insert your real minted token
    await collection.insertOne({
      txid: '28165099e74a7e8ee037adbd021706f37b7b36ce211be92c261888a65fa10b24',
      outputIndex: 0,
      tokenId: '8837ea9357f2e1358c68f4455e0cf2252a9d7db0378f4a01a39a59058a966f14',
      amount: 1,
      lockingScript: '',
      satoshis: 1,
      spent: false,
      createdAt: new Date(),
      metadata: {
        name: 'test',
        symbol: '>',
        decimals: 0,
        totalSupply: 1,
        description: 'test'
      }
    })

    console.log('✅ Token inserted into overlay database!')
    console.log('   Token ID: 8837ea9357f2e1358c68f4455e0cf2252a9d7db0378f4a01a39a59058a966f14')
    console.log('   TXID: 28165099e74a7e8ee037adbd021706f37b7b36ce211be92c261888a65fa10b24')
    console.log('\n Now run: npm run wallet')

  } finally {
    await client.close()
  }
}

main().catch(console.error)
