# Maxi

> Built with Arc Studio - money-powered apps in minutes

This is the **project memory** - what Arc Studio remembers about building this app. It helps future agents (or humans) understand and extend the project.

---

## What This App Does

Maxi is an onchain agent on Arc Testnet.
- Identity: ERC-8004. The connected wallet registers Maxi in the IdentityRegistry (`0x8004A818BFB912233c491871b3d84c89A494BD9e`); the registration card is a base64 data URI stored onchain. Agent ID is kept in browser localStorage (`maxi:agentId`) and can be reloaded by ID.
- Payments: x402 via Circle Gateway nanopayments. `server/index.ts` (Express, port 3001) gates `GET /brief` at $0.01 USDC. Vite proxies `/api/*` to it.
- Wallet: `VITE_MAXI_ADDRESS` / `MAXI_PRIVATE_KEY` in `.env` (generated, testnet only). Never commit `.env`.
- Run: `bun run dev:all` (or `bun run server` + `bun run dev`).
- Reputation: ReputationRegistry (`0x8004B663056A597Dffe9eCcC1965A193B7388713`). Owners cannot rate their own agent.

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry. Sources in `contracts/`, unit tests in `contracts/test/*.t.sol`. Build with `bun run contracts:build` (`forge build`), test with `bun run contracts:test` (`forge test`).
- Wallet: injected (MetaMask, etc.)
- Chain: Arc Testnet (Chain ID: 5042002, imported from `viem/chains`)
- Token: USDC (6 decimals) (Address: 0x3600000000000000000000000000000000000000, Chain: Arc Testnet)
- Toasts: Sonner

## Key Files

- `src/App.tsx` - Main application logic
- `src/components/` - UI components (IdentityPanel, ServicePanel, ReputationPanel, ReceiptsPanel)
- `server/index.ts` - Maxi backend (x402 paywall, agent card, receipts)
- `src/lib/maxi.ts` - shared constants, ABIs, agent card builder
- `src/config.ts` - wagmi config (chains, connectors, transports)

## Share links

- Starter apps already ship `getShareBase`, `buildShareLink` and `installShareSync` in `src/lib/share.ts`; import them instead of rewriting them.
- Keep shareable state in the URL path or query, not in the `#fragment`.
- Never put a secret (private key, claim secret, seed phrase, session token, API key) in the URL path or query, encoded or not: every in-app path and query is mirrored to the visitor's studio.arc.io address bar and browser history and reaches servers. A bearer claim secret goes only in the `#fragment` appended to the share link (`` `${await buildShareLink('/claim')}#${secret}` ``) and is read from `location.hash` on load. A link to the app's own share URL shown inside the app must be copy-only or open in a new tab with `target="_blank" rel="noopener noreferrer"`.
- Build every link a user copies or sends with `buildShareLink()` from `src/lib/share.ts`.
- Keep the `installShareSync()` call in `src/main.tsx` when editing it; it keeps the Studio address bar in step with in-app navigation.
- Navigate inside the app with relative links.

## To Run

```bash
bun install
bun run dev
```
