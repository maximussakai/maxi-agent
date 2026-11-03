import { x402Client, x402HTTPClient } from '@x402/core/client'
import { registerBatchScheme } from '@circle-fin/x402-batching/client'
import type { Account, Chain, Transport, WalletClient } from 'viem'
import type { MaxiBrief } from './maxi'

export class PaymentError extends Error {}

/**
 * Pay for one Maxi brief over x402 using the connected wallet.
 * 1. Ask for the brief unpaid and receive a 402 with the payment requirements.
 * 2. Sign a gasless Gateway authorization (EIP-3009 typed data) in the wallet.
 * 3. Retry with the signature; Maxi's backend settles it through Circle Gateway.
 */
export async function payForBrief(
  walletClient: WalletClient<Transport, Chain, Account>,
  url = '/api/brief',
): Promise<MaxiBrief> {
  const client = new x402Client()
  registerBatchScheme(client, {
    signer: {
      address: walletClient.account.address,
      signTypedData: (params) =>
        walletClient.signTypedData({
          account: walletClient.account,
          domain: params.domain,
          types: params.types,
          primaryType: params.primaryType,
          message: params.message,
        }),
    },
  })
  const http = new x402HTTPClient(client)

  const first = await fetch(url)
  if (first.status === 200) return (await first.json()) as MaxiBrief
  if (first.status !== 402) throw new PaymentError(`Maxi answered ${first.status}`)

  const body: unknown = await first.json().catch(() => undefined)
  const required = http.getPaymentRequiredResponse((name) => first.headers.get(name), body)
  const payload = await http.createPaymentPayload(required)
  const headers = http.encodePaymentSignatureHeader(payload)

  const paid = await fetch(url, { headers })
  if (!paid.ok) {
    const detail = (await paid.json().catch(() => ({}))) as { error?: string }
    throw new PaymentError(detail.error ?? `Payment was not accepted (${paid.status}). Does your Gateway balance cover $0.01?`)
  }
  return (await paid.json()) as MaxiBrief
}
