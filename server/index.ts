/**
 * Maxi's backend: an Express service that sells one paid skill over x402
 * (Circle Gateway nanopayments) and serves Maxi's ERC-8004 registration file.
 *
 * Run with: bun run server
 * The Vite dev server proxies /api/* to this port, stripping the /api prefix.
 */
import express from 'express'
import { createGatewayMiddleware } from '@circle-fin/x402-batching/server'
import { createPublicClient, erc20Abi, formatUnits, http, isAddress } from 'viem'
import { arcTestnet } from 'viem/chains'
import { getChain, getUsdc } from '../src/onchain-facts'
import {
  ARC_CAIP2,
  ARC_TESTNET_ID,
  BRIEF_PRICE_USD,
  buildAgentCard,
  type MaxiBrief,
  type MaxiInfo,
  type MaxiReceipt,
} from '../src/lib/maxi'

const PORT = Number(process.env.MAXI_PORT ?? 3001)
const GATEWAY_FACILITATOR = 'https://gateway-api-testnet.circle.com'

const sellerAddress = process.env.VITE_MAXI_ADDRESS
if (!sellerAddress || !isAddress(sellerAddress)) {
  throw new Error('VITE_MAXI_ADDRESS is missing or invalid in .env. Maxi needs a wallet address to get paid.')
}

const chain = getChain(ARC_TESTNET_ID)
const usdc = getUsdc(ARC_TESTNET_ID)
if (!chain || !usdc) throw new Error('Arc Testnet is missing from onchain-facts.')

// Prefer the provisioned RPC proxy; fall back to the public RPC from onchain-facts.
const proxyChains = (process.env.RPC_PROXY_CHAINS || '').split(',')
const rpcUrl =
  process.env.RPC_PROXY_BASE_URL && proxyChains.indexOf('Arc_Testnet') !== -1
    ? `${process.env.RPC_PROXY_BASE_URL}/api/rpc/Arc_Testnet?_rpc_token=${process.env.RPC_PROXY_TOKEN}`
    : chain.rpcUrls[0]

const client = createPublicClient({ chain: arcTestnet, transport: http(rpcUrl) })

const gateway = createGatewayMiddleware({
  sellerAddress,
  networks: [ARC_CAIP2],
  facilitatorUrl: GATEWAY_FACILITATOR,
  description: 'Maxi market brief: live Arc block, gas, and USDC supply',
})

type PaidRequest = express.Request & {
  payment?: { verified: boolean; payer: string; amount: string; network: string; transaction?: string }
}

const receipts: MaxiReceipt[] = []

const app = express()
app.disable('x-powered-by')

app.get('/health', (_req, res) => {
  res.json({ ok: true, agent: 'maxi' })
})

app.get('/info', (_req, res) => {
  const info: MaxiInfo = {
    name: 'Maxi',
    sellerAddress,
    priceUsd: BRIEF_PRICE_USD,
    network: ARC_CAIP2,
    briefPath: '/brief',
  }
  res.json(info)
})

// Maxi's ERC-8004 registration file, for clients that prefer https over the onchain data URI.
app.get('/agent-card.json', (req, res) => {
  const forwardedProto = req.get('x-forwarded-proto') ?? req.protocol
  const origin = process.env.MAXI_PUBLIC_URL?.replace(/\/+$/, '') ?? `${forwardedProto}://${req.get('host')}`
  const agentId = process.env.VITE_MAXI_AGENT_ID ? Number(process.env.VITE_MAXI_AGENT_ID) : undefined
  const prefix = process.env.MAXI_PUBLIC_URL ? '/api' : ''
  res.json(buildAgentCard({ serviceUrl: `${origin}${prefix}/brief`, payTo: sellerAddress, agentId }))
})

app.get('/receipts', (_req, res) => {
  res.json(receipts)
})

// A buyer's Gateway balance. Proxied so the browser never calls Circle's API directly.
app.get('/gateway-balance', async (req, res) => {
  const raw = req.query.address
  const address = typeof raw === 'string' ? raw : ''
  if (!isAddress(address)) {
    res.status(400).json({ error: 'address must be a valid EVM address' })
    return
  }
  if (chain.cctpDomain === undefined) {
    res.status(500).json({ error: 'Arc Testnet has no Gateway domain in onchain-facts' })
    return
  }
  try {
    const upstream = await fetch(`${GATEWAY_FACILITATOR}/v1/balances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'USDC', sources: [{ depositor: address, domain: chain.cctpDomain }] }),
    })
    const data = (await upstream.json()) as { balances?: { balance: string }[]; message?: string }
    if (!upstream.ok) {
      res.status(502).json({ error: data.message ?? 'Gateway balance lookup failed' })
      return
    }
    res.json({ available: data.balances?.[0]?.balance ?? '0' })
  } catch {
    res.status(502).json({ error: 'Gateway balance lookup failed' })
  }
})

// The paid skill. Unpaid requests get 402 + PAYMENT-REQUIRED; paid ones are settled by Gateway.
app.get('/brief', gateway.require(`$${BRIEF_PRICE_USD}`), async (req: PaidRequest, res) => {
  try {
    const [block, gasPrice, supply] = await Promise.all([
      client.getBlock(),
      client.getGasPrice(),
      client.readContract({ address: usdc.address as `0x${string}`, abi: erc20Abi, functionName: 'totalSupply' }),
    ])
    const payment = req.payment
    if (payment) {
      receipts.unshift({
        payer: payment.payer,
        amountUsdc: formatUnits(BigInt(payment.amount), usdc.decimals),
        network: payment.network,
        at: Date.now(),
        transaction: payment.transaction,
      })
      receipts.length = Math.min(receipts.length, 25)
    }
    const txCount = block.transactions.length
    const brief: MaxiBrief = {
      agent: 'Maxi',
      network: chain.name,
      blockNumber: block.number.toString(),
      blockTimestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
      txCount,
      gasPriceGwei: formatUnits(gasPrice, 9),
      usdcSupply: formatUnits(supply, usdc.decimals),
      take:
        txCount === 0
          ? 'Quiet block. Gas is USDC, fees stay flat, and nothing is pricing in a panic.'
          : `${txCount} transactions settled in block ${block.number}. Every fee on Arc is paid in USDC, so the dollar is the whole story.`,
      paidBy: payment?.payer ?? 'unknown',
    }
    res.json(brief)
  } catch {
    res.status(502).json({ error: 'Maxi could not read the chain right now' })
  }
})

app.listen(PORT, () => {
  console.log(`Maxi listening on :${PORT}, paid to ${sellerAddress} on ${chain.name}`)
})
