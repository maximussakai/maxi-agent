import { ConnectKitButton } from 'connectkit'
import { IdentityPanel } from '@/components/IdentityPanel'
import { ServicePanel } from '@/components/ServicePanel'
import { ReputationPanel } from '@/components/ReputationPanel'
import { ReceiptsPanel } from '@/components/ReceiptsPanel'
import { useAgentId } from '@/hooks/useAgentId'
import { useMaxiInfo } from '@/hooks/useMaxiInfo'

function MaxiMark() {
  return (
    <div
      className="display flex h-11 w-11 items-center justify-center rounded-2xl text-xl font-bold"
      style={{ background: 'var(--accent)', color: '#0d1b2f' }}
      aria-hidden
    >
      M
    </div>
  )
}

export default function App() {
  const { agentId, registerTx, setAgentId } = useAgentId()
  const { data: info } = useMaxiInfo()

  return (
    <div className="mx-auto min-h-dvh max-w-6xl px-4 pb-24 pt-6 sm:px-6">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <MaxiMark />
          <div>
            <h1 className="display text-2xl font-semibold leading-none">Maxi</h1>
            <p className="mt-1 text-xs" style={{ color: 'var(--subtle)' }}>
              Onchain agent on Arc Testnet
            </p>
          </div>
        </div>
        <ConnectKitButton />
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <IdentityPanel info={info} agentId={agentId} registerTx={registerTx} onAgentId={setAgentId} />
          <ReputationPanel agentId={agentId} />
        </div>
        <div className="space-y-6">
          <ServicePanel info={info} />
          <ReceiptsPanel sellerAddress={info?.sellerAddress} />
        </div>
      </div>
    </div>
  )
}
