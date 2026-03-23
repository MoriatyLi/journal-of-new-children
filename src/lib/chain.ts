import { BrowserProvider, Contract } from "ethers";

import { reviewRegistryAbi, submissionRegistryAbi } from "@/lib/abis";
import {
  buildDisputeDraftPayload,
  buildReviewOpenDraftPayload,
  buildReviewSubmissionDraftPayload,
  buildSubmissionManifestFromDraft,
  buildVersionDraftPayload,
  type DisputeDraftInput,
  type ReviewOpenDraftInput,
  type ReviewSubmissionDraftInput,
  type SubmissionDraftInput,
  type VersionDraftInput,
} from "@/lib/protocol";
import type { RuntimeConfig } from "@/lib/runtime";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
      on?: (event: string, listener: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
    };
  }
}

export type WalletSnapshot = {
  hasProvider: boolean;
  connected: boolean;
  account: string | null;
  chainId: number | null;
};

function withGasBuffer(estimate: bigint): bigint {
  return (estimate * 12n) / 10n + 50_000n;
}

function assertWritableConfig(config: RuntimeConfig, address: string | null, label: string) {
  if (!config.isReadyForWrites || !address) {
    throw new Error(`当前运行环境未配置 ${label} 合约地址。`);
  }

  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("当前浏览器没有检测到钱包扩展。");
  }
}

async function getWriter(address: string, abi: object) {
  const provider = new BrowserProvider(window.ethereum!);
  const signer = await provider.getSigner();
  const contract = new Contract(address, abi, signer);

  return { provider, signer, contract };
}

export function getWalletSnapshot(): WalletSnapshot {
  return {
    hasProvider: typeof window !== "undefined" && Boolean(window.ethereum),
    connected: false,
    account: null,
    chainId: null,
  };
}

export async function connectWallet(): Promise<WalletSnapshot> {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("当前浏览器没有检测到钱包扩展。");
  }

  const provider = new BrowserProvider(window.ethereum);
  const accounts = (await provider.send("eth_requestAccounts", [])) as string[];
  const network = await provider.getNetwork();

  return {
    hasProvider: true,
    connected: accounts.length > 0,
    account: accounts[0] ?? null,
    chainId: Number(network.chainId),
  };
}

export async function submitSubmissionTransaction(
  config: RuntimeConfig,
  draft: SubmissionDraftInput,
): Promise<{ hash: string }> {
  assertWritableConfig(config, config.addresses.submission, "SubmissionRegistry");

  if (!draft.manifestUri.trim()) {
    throw new Error("请先填写已上传到去中心化存储的 manifest URI。");
  }

  const manifest = buildSubmissionManifestFromDraft(draft);
  const { contract } = await getWriter(config.addresses.submission!, submissionRegistryAbi);
  const createSubmissionArgs = [
    manifest.title,
    manifest.abstract,
    draft.manifestUri.trim(),
    manifest.content_uri,
    draft.mirrorUri.trim(),
    manifest.license,
    manifest.authors,
    manifest.data_uri,
    manifest.code_uri,
  ] as const;
  const gasEstimate = (await contract.createSubmission.estimateGas(...createSubmissionArgs)) as bigint;

  const tx = await contract.createSubmission(...createSubmissionArgs, {
    gasLimit: withGasBuffer(gasEstimate),
  });

  return { hash: tx.hash as string };
}

export async function submitSubmissionVersionTransaction(
  config: RuntimeConfig,
  draft: VersionDraftInput,
): Promise<{ hash: string }> {
  assertWritableConfig(config, config.addresses.submission, "SubmissionRegistry");

  const payload = buildVersionDraftPayload(draft);
  const { contract } = await getWriter(config.addresses.submission!, submissionRegistryAbi);
  const addVersionArgs = [
    BigInt(payload.submissionId),
    BigInt(payload.parentVersionId),
    payload.title,
    payload.abstract,
    payload.manifestUri,
    payload.contentUri,
    payload.mirrorUri,
    payload.dataUris,
    payload.codeUris,
  ] as const;
  const gasEstimate = (await contract.addVersion.estimateGas(...addVersionArgs)) as bigint;

  const tx = await contract.addVersion(...addVersionArgs, {
    gasLimit: withGasBuffer(gasEstimate),
  });

  return { hash: tx.hash as string };
}

export async function openReviewTransaction(
  config: RuntimeConfig,
  draft: ReviewOpenDraftInput,
): Promise<{ hash: string }> {
  assertWritableConfig(config, config.addresses.review, "ReviewRegistry");

  const payload = buildReviewOpenDraftPayload(draft);
  const { signer, contract } = await getWriter(config.addresses.review!, reviewRegistryAbi);
  const reviewer = await signer.getAddress();
  const dueAt = BigInt(Math.floor(Date.now() / 1000) + payload.dueInDays * 86400);
  const openReviewArgs = [
    BigInt(payload.submissionId),
    reviewer,
    payload.isSelfNominated,
    payload.conflictStatement,
    dueAt,
  ] as const;
  const gasEstimate = (await contract.openReview.estimateGas(...openReviewArgs)) as bigint;

  const tx = await contract.openReview(...openReviewArgs, {
    gasLimit: withGasBuffer(gasEstimate),
  });

  return { hash: tx.hash as string };
}

export async function submitReviewTransaction(
  config: RuntimeConfig,
  draft: ReviewSubmissionDraftInput,
): Promise<{ hash: string }> {
  assertWritableConfig(config, config.addresses.review, "ReviewRegistry");

  const payload = buildReviewSubmissionDraftPayload(draft);
  const { contract } = await getWriter(config.addresses.review!, reviewRegistryAbi);
  const submitReviewArgs = [
    BigInt(payload.reviewId),
    payload.methodologyScore,
    payload.noveltyScore,
    payload.rigorScore,
    payload.clarityScore,
    payload.recommendation,
    payload.summary,
    payload.reviewUri,
  ] as const;
  const gasEstimate = (await contract.submitReview.estimateGas(...submitReviewArgs)) as bigint;

  const tx = await contract.submitReview(...submitReviewArgs, {
    gasLimit: withGasBuffer(gasEstimate),
  });

  return { hash: tx.hash as string };
}

export async function openDisputeTransaction(
  config: RuntimeConfig,
  draft: DisputeDraftInput,
): Promise<{ hash: string }> {
  assertWritableConfig(config, config.addresses.review, "ReviewRegistry");

  const payload = buildDisputeDraftPayload(draft);
  const { contract } = await getWriter(config.addresses.review!, reviewRegistryAbi);
  const openDisputeArgs = [
    payload.targetType,
    BigInt(payload.targetId),
    payload.reason,
    payload.evidenceUri,
  ] as const;
  const gasEstimate = (await contract.openDispute.estimateGas(...openDisputeArgs)) as bigint;

  const tx = await contract.openDispute(...openDisputeArgs, {
    gasLimit: withGasBuffer(gasEstimate),
  });

  return { hash: tx.hash as string };
}
