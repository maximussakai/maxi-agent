import { useCallback, useState } from 'react'

const ID_KEY = 'maxi:agentId'
const TX_KEY = 'maxi:registerTx'

function readId(): bigint | undefined {
  try {
    const raw = localStorage.getItem(ID_KEY)
    return raw ? BigInt(raw) : undefined
  } catch {
    return undefined
  }
}

/** Remembers which ERC-8004 agent ID is Maxi in this browser. */
export function useAgentId() {
  const [agentId, setAgentIdState] = useState<bigint | undefined>(readId)
  const [registerTx, setRegisterTxState] = useState<string | null>(() => localStorage.getItem(TX_KEY))

  const setAgentId = useCallback((id: bigint | undefined, tx?: string) => {
    if (id === undefined) {
      localStorage.removeItem(ID_KEY)
      localStorage.removeItem(TX_KEY)
      setRegisterTxState(null)
    } else {
      localStorage.setItem(ID_KEY, id.toString())
      if (tx) {
        localStorage.setItem(TX_KEY, tx)
        setRegisterTxState(tx)
      }
    }
    setAgentIdState(id)
  }, [])

  return { agentId, registerTx, setAgentId }
}
