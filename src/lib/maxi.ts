/**
 * Shared Maxi constants. Pure TypeScript: imported by both the browser app and
 * the Express server, so nothing here may touch `window` or `import.meta`.
 */

export const ARC_TESTNET_ID = 5042002 as const
export const ARC_CAIP2 = `eip155:${ARC_TESTNET_ID}` as const

/** ERC-8004 registries on Arc Testnet (see Arc docs: "Register your first AI agent"). */
export const IDENTITY_REGISTRY = '0x8004A818BFB912233c491871b3d84c89A494BD9e' as const
export const REPUTATION_REGISTRY = '0x8004B663056A597Dffe9eCcC1965A193B7388713' as const

/** Price of one Maxi market brief, in USD (USDC). */
export const BRIEF_PRICE_USD = '0.01'

export const identityAbi = [
  {
    type: 'function',
    name: 'register',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'agentURI', type: 'string' }],
    outputs: [{ name: 'agentId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'setAgentURI',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'newURI', type: 'string' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'tokenURI',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    type: 'function',
    name: 'ownerOf',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'getAgentWallet',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'event',
    name: 'Registered',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'agentURI', type: 'string', indexed: false },
      { name: 'owner', type: 'address', indexed: true },
    ],
  },
] as const

export const reputationAbi = [
  {
    type: 'function',
    name: 'giveFeedback',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'value', type: 'int128' },
      { name: 'valueDecimals', type: 'uint8' },
      { name: 'tag1', type: 'string' },
      { name: 'tag2', type: 'string' },
      { name: 'endpoint', type: 'string' },
      { name: 'feedbackURI', type: 'string' },
      { name: 'feedbackHash', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getClients',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address[]' }],
  },
  {
    type: 'function',
    name: 'getSummary',
    stateMutability: 'view',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'clientAddresses', type: 'address[]' },
      { name: 'tag1', type: 'string' },
      { name: 'tag2', type: 'string' },
    ],
    outputs: [
      { name: 'count', type: 'uint64' },
      { name: 'summaryValue', type: 'int128' },
      { name: 'summaryValueDecimals', type: 'uint8' },
    ],
  },
] as const

export interface AgentCard {
  type: string
  name: string
  description: string
  services: { name: string; endpoint: string; version?: string }[]
  x402Support: boolean
  active: boolean
  payTo: string
  registrations: { agentId: number; agentRegistry: string }[]
  supportedTrust: string[]
}

export interface BuildCardInput {
  serviceUrl: string
  payTo: string
  agentId?: number
}

/** The ERC-8004 registration file for Maxi. */
export function buildAgentCard({ serviceUrl, payTo, agentId }: BuildCardInput): AgentCard {
  return {
    type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
    name: 'Maxi',
    description:
      'Maxi is a USDC-maximalist onchain analyst on Arc. Pay $' +
      BRIEF_PRICE_USD +
      ' in USDC over x402 and get a live market brief: latest block, gas, and USDC supply.',
    services: [{ name: 'x402', endpoint: serviceUrl, version: '2' }],
    x402Support: true,
    active: true,
    payTo,
    registrations:
      agentId === undefined
        ? []
        : [{ agentId, agentRegistry: `${ARC_CAIP2}:${IDENTITY_REGISTRY}` }],
    supportedTrust: ['reputation'],
  }
}

/** Encode a card as a self-contained data URI, so the identity needs no hosting. */
export function cardToDataUri(card: AgentCard): string {
  const bytes = new TextEncoder().encode(JSON.stringify(card))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return `data:application/json;base64,${btoa(bin)}`
}

/** Decode a data URI card. Returns undefined for anything else (https, ipfs, garbage). */
export function dataUriToCard(uri: string): AgentCard | undefined {
  const prefix = 'data:application/json;base64,'
  if (!uri.startsWith(prefix)) return undefined
  try {
    const bin = atob(uri.slice(prefix.length))
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes)) as AgentCard
  } catch {
    return undefined
  }
}

export interface MaxiInfo {
  name: string
  sellerAddress: string
  priceUsd: string
  network: string
  briefPath: string
}

export interface MaxiBrief {
  agent: string
  network: string
  blockNumber: string
  blockTimestamp: string
  txCount: number
  gasPriceGwei: string
  usdcSupply: string
  take: string
  paidBy: string
}

export interface MaxiReceipt {
  payer: string
  amountUsdc: string
  network: string
  at: number
  transaction?: string
}
