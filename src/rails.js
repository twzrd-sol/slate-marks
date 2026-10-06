/** Rails stubs. No mint, no transfer, no paymaster, no signer. */

export function slatePassChallenge() {
  return {
    scheme: "x402",
    network: "base",
    asset: "USDC",
    amount: "0",
    resource: "slate-pass",
    payTo: null,
    status: "uninvoked",
    failClosed: true,
  };
}

export function solIdentity(solanaPubkey) {
  if (!solanaPubkey || typeof solanaPubkey !== "string") {
    throw new Error("solanaPubkey required");
  }
  return { chain: "solana", solanaPubkey, mint: null, transfer: null };
}

export function usdcNotional(impliedPrice) {
  const price = Number(impliedPrice);
  if (Number.isNaN(price) || price < 0 || price > 1) {
    throw new Error("impliedPrice must be 0-1");
  }
  return {
    asset: "USDC",
    quotedNotional: price,
    transfer: null,
    note: "quote only; Polymarket collateral is pUSD and is not this rail",
  };
}

export function failClosed() {
  return { signer: "uninvoked", reason: "pre-spend check unreachable", failClosed: true };
}
