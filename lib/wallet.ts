import { useEffect, useState } from "react"
import { WalletClient } from "@bsv/sdk"

export const useWallet = () => {
  const [wallet, setWallet] = useState<WalletClient | null>(null)
  const [identityKey, setIdentityKey] = useState<string | null>(null)

  async function initWallet() {
    try {
      const w = new WalletClient()
      const identityKey = await w.getPublicKey({ identityKey: true })
      setWallet(w)
      setIdentityKey(identityKey.publicKey)
      console.log('Wallet connected')
    } catch (error: any) {
      console.error('Wallet connection error:', error)
    }
  }

  useEffect(() => {
    initWallet()
  }, [])

  return {
    wallet,
    identityKey
  }
}