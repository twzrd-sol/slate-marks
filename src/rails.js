export function solanaPubkeyField(pubkey) {
  if (typeof pubkey !== "string" || pubkey.length < 32) throw new Error("solanaPubkey required");
  return { solanaPubkey: pubkey, transfer: null, mint: null };
}
export function usdcNotional(impliedPrice) {
  const price = Number(impliedPrice);
  if (!Number.isFinite(price) || price < 0 || price > 1) throw new Error("impliedPrice must be between 0 and 1");
  return { asset: "USDC", notional: price.toString(), transfer: null };
}
export function slatePassChallenge() {
  return { scheme: "x402", network: "base", asset: "USDC", amount: "0", resource: "slate-pass", payTo: null, status: "uninvoked", failClosed: true, signerInvocations: 0 };
}
