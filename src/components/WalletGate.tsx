import type { ReactNode } from 'react'
import { ConnectKitButton } from 'connectkit'
import { useAccount, useSwitchChain } from 'wagmi'
import { ARC_TESTNET_ID } from '@/lib/maxi'

/** Renders its children only when a wallet is connected on Arc Testnet; otherwise the one fix-it button. */
export function WalletGate({ children }: { children: ReactNode }) {
  const { isConnected, chainId } = useAccount()
  const { switchChain, isPending } = useSwitchChain()

  if (!isConnected) {
    return (
      <ConnectKitButton.Custom>
        {({ show }) => (
          <button className="btn btn-primary w-full" onClick={show}>
            Connect wallet
          </button>
        )}
      </ConnectKitButton.Custom>
    )
  }

  if (chainId !== ARC_TESTNET_ID) {
    return (
      <button
        className="btn btn-primary w-full"
        disabled={isPending}
        onClick={() => switchChain({ chainId: ARC_TESTNET_ID })}
      >
        {isPending ? 'Switching...' : 'Switch to Arc Testnet'}
      </button>
    )
  }

  return <>{children}</>
}
