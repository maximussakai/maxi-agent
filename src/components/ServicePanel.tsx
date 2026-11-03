import { useState } from 'react'
import { useAccount, usePublicClient, useReadContract, useWalletClient, useWriteContract } from 'wagmi'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { erc20Abi } from 'viem'
import { Loader2, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { WalletGate } from './WalletGate'
import { useChallenge } from '@/hooks/useMaxiInfo'
import { getProtocolContractByName, getUsdc } from '@/onchain-facts'
import { formatUsdc, parseUsdc } from '@/onchain-money'
import { ARC_TESTNET_ID, type MaxiBrief, type MaxiInfo } from '@/lib/maxi'
import { payForBrief } from '@/lib/x402'
import { isUserRejection, parseOnchainError, shortAddress } from '@/lib/format'

const gatewayWallet = getProtocolContractByName('GatewayWallet', 'testnet')
const usdc = getUsdc(ARC_TESTNET_ID)

const gatewayWalletAbi = [
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [],
  },
] as const

type Step = 'idle' | 'approving' | 'depositing' | 'signing' | 'settling'

export function ServicePanel({ info }: { info: MaxiInfo | undefined }) {
  const { address } = useAccount()
  const queryClient = useQueryClient()
  const publicClient = usePublicClient({ chainId: ARC_TESTNET_ID })
  const { data: walletClient } = useWalletClient({ chainId: ARC_TESTNET_ID })
  const { writeContractAsync } = useWriteContract()
  const challenge = useChallenge()

  const [step, setStep] = useState<Step>('idle')
  const [depositAmount, setDepositAmount] = useState('1')
  const [brief, setBrief] = useState<MaxiBrief | null>(null)

  const gatewayBalance = useQuery({
    queryKey: ['gateway-balance', address],
    enabled: !!address,
    queryFn: async () => {
      const res = await fetch(`/api/gateway-balance?address=${address}`)
      const data = (await res.json()) as { available?: string; error?: string }
      if (!res.ok || data.available === undefined) throw new Error(data.error ?? 'Balance lookup failed')
      return parseUsdc(data.available)
    },
    refetchInterval: 15000,
  })

  const { data: walletUsdc, refetch: refetchWalletUsdc } = useReadContract({
    address: usdc?.address as `0x${string}` | undefined,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: ARC_TESTNET_ID,
    query: { enabled: !!address && !!usdc },
  })

  const price = info ? parseUsdc(info.priceUsd) : undefined
  const available = gatewayBalance.data
  const canPay = price !== undefined && available !== undefined && available >= price
  const busy = step !== 'idle'

  async function deposit() {
    if (!publicClient || !address || !usdc || !gatewayWallet) return
    try {
      const amount = parseUsdc(depositAmount)
      if (amount <= 0n) return
      const gw = gatewayWallet.address as `0x${string}`
      const token = usdc.address as `0x${string}`
      const allowance = await publicClient.readContract({
        address: token,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [address, gw],
      })
      if (allowance < amount) {
        setStep('approving')
        const approveHash = await writeContractAsync({
          address: token,
          abi: erc20Abi,
          functionName: 'approve',
          args: [gw, amount],
          chainId: ARC_TESTNET_ID,
        })
        await publicClient.waitForTransactionReceipt({ hash: approveHash })
      }
      setStep('depositing')
      const depositHash = await writeContractAsync({
        address: gw,
        abi: gatewayWalletAbi,
        functionName: 'deposit',
        args: [token, amount],
        gas: 120000n,
        chainId: ARC_TESTNET_ID,
      })
      await publicClient.waitForTransactionReceipt({ hash: depositHash })
      toast.success('USDC added to your Gateway balance')
      await Promise.all([gatewayBalance.refetch(), refetchWalletUsdc()])
    } catch (err) {
      if (!isUserRejection(err)) toast.error(parseOnchainError(err))
    } finally {
      setStep('idle')
    }
  }

  async function ask() {
    if (!walletClient) return
    try {
      setStep('signing')
      const result = await payForBrief(walletClient)
      setStep('settling')
      setBrief(result)
      void queryClient.invalidateQueries({ queryKey: ['maxi-receipts'] })
      void gatewayBalance.refetch()
    } catch (err) {
      if (isUserRejection(err)) return
      toast.error(err instanceof Error && err.message ? err.message : parseOnchainError(err))
    } finally {
      setStep('idle')
    }
  }

  return (
    <section className="card p-6 sm:p-8">
      <p className="eyebrow">x402 paid skill</p>
      <h2 className="display mt-1 text-2xl font-semibold text-balance">Ask Maxi for a market brief</h2>
      <p className="mt-2 max-w-prose text-pretty text-sm" style={{ color: 'var(--muted)' }}>
        Maxi answers with live Arc data, but only after a gasless USDC payment settled through Circle Gateway.
      </p>

      <div className="well mt-5 p-4">
        <p className="eyebrow">Live 402 challenge from /api/brief</p>
        {challenge.isLoading && <p className="mt-2 text-sm">Asking Maxi...</p>}
        {challenge.isError && (
          <p className="mt-2 text-sm" style={{ color: 'var(--danger)' }}>
            Maxi's backend is not reachable. Start it with <span className="mono">bun run server</span>.
          </p>
        )}
        {challenge.data && (
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt style={{ color: 'var(--subtle)' }}>Status</dt>
            <dd className="mono tabular-nums">402 Payment Required</dd>
            <dt style={{ color: 'var(--subtle)' }}>Price</dt>
            <dd className="mono tabular-nums">{formatUsdc(BigInt(challenge.data.amount))} USDC</dd>
            <dt style={{ color: 'var(--subtle)' }}>Network</dt>
            <dd className="mono">{challenge.data.network}</dd>
            <dt style={{ color: 'var(--subtle)' }}>Pays to</dt>
            <dd className="mono">{shortAddress(challenge.data.payTo)}</dd>
          </dl>
        )}
      </div>

      <div className="mt-5 space-y-4">
        <WalletGate>
          <div className="grid grid-cols-2 gap-3">
            <div className="well p-4">
              <p className="eyebrow">Wallet USDC</p>
              <p className="display mt-1 text-2xl font-semibold tabular-nums">
                {walletUsdc === undefined ? '...' : formatUsdc(walletUsdc)}
              </p>
            </div>
            <div className="well p-4">
              <p className="eyebrow">Gateway balance</p>
              <p className="display mt-1 text-2xl font-semibold tabular-nums">
                {available === undefined ? '...' : formatUsdc(available)}
              </p>
            </div>
          </div>

          {!canPay && available !== undefined && (
            <div className="flex items-center gap-2">
              <input
                className="field mono tabular-nums"
                inputMode="decimal"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                aria-label="Amount of USDC to add to Gateway"
              />
              <button
                className="btn btn-ghost shrink-0"
                disabled={busy || !depositAmount || !gatewayWallet}
                onClick={() => void deposit()}
              >
                {step === 'approving' && 'Allow USDC...'}
                {step === 'depositing' && 'Adding...'}
                {(step === 'idle' || step === 'signing' || step === 'settling') && 'Add to Gateway'}
              </button>
            </div>
          )}

          <button className="btn btn-primary w-full" disabled={busy || !canPay} onClick={() => void ask()}>
            {step === 'signing' || step === 'settling' ? (
              <>
                <Loader2 className="animate-spin" size={16} /> {step === 'signing' ? 'Sign in wallet...' : 'Settling...'}
              </>
            ) : (
              <>
                <Zap size={16} /> Pay {info?.priceUsd ?? '0.01'} USDC and ask Maxi
              </>
            )}
          </button>
          {!canPay && available !== undefined && (
            <p className="text-xs" style={{ color: 'var(--subtle)' }}>
              Payments draw on your Gateway balance, so they cost no gas. Add a little USDC first.
            </p>
          )}
        </WalletGate>

        {brief && <BriefCard brief={brief} />}
      </div>
    </section>
  )
}

function BriefCard({ brief }: { brief: MaxiBrief }) {
  const rows: [string, string][] = [
    ['Block', `#${brief.blockNumber}`],
    ['Transactions', String(brief.txCount)],
    ['Gas price (gwei)', brief.gasPriceGwei],
    ['USDC supply', Number(brief.usdcSupply).toLocaleString('en-US', { maximumFractionDigits: 2 })],
  ]
  return (
    <div className="well p-5" style={{ borderColor: 'var(--border-strong)' }}>
      <p className="eyebrow">Maxi says</p>
      <p className="display mt-2 text-lg text-pretty">{brief.take}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="eyebrow">{k}</dt>
            <dd className="mono mt-0.5 tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs" style={{ color: 'var(--subtle)' }}>
        Sealed {brief.blockTimestamp} on {brief.network}
      </p>
    </div>
  )
}
