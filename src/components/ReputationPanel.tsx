import { useState } from 'react'
import { useAccount, usePublicClient, useReadContract, useWriteContract } from 'wagmi'
import { zeroHash } from 'viem'
import { Loader2, Star } from 'lucide-react'
import { toast } from 'sonner'
import { WalletGate } from './WalletGate'
import {
  ARC_TESTNET_ID,
  IDENTITY_REGISTRY,
  REPUTATION_REGISTRY,
  identityAbi,
  reputationAbi,
} from '@/lib/maxi'
import { isUserRejection, parseOnchainError } from '@/lib/format'

export function ReputationPanel({ agentId }: { agentId: bigint | undefined }) {
  const { address } = useAccount()
  const publicClient = usePublicClient({ chainId: ARC_TESTNET_ID })
  const { writeContractAsync } = useWriteContract()
  const [rating, setRating] = useState(90)
  const [sending, setSending] = useState(false)

  const enabled = agentId !== undefined
  const { data: clients, refetch: refetchClients } = useReadContract({
    address: REPUTATION_REGISTRY,
    abi: reputationAbi,
    functionName: 'getClients',
    args: enabled ? [agentId] : undefined,
    chainId: ARC_TESTNET_ID,
    query: { enabled },
  })
  const hasClients = !!clients && clients.length > 0
  const { data: summary, refetch: refetchSummary } = useReadContract({
    address: REPUTATION_REGISTRY,
    abi: reputationAbi,
    functionName: 'getSummary',
    args: enabled && clients ? [agentId, [...clients], '', ''] : undefined,
    chainId: ARC_TESTNET_ID,
    query: { enabled: enabled && hasClients },
  })
  const { data: owner } = useReadContract({
    address: IDENTITY_REGISTRY,
    abi: identityAbi,
    functionName: 'ownerOf',
    args: enabled ? [agentId] : undefined,
    chainId: ARC_TESTNET_ID,
    query: { enabled },
  })
  const isOwner = !!address && !!owner && owner.toLowerCase() === address.toLowerCase()

  async function submit() {
    if (!enabled || !publicClient) return
    try {
      setSending(true)
      const hash = await writeContractAsync({
        address: REPUTATION_REGISTRY,
        abi: reputationAbi,
        functionName: 'giveFeedback',
        args: [agentId, BigInt(rating), 0, 'x402-brief', '', '', '', zeroHash],
        chainId: ARC_TESTNET_ID,
      })
      await publicClient.waitForTransactionReceipt({ hash })
      toast.success('Feedback recorded onchain')
      await refetchClients()
      await refetchSummary()
    } catch (err) {
      if (!isUserRejection(err)) toast.error(parseOnchainError(err))
    } finally {
      setSending(false)
    }
  }

  let score = '--'
  if (summary) {
    const [, value, decimals] = summary
    score = (Number(value) / 10 ** decimals).toFixed(decimals > 0 ? 1 : 0)
  }

  return (
    <section className="card p-6">
      <p className="eyebrow">ERC-8004 reputation</p>
      <h2 className="display mt-1 text-xl font-semibold">What clients say about Maxi</h2>

      {!enabled ? (
        <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>
          Register Maxi to start collecting onchain feedback.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="well p-4">
              <p className="eyebrow">Average score</p>
              <p className="display mt-1 text-3xl font-semibold tabular-nums">{hasClients ? score : '--'}</p>
            </div>
            <div className="well p-4">
              <p className="eyebrow">Reviewers</p>
              <p className="display mt-1 text-3xl font-semibold tabular-nums">{clients ? clients.length : '--'}</p>
            </div>
          </div>
          {clients && !hasClients && (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              No feedback yet. The first review sets Maxi's reputation.
            </p>
          )}

          <WalletGate>
            {isOwner ? (
              <p className="text-sm" style={{ color: 'var(--subtle)' }}>
                You own Maxi, and the registry blocks owners from rating their own agent. Connect a second wallet to
                leave feedback.
              </p>
            ) : (
              <div className="space-y-3">
                <label className="block">
                  <span className="eyebrow">Your rating</span>
                  <div className="mt-2 flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={rating}
                      onChange={(e) => setRating(Number(e.target.value))}
                      className="w-full accent-[#acc6e9]"
                      aria-label="Rating from 0 to 100"
                    />
                    <span className="display w-10 text-right text-lg font-semibold tabular-nums">{rating}</span>
                  </div>
                </label>
                <button className="btn btn-ghost w-full" disabled={sending} onClick={() => void submit()}>
                  {sending ? (
                    <>
                      <Loader2 className="animate-spin" size={16} /> Recording...
                    </>
                  ) : (
                    <>
                      <Star size={16} /> Leave feedback
                    </>
                  )}
                </button>
              </div>
            )}
          </WalletGate>
        </div>
      )}
    </section>
  )
}
