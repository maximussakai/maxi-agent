# Maxi

Maxi is an onchain agent on Arc Testnet. You register it as an ERC-8004 agent, and anyone can pay it in USDC over x402 to get a live market brief (latest block, gas price, USDC supply). Payments are gasless for buyers and settle through Circle Gateway. Clients can leave onchain feedback that builds Maxi's reputation.

Built with [Arc Studio](https://studio.arc.io)

## Features

- Register Maxi as an agent in Arc's ERC-8004 identity registry. The registration card is stored fully onchain.
- Paid skill: Maxi returns a market brief only after a $0.01 USDC x402 payment.
- Add USDC to your Gateway balance from the app, then pay without gas.
- Leave feedback for Maxi from a second wallet and see its average score.
- Live list of payments Maxi has settled.

## Try it

1. Connect a wallet and switch to Arc Testnet.
2. Get test USDC from the [Circle faucet](https://faucet.circle.com).
3. Click **Register Maxi** and confirm the transaction. Maxi gets an agent ID.
4. Add a little USDC to your Gateway balance, then click **Pay 0.01 USDC and ask Maxi**.
5. Connect a second wallet to leave feedback. The agent's owner can't rate it.

## Network

Arc Testnet (chain ID 5042002). Gas and payments are both USDC.

| Contract | Address |
| --- | --- |
| ERC-8004 identity registry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| ERC-8004 reputation registry | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |
| USDC | `0x3600000000000000000000000000000000000000` |

Testnet only. Do not use these settings with real funds.

## Deployment

The app has two parts: the web frontend and a small backend that serves the paid brief. A static host such as Netlify serves only the frontend, so registering Maxi and reputation work, but the paid brief, Gateway balance and earnings list need the backend running somewhere (for example a Docker host).

## Tech stack

- React 18, Vite, TypeScript, Tailwind CSS
- wagmi, viem, ConnectKit
- Express backend with Circle Gateway x402 middleware (`@circle-fin/x402-batching`)
- Arc Testnet, USDC

## Development

Prerequisites: [Bun](https://bun.sh).

```bash
bun install
```

Environment variables (set in `.env`, never commit it):

- `VITE_MAXI_ADDRESS`: the public address that receives Maxi's payments.
- `VITE_MAXI_AGENT_ID`: optional. Maxi's ERC-8004 agent ID, included in the served registration card.
- `MAXI_PUBLIC_URL`: optional. Public base URL of your deployed app, used in the served registration card.
- `MAXI_PORT`: optional. Backend port, default 3001.
- `RPC_PROXY_BASE_URL`, `RPC_PROXY_TOKEN`, `RPC_PROXY_CHAINS`: optional outside Arc Studio. Used by the backend for RPC access when present.

Maxi's earnings accrue to the wallet at `VITE_MAXI_ADDRESS`. Keep the private key for that address somewhere safe (the command below prints it, and `.env` is gitignored); you need it to withdraw earnings from Gateway.

Generate a fresh Maxi wallet:

```bash
bun -e "import {generatePrivateKey, privateKeyToAccount} from 'viem/accounts'; const k = generatePrivateKey(); console.log('MAXI_PRIVATE_KEY=' + k); console.log('VITE_MAXI_ADDRESS=' + privateKeyToAccount(k).address)"
```

Run the backend and the app together (the app proxies `/api` to the backend):

```bash
bun run dev:all
```

Or in two terminals: `bun run server` and `bun run dev`.

Other scripts:

```bash
bun run check   # lint + typecheck
```

Get test USDC for your wallet from the [Circle faucet](https://faucet.circle.com).
