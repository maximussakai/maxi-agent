export const shortAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

export function parseOnchainError(error: unknown): string {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase()
  if (message.includes('user rejected') || message.includes('user denied')) return 'Cancelled in wallet.'
  if (message.includes('insufficient funds') || message.includes('exceeds balance')) {
    return 'Not enough USDC. Use "Get test USDC" in the sidebar, then try again.'
  }
  if (message.includes('reverted')) return 'The transaction reverted. Check the details and try again.'
  if (message.includes('network') || message.includes('timeout') || message.includes('fetch')) {
    return 'Network issue. Check your connection and retry.'
  }
  return 'Something went wrong. Please try again.'
}

export function isUserRejection(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase()
  return message.includes('user rejected') || message.includes('user denied')
}
