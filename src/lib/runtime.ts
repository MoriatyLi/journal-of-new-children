type RuntimeEnv = Record<string, string | undefined>;

export type RuntimeConfig = {
  mode: "mock" | "live";
  chainId: number;
  chainName: string;
  explorerBaseUrl: string;
  publicRpcUrl: string | null;
  startBlock: number | null;
  addresses: {
    journal: string | null;
    submission: string | null;
    review: string | null;
    reputation: string | null;
  };
  missing: string[];
  isReadyForWrites: boolean;
  isReadyForReads: boolean;
};

function isAddress(value: string | undefined): value is string {
  return Boolean(value && /^0x[a-fA-F0-9]{40}$/.test(value));
}

function normalizePositiveNumber(value: string | undefined): number | null {
  if (!value) return null;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

export function resolveRuntimeConfig(env: RuntimeEnv): RuntimeConfig {
  const chainId = Number(env.VITE_CHAIN_ID ?? "84532");
  const chainName = env.VITE_CHAIN_NAME ?? "Base Sepolia";
  const explorerBaseUrl = env.VITE_EXPLORER_BASE_URL ?? "https://sepolia.basescan.org";
  const publicRpcUrl = env.VITE_PUBLIC_RPC_URL?.trim() || null;
  const startBlock = normalizePositiveNumber(env.VITE_PROTOCOL_START_BLOCK);

  const addresses = {
    journal: isAddress(env.VITE_JOURNAL_ADDRESS) ? env.VITE_JOURNAL_ADDRESS : null,
    submission: isAddress(env.VITE_SUBMISSION_ADDRESS) ? env.VITE_SUBMISSION_ADDRESS : null,
    review: isAddress(env.VITE_REVIEW_ADDRESS) ? env.VITE_REVIEW_ADDRESS : null,
    reputation: isAddress(env.VITE_REPUTATION_ADDRESS) ? env.VITE_REPUTATION_ADDRESS : null,
  };

  const missing = Object.entries(addresses)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  return {
    mode: missing.length === 0 ? "live" : "mock",
    chainId,
    chainName,
    explorerBaseUrl,
    publicRpcUrl,
    startBlock,
    addresses,
    missing,
    isReadyForWrites: missing.length === 0,
    isReadyForReads: missing.length === 0 && Boolean(publicRpcUrl),
  };
}

export const runtimeConfig = resolveRuntimeConfig(import.meta.env as RuntimeEnv);
