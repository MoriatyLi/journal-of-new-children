import { describe, expect, test } from "vitest";

import {
  applyDeploymentToRuntimeConfig,
  getDeploymentArtifactPaths,
  getDefaultDeploymentNetwork,
  type DeploymentSnapshot,
} from "@/lib/deployments";
import { resolveRuntimeConfig } from "@/lib/runtime";

describe("deployment helpers", () => {
  test("maps known chain ids to default deployment names", () => {
    expect(getDefaultDeploymentNetwork(84532)).toBe("base-sepolia");
    expect(getDefaultDeploymentNetwork(8453)).toBe("base-mainnet");
    expect(getDefaultDeploymentNetwork(31337)).toBe("chain-31337");
  });

  test("returns both local and static deployment artifact paths", () => {
    expect(getDeploymentArtifactPaths("base-sepolia")).toEqual([
      "deployments/base-sepolia.json",
      "public/deployments/base-sepolia.json",
    ]);
  });

  test("merges deployment addresses and start block into runtime config", () => {
    const base = resolveRuntimeConfig({
      VITE_CHAIN_ID: "84532",
      VITE_PUBLIC_RPC_URL: "https://example-rpc.invalid",
    });

    const deployment: DeploymentSnapshot = {
      network: "base-sepolia",
      chainId: 84532,
      deployer: "0xaaaa",
      deployedAt: "2026-03-22T00:00:00.000Z",
      startBlock: 120,
      addresses: {
        journal: "0x1111111111111111111111111111111111111111",
        submission: "0x2222222222222222222222222222222222222222",
        review: "0x3333333333333333333333333333333333333333",
        reputation: "0x4444444444444444444444444444444444444444",
      },
    };

    const merged = applyDeploymentToRuntimeConfig(base, deployment);

    expect(merged.addresses.submission).toBe("0x2222222222222222222222222222222222222222");
    expect(merged.startBlock).toBe(120);
    expect(merged.isReadyForWrites).toBe(true);
    expect(merged.isReadyForReads).toBe(true);
    expect(merged.mode).toBe("live");
  });

  test("ignores deployment files from a different chain id", () => {
    const base = resolveRuntimeConfig({
      VITE_CHAIN_ID: "84532",
    });

    const deployment: DeploymentSnapshot = {
      network: "base-mainnet",
      chainId: 8453,
      deployer: "0xaaaa",
      deployedAt: "2026-03-22T00:00:00.000Z",
      startBlock: 88,
      addresses: {
        journal: "0x1111111111111111111111111111111111111111",
        submission: "0x2222222222222222222222222222222222222222",
        review: "0x3333333333333333333333333333333333333333",
        reputation: "0x4444444444444444444444444444444444444444",
      },
    };

    const merged = applyDeploymentToRuntimeConfig(base, deployment);

    expect(merged.addresses.submission).toBeNull();
    expect(merged.startBlock).toBeNull();
    expect(merged.isReadyForWrites).toBe(false);
  });
});
