import { ExternalLink } from 'lucide-react'
import { useReceipts } from '@/hooks/useMaxiInfo'
import { buildAddressExplorerUrl } from '@/onchain-facts'
import { ARC_TESTNET_ID } from '@/lib/maxi'
import { shortAddress } from '@/lib/format'

export function ReceiptsPanel({ sellerAddress }: { sellerAddress: string | undefined }) {
  const { data, isError } = useReceipts()
  const total = (data ?? []).reduce((sum, r) => sum + Number(r.amountUsdc), 0)

  return (
    <section className="card p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Earnings</p>
          <h2 className="display mt-1 text-xl font-semibold">Payments Maxi has settled</h2>
        </div>
        <p className="display text-2xl font-semibold tabular-nums">{total.toFixed(2)}</p>
      </div>

      {isError && (
        <p className="mt-3 text-sm" style={{ color: 'var(--danger)' }}>
          Can't reach Maxi's backend.
        </p>
      )}
      {data && data.length === 0 && (
        <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>
          No paid requests yet. Ask Maxi for a brief and the receipt lands here.
        </p>
      )}
      {data && data.length > 0 && (
        <ul className="mt-4 divide-y" style={{ borderColor: 'var(--border)' }}>
          {data.map((r) => (
            <li
              key={`${r.at}-${r.payer}`}
              className="flex items-center justify-between py-2.5 text-sm"
              style={{ borderColor: 'var(--border)' }}
            >
              <a
                className="mono hover:underline"
                href={buildAddressExplorerUrl(ARC_TESTNET_ID, r.payer)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {shortAddress(r.payer)}
              </a>
              <span className="mono tabular-nums">+{r.amountUsdc} USDC</span>
              <span className="tabular-nums" style={{ color: 'var(--subtle)' }}>
                {new Date(r.at).toLocaleTimeString()}
              </span>
            </li>
          ))}
        </ul>
      )}

      {sellerAddress && (
        <a
          className="mt-4 inline-flex items-center gap-1.5 text-xs underline-offset-4 hover:underline"
          style={{ color: 'var(--subtle)' }}
          href={buildAddressExplorerUrl(ARC_TESTNET_ID, sellerAddress)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Maxi's wallet {shortAddress(sellerAddress)} <ExternalLink size={12} />
        </a>
      )}
    </section>
  )
}
