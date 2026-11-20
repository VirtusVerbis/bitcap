export const FREE_BLOCK_LABEL = "Block #N";

export function isPaidTier(env: { CF_TIER?: string }): boolean {
  return env.CF_TIER === "paid";
}