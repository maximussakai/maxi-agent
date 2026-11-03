import { useEffect, useMemo, useState } from 'react'
import { useAccount, usePublicClient, useReadContracts, useWriteContract } from 'wagmi'
import { parseEventLogs } from 'viem'
import { BadgeCheck, ExternalLink, Fingerprint, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { WalletGate } from './WalletGate'
import { buildAddressExplorerUrl, buildTxExplorerUrl } from '@/onchain-facts'
import { getShareBase } from '@/lib/share'
import { shortAddress, parseOnchainError, isUserRejection } from '@/lib/format'
import {
  ARC_TESTNET_ID,
  IDENTITY_REGISTRY,
  buildAgentCard,
  cardToDataUri,
  dataUriToCard,
  identityAbi,
  type MaxiInfo,
} from '@/lib/maxi'

interface Props {
  info: MaxiInfo | undefined
  agentId: bigint | undefined
  registerTx: string | null
  onAgentId: (id: bigint | undefined, tx?: string) => void
}

type Phase = 'idle' | 'signing' | 'confirming'

export function IdentityPanel({ info, agentId, registerTx, onAgentId }: Props) {
  const { address } = useAccount()
  const publicClient = usePublicClient({ chainId: ARC_TESTNET_ID })
  const { writeContractAsync } = useWriteContract()

  const [serviceUrl, setServiceUrl] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [lookupId, setLookupId] = useState('')

  useEffect(() => {
    let live = true
    void getShareBase().then((base) => {
      if (live) setServiceUrl((cur) => cur || `${base}/api/brief`)
    })
    return () => {
      live = false
    }
  }, [])

  const card = useMemo(
    () => (info ? buildAgentCard({ serviceUrl, payTo: info.sellerAddress }) : undefined),
    [info, serviceUrl],
  )

  const identity = { address: IDENTITY_REGISTRY, abi: identityAbi, chainId: ARC_TESTNET_ID } as const
  const { data: onchain, refetch } = useReadContracts({
    allowFailure: true,
    contracts:
      agentId === undefined
        ? []
        : [
            { ...identity, functionName: 'ownerOf', args: [agentId] },
            { ...identity, functionName: 'tokenURI', args: [agentId] },
          ],
    query: { enabled: agentId !== undefined },
  })

  const owner = onchain?.[0]?.status === 'success' ? (onchain[0].result as string) : undefined
  const uri = onchain?.[1]?.status === 'success' ? (onchain[1].result) : undefined
  const storedCard = uri ? dataUriToCard(uri) : undefined
  const isOwner = !!address && !!owner && owner.toLowerCase() === address.toLowerCase()
  const needsLink = !!storedCard && storedCard.registrations.length === 0

  async function register() {
    if (!card || !publicClient || !serviceUrl) return
    try {
      setPhase('signing')
      const hash = await writeContractAsync({
        ...identity,
        functionName: 'register',
        args: [cardToDataUri(card)],
      })
      setPhase('confirming')
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      if (receipt.status !== 'success') throw new Error('reverted')
      const [event] = parseEventLogs({ abi: identityAbi, eventName: 'Registered', logs: receipt.logs })
      if (!event) throw new Error('Registered event not found')
      onAgentId(event.args.agentId, hash)
      toast.success(`Maxi is registered as agent #${event.args.agentId.toString()}`)
    } catch (err) {
      if (!isUserRejection(err)) toast.error(parseOnchainError(err))
    } finally {
      setPhase('idle')
    }
  }

  async function linkId() {
    if (!publicClient || agentId === undefined || !storedCard) return
    try {
      setPhase('signing')
      const next = {
        ...storedCard,
        registrations: buildAgentCard({
          serviceUrl: '',
          payTo: storedCard.payTo,
          agentId: Number(agentId),
        }).registrations,
      }
      const hash = await writeContractAsync({
        ...identity,
        functionName: 'setAgentURI',
        args: [agentId, cardToDataUri(next)],
      })
      setPhase('confirming')
      await publicClient.waitForTransactionReceipt({ hash })
      await refetch()
      toast.success('Agent ID linked into Maxi\'s card')
    } catch (err) {
      if (!isUserRejection(err)) toast.error(parseOnchainError(err))
    } finally {
      setPhase('idle')
    }
  }

  const busy = phase !== 'idle'
  const busyLabel = phase === 'signing' ? 'Confirm in wallet...' : 'Confirming onchain...'

  return (
    <section className="card p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">ERC-8004 identity</p>
          <h2 className="display mt-1 text-2xl font-semibold text-balance">
            {agentId === undefined ? 'Give Maxi an onchain identity' : 'Maxi is registered on Arc'}
          </h2>
        </div>
        {agentId !== undefined && <BadgeCheck className="mt-1 shrink-0" style={{ color: 'var(--success)' }} size={26} />}
      </div>

      {agentId === undefined ? (
        <div className="mt-5 space-y-4">
          <p className="max-w-prose text-pretty text-sm" style={{ color: 'var(--muted)' }}>
            Registering mints Maxi as an ERC-721 agent in Arc's identity registry. Your connected wallet becomes the
            owner. The registration card is stored fully onchain, so no hosting is needed.
          </p>
          <label className="block">
            <span className="eyebrow">x402 service URL in the card</span>
            <input
              className="field mono mt-1.5 text-[13px]"
              value={serviceUrl}
              onChange={(e) => setServiceUrl(e.target.value)}
              placeholder="https://your-deployed-app.example/api/brief"
              spellCheck={false}
            />
          </label>
          {card && (
            <details className="well p-4 text-sm">
              <summary className="cursor-pointer font-medium">Preview registration card</summary>
              <pre className="mono mt-3 overflow-x-auto text-xs" style={{ color: 'var(--muted)' }}>
                {JSON.stringify(card, null, 2)}
              </pre>
            </details>
          )}
          <WalletGate>
            <button className="btn btn-primary w-full" disabled={busy || !card || !serviceUrl} onClick={() => void register()}>
              {busy ? (
                <>
                  <Loader2 className="animate-spin" size={16} /> {busyLabel}
                </>
              ) : (
                <>
                  <Fingerprint size={16} /> Register Maxi
                </>
              )}
            </button>
          </WalletGate>
          <div className="flex items-center gap-2 pt-1">
            <input
              className="field mono text-[13px]"
              inputMode="numeric"
              value={lookupId}
              onChange={(e) => setLookupId(e.target.value.replace(/\D/g, ''))}
              placeholder="Already registered? Agent ID"
            />
            <button
              className="btn btn-ghost shrink-0"
              disabled={!lookupId}
              onClick={() => onAgentId(BigInt(lookupId))}
            >
              Load
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Stat label="Agent ID" value={`#${agentId.toString()}`} big />
            <Stat
              label="Owner"
              value={owner ? shortAddress(owner) : 'Loading...'}
              href={owner ? buildAddressExplorerUrl(ARC_TESTNET_ID, owner) : undefined}
            />
            <Stat
              label="Payment address"
              value={storedCard?.payTo ? shortAddress(storedCard.payTo) : 'Not in card'}
              href={storedCard?.payTo ? buildAddressExplorerUrl(ARC_TESTNET_ID, storedCard.payTo) : undefined}
            />
            <Stat label="x402 support" value={storedCard ? (storedCard.x402Support ? 'Advertised' : 'No') : 'Unknown'} />
          </div>
          {uri && !storedCard && (
            <p className="text-xs" style={{ color: 'var(--subtle)' }}>
              This agent's card is hosted at an external URI, so it can't be previewed here.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {registerTx && (
              <a
                className="btn btn-ghost"
                href={buildTxExplorerUrl(ARC_TESTNET_ID, registerTx)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Registration tx <ExternalLink size={14} />
              </a>
            )}
            <a
              className="btn btn-ghost"
              href={buildAddressExplorerUrl(ARC_TESTNET_ID, IDENTITY_REGISTRY)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Registry <ExternalLink size={14} />
            </a>
            <button className="btn btn-ghost" onClick={() => onAgentId(undefined)}>
              Switch agent
            </button>
          </div>
          {needsLink && isOwner && (
            <WalletGate>
              <button className="btn btn-primary w-full" disabled={busy} onClick={() => void linkId()}>
                {busy ? busyLabel : 'Link agent ID into Maxi\'s card'}
              </button>
            </WalletGate>
          )}
          {needsLink && !isOwner && (
            <p className="text-xs" style={{ color: 'var(--subtle)' }}>
              Connect the owner wallet to link the agent ID into the card.
            </p>
          )}
        </div>
      )}
    </section>
  )
}

function Stat({ label, value, big, href }: { label: string; value: string; big?: boolean; href?: string }) {
  const body = (
    <span className={big ? 'display text-3xl font-semibold tabular-nums' : 'mono text-[13px]'}>{value}</span>
  )
  return (
    <div className="well p-4">
      <p className="eyebrow">{label}</p>
      <div className="mt-1.5">
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">
            {body}
          </a>
        ) : (
          body
        )}
      </div>
    </div>
  )
}
