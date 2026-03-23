import { resolveRuntimeConfig, type RuntimeConfig } from "@/lib/runtime";

export type DeploymentSnapshot = {
  network: string;
  chainId: number;
  deployer: string;
  deployedAt: string;
  startBlock?: number | null;
  addresses: {
    journal: string;
    submission: string;
    review: string;
    reputation: string;
  };
};

type RuntimeEnvShape = {
  VITE_CHAIN_ID: string;
  VITE_CHAIN_NAME: string;
  VITE_EXPLORER_BASE_URL: string;
  VITE_PUBLIC_RPC_URL?: string;
  VITE_PROTOCOL_START_BLOCK?: string;
  VITE_JOURNAL_ADDRESS?: string;
  VITE_SUBMISSION_ADDRESS?: string;
  VITE_REVIEW_ADDRESS?: string;
  VITE_REPUTATION_ADDRESS?: string;
};

export function getDefaultDeploymentNetwork(chainId: number): string {
  if (chainId === 84532) return "base-sepolia";
  if (chainId === 8453) return "base-mainnet";
  return `chain-${chainId}`;
}

export function getDeploymentArtifactPaths(network: string): string[] {
  return [`deployments/${network}.json`, `public/deployments/${network}.json`];
}

export function applyDeploymentToRuntimeConfig(
  baseConfig: RuntimeConfig,
  deployment: DeploymentSnapshot,
): RuntimeConfig {
  if (deployment.chainId !== baseConfig.chainId) {
    return baseConfig;
  }

  const envShape: RuntimeEnvShape = {
    VITE_CHAIN_ID: String(baseConfig.chainId),
    VITE_CHAIN_NAME: baseConfig.chainName,
    VITE_EXPLORER_BASE_URL: baseConfig.explorerBaseUrl,
    VITE_PUBLIC_RPC_URL: baseConfig.publicRpcUrl ?? undefined,
    VITE_PROTOCOL_START_BLOCK: String(baseConfig.startBlock ?? deployment.startBlock ?? ""),
    VITE_JOURNAL_ADDRESS: baseConfig.addresses.journal ?? deployment.addresses.journal,
    VITE_SUBMISSION_ADDRESS: baseConfig.addresses.submission ?? deployment.addresses.submission,
    VITE_REVIEW_ADDRESS: baseConfig.addresses.review ?? deployment.addresses.review,
    VITE_REPUTATION_ADDRESS: baseConfig.addresses.reputation ?? deployment.addresses.reputation,
  };

  return resolveRuntimeConfig(envShape);
}

export async function loadDeploymentSnapshot(
  chainId: number,
  fetcher: typeof fetch = fetch,
): Promise<DeploymentSnapshot | null> {
  const network = getDefaultDeploymentNetwork(chainId);
  const response = await fetcher(`/deployments/${network}.json`, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as DeploymentSnapshot;
}
