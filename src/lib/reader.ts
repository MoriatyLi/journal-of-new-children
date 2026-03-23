import { Contract, JsonRpcProvider } from "ethers";

import {
  journalRegistryAbi,
  reputationSbtAbi,
  reviewRegistryAbi,
  submissionRegistryAbi,
} from "@/lib/abis";
import type {
  Decision,
  DisputeCase,
  ProtocolDashboardSnapshot,
  ReputationRecord,
  Review,
  ReviewerProfile,
  Submission,
  SubmissionStatus,
  SubmissionVersion,
} from "@/lib/protocol";
import type { RuntimeConfig } from "@/lib/runtime";

const MAX_SUBMISSIONS = 6;
const MAX_REVIEWS = 6;
const MAX_LEDGER = 6;
const MAX_DECISIONS = 6;
const MAX_DISPUTES = 6;

type StructLike = Record<string, unknown> | readonly unknown[] | null | undefined;
type LogLike = {
  args?: Record<string, unknown> | readonly unknown[];
  blockNumber?: number;
};

type LiveReaderContracts = {
  journal: {
    journalName: () => Promise<string>;
    activeReviewerCount: () => Promise<bigint>;
    activeSubmissionCount: () => Promise<bigint>;
    completedReviewCount: () => Promise<bigint>;
    genesisCouncilActive: () => Promise<boolean>;
  };
  submissions: {
    submissionCount: () => Promise<bigint>;
    getSubmission: (submissionId: bigint) => Promise<StructLike>;
    getVersion: (submissionId: bigint, versionId: bigint) => Promise<StructLike>;
  };
  reviews: {
    reviewCount: () => Promise<bigint>;
    disputeCount: () => Promise<bigint>;
    getReview: (reviewId: bigint) => Promise<StructLike>;
    getDispute: (disputeId: bigint) => Promise<StructLike>;
    filters: {
      DecisionRecorded: () => unknown;
    };
    queryFilter: (filter: unknown, fromBlock?: number) => Promise<LogLike[]>;
  };
  reputation: {
    getProfile: (subject: string) => Promise<StructLike>;
    filters: {
      ReputationGranted: () => unknown;
    };
    queryFilter: (filter: unknown, fromBlock?: number) => Promise<LogLike[]>;
  };
};

export type LiveReaderDeps = {
  contracts: LiveReaderContracts;
  getBlock: (blockNumber: number) => Promise<{ timestamp: number | bigint } | null>;
};

function readField(value: StructLike, key: string, index: number): unknown {
  if (value && typeof value === "object" && key in value) {
    return (value as Record<string, unknown>)[key];
  }

  if (Array.isArray(value)) {
    return value[index];
  }

  return undefined;
}

function readLogArg(value: LogLike, key: string, index: number): unknown {
  const args = value.args;
  if (args && typeof args === "object" && !Array.isArray(args) && key in args) {
    return (args as Record<string, unknown>)[key];
  }

  if (Array.isArray(args)) {
    return args[index];
  }

  return undefined;
}

function toNumber(value: unknown): number {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value);
  return 0;
}

function toBoolean(value: unknown): boolean {
  return Boolean(value);
}

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((entry) => String(entry)) : [];
}

function formatDateFromUnix(value: unknown): string {
  const timestamp = toNumber(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return "未记录";
  }

  return new Date(timestamp * 1000).toISOString().slice(0, 10);
}

async function formatDateFromLog(log: LogLike, getBlock: LiveReaderDeps["getBlock"]): Promise<string> {
  if (typeof log.blockNumber !== "number") {
    return "未记录";
  }

  const block = await getBlock(log.blockNumber);
  return block ? formatDateFromUnix(block.timestamp) : "未记录";
}

function createDescendingIds(count: bigint, limit: number): bigint[] {
  const ids: bigint[] = [];

  for (let current = count; current > 0n && ids.length < limit; current -= 1n) {
    ids.push(current);
  }

  return ids;
}

function shortenAddress(address: string): string {
  if (!address.startsWith("0x") || address.length < 10) {
    return address || "未知地址";
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function mapSubmissionStatus(code: number): SubmissionStatus {
  switch (code) {
    case 0:
      return "draft";
    case 1:
      return "submitted";
    case 2:
      return "under_review";
    case 3:
      return "accepted";
    case 4:
      return "revise";
    case 5:
      return "rejected";
    case 6:
      return "archived";
    default:
      return "submitted";
  }
}

function mapReviewRecommendation(code: number): Review["recommendation"] {
  switch (code) {
    case 0:
      return "accept";
    case 1:
      return "revise";
    default:
      return "reject";
  }
}

function mapDecision(code: number): Decision["label"] {
  switch (code) {
    case 3:
      return "accepted";
    case 4:
      return "revise";
    case 5:
      return "rejected";
    default:
      return "revise";
  }
}

function mapReputationRole(code: number): ReputationRecord["role"] {
  switch (code) {
    case 0:
      return "author";
    case 1:
      return "reviewer";
    case 2:
      return "editor";
    default:
      return "editor";
  }
}

function mapDisputeTargetType(code: number): DisputeCase["targetType"] {
  return code === 1 ? "decision" : "review";
}

function buildLiveReaderDeps(config: RuntimeConfig): LiveReaderDeps {
  if (!config.isReadyForReads || !config.publicRpcUrl) {
    throw new Error("缺少公共 RPC 配置，暂时无法加载链上快照。");
  }

  const provider = new JsonRpcProvider(config.publicRpcUrl);

  return {
    contracts: {
      journal: new Contract(config.addresses.journal!, journalRegistryAbi, provider) as unknown as LiveReaderContracts["journal"],
      submissions: new Contract(
        config.addresses.submission!,
        submissionRegistryAbi,
        provider,
      ) as unknown as LiveReaderContracts["submissions"],
      reviews: new Contract(config.addresses.review!, reviewRegistryAbi, provider) as unknown as LiveReaderContracts["reviews"],
      reputation: new Contract(
        config.addresses.reputation!,
        reputationSbtAbi,
        provider,
      ) as unknown as LiveReaderContracts["reputation"],
    },
    getBlock: async (blockNumber) => provider.getBlock(blockNumber),
  };
}

async function loadSubmission(
  contract: LiveReaderContracts["submissions"],
  submissionId: bigint,
): Promise<Submission> {
  const rawSubmission = await contract.getSubmission(submissionId);
  const latestVersionId = toNumber(readField(rawSubmission, "latestVersionId", 2));

  const versions = await Promise.all(
    Array.from({ length: latestVersionId }, (_, index) =>
      contract.getVersion(submissionId, BigInt(index + 1)),
    ),
  );

  const hydratedVersions: SubmissionVersion[] = versions.map((version, index) => ({
    id: toNumber(readField(version, "versionId", 0)) || index + 1,
    parentVersion:
      toNumber(readField(version, "parentVersionId", 1)) > 0
        ? toNumber(readField(version, "parentVersionId", 1))
        : null,
    title: toStringValue(readField(version, "title", 2)),
    abstract: toStringValue(readField(version, "abstractText", 3)),
    manifestUri: toStringValue(readField(version, "manifestURI", 4)),
    contentUri: toStringValue(readField(version, "contentURI", 5)),
    mirrorUri: toStringValue(readField(version, "mirrorURI", 6)),
    createdAt: formatDateFromUnix(readField(version, "createdAt", 11)),
  }));

  const latestVersion = hydratedVersions[hydratedVersions.length - 1];

  return {
    id: toNumber(readField(rawSubmission, "id", 0)) || Number(submissionId),
    title: latestVersion?.title ?? `稿件 #${submissionId}`,
    status: mapSubmissionStatus(toNumber(readField(rawSubmission, "status", 3))),
    authors: toStringArray(readField(versions[0], "authorRefs", 8)),
    currentVersion: latestVersionId,
    category: "research-note",
    versions: hydratedVersions,
  };
}

async function loadReviewFeed(
  reviewsContract: LiveReaderContracts["reviews"],
  reputationContract: LiveReaderContracts["reputation"],
): Promise<{ reviews: Review[]; reviewers: ReviewerProfile[] }> {
  const reviewCount = await reviewsContract.reviewCount();
  const reviewIds = createDescendingIds(reviewCount, MAX_REVIEWS * 4);
  const rawReviews = await Promise.all(reviewIds.map((reviewId) => reviewsContract.getReview(reviewId)));

  const submittedReviews = rawReviews
    .filter((review) => toBoolean(readField(review, "submitted", 7)))
    .slice(0, MAX_REVIEWS);

  const reviewerAddresses = Array.from(
    new Set(
      submittedReviews
        .map((review) => toStringValue(readField(review, "reviewer", 2)))
        .filter(Boolean),
    ),
  );

  const reviewerProfiles = new Map<string, StructLike>(
    await Promise.all(
      reviewerAddresses.map(async (address) => [address, await reputationContract.getProfile(address)] as const),
    ),
  );

  const reviews: Review[] = submittedReviews.map((review) => {
    const reviewer = toStringValue(readField(review, "reviewer", 2));
    const profile = reviewerProfiles.get(reviewer);

    return {
      id: toNumber(readField(review, "id", 0)),
      submissionId: toNumber(readField(review, "submissionId", 1)),
      reviewer,
      recommendation: mapReviewRecommendation(toNumber(readField(review, "recommendation", 12))),
      summary: toStringValue(readField(review, "summary", 13)),
      weight: toNumber(readField(profile, "reviewerWeight", 1)),
      publishedAt: formatDateFromUnix(readField(review, "submittedAt", 15)),
    };
  });

  const completedReviewsByAddress = reviews.reduce<Map<string, number>>((accumulator, review) => {
    accumulator.set(review.reviewer, (accumulator.get(review.reviewer) ?? 0) + 1);
    return accumulator;
  }, new Map());

  const reviewers: ReviewerProfile[] = reviewerAddresses
    .map((address) => {
      const profile = reviewerProfiles.get(address);
      const metadataUri = toStringValue(readField(profile, "metadataURI", 4));

      return {
        handle: `链上评审 ${shortenAddress(address)}`,
        address,
        weight: toNumber(readField(profile, "reviewerWeight", 1)),
        completedReviews: completedReviewsByAddress.get(address) ?? 0,
        discipline: metadataUri ? "已登记链上档案" : "链上评审人",
      };
    })
    .sort((left, right) => right.weight - left.weight);

  return { reviews, reviewers };
}

async function loadDecisions(
  reviewsContract: LiveReaderContracts["reviews"],
  getBlock: LiveReaderDeps["getBlock"],
  startBlock: number,
): Promise<Decision[]> {
  const logs = await reviewsContract.queryFilter(reviewsContract.filters.DecisionRecorded(), startBlock);
  const sortedLogs = [...logs]
    .sort((left, right) => (right.blockNumber ?? 0) - (left.blockNumber ?? 0))
    .slice(0, MAX_DECISIONS);

  return Promise.all(
    sortedLogs.map(async (log) => ({
      submissionId: toNumber(readLogArg(log, "submissionId", 0)),
      label: mapDecision(toNumber(readLogArg(log, "decision", 1))),
      rationale: toStringValue(readLogArg(log, "rationaleURI", 2)),
      recordedAt: await formatDateFromLog(log, getBlock),
    })),
  );
}

async function loadReputationLedger(
  reputationContract: LiveReaderContracts["reputation"],
  startBlock: number,
): Promise<ReputationRecord[]> {
  const logs = await reputationContract.queryFilter(
    reputationContract.filters.ReputationGranted(),
    startBlock,
  );

  return [...logs]
    .sort((left, right) => (right.blockNumber ?? 0) - (left.blockNumber ?? 0))
    .slice(0, MAX_LEDGER)
    .map((log) => ({
      subject: toStringValue(readLogArg(log, "subject", 0)),
      role: mapReputationRole(toNumber(readLogArg(log, "role", 1))),
      delta: toNumber(readLogArg(log, "points", 2)),
      evidenceUri: toStringValue(readLogArg(log, "metadataURI", 5)),
    }));
}

async function loadDisputes(reviewsContract: LiveReaderContracts["reviews"]): Promise<DisputeCase[]> {
  const disputeCount = await reviewsContract.disputeCount();
  const disputeIds = createDescendingIds(disputeCount, MAX_DISPUTES);
  const disputes = await Promise.all(disputeIds.map((disputeId) => reviewsContract.getDispute(disputeId)));

  return disputes.map((dispute) => ({
    id: toNumber(readField(dispute, "id", 0)),
    title: toStringValue(readField(dispute, "reason", 4)) || `争议 #${toNumber(readField(dispute, "id", 0))}`,
    status: toBoolean(readField(dispute, "resolved", 6)) ? "resolved" : "open",
    targetType: mapDisputeTargetType(toNumber(readField(dispute, "targetType", 1))),
    evidenceUri: toStringValue(readField(dispute, "evidenceURI", 5)),
  }));
}

export async function loadLiveProtocolSnapshot(
  config: RuntimeConfig,
  deps?: LiveReaderDeps,
): Promise<ProtocolDashboardSnapshot> {
  if (!config.isReadyForReads || !config.publicRpcUrl) {
    throw new Error("缺少公共 RPC 配置，暂时无法加载链上快照。");
  }

  const { contracts, getBlock } = deps ?? buildLiveReaderDeps(config);
  const startBlock = config.startBlock ?? 0;

  const [
    journalName,
    activeReviewerCount,
    activeSubmissionCount,
    completedReviewCount,
    genesisCouncilActive,
    submissionCount,
  ] = await Promise.all([
    contracts.journal.journalName(),
    contracts.journal.activeReviewerCount(),
    contracts.journal.activeSubmissionCount(),
    contracts.journal.completedReviewCount(),
    contracts.journal.genesisCouncilActive(),
    contracts.submissions.submissionCount(),
  ]);

  const submissionIds = createDescendingIds(submissionCount, MAX_SUBMISSIONS);
  const submissions = await Promise.all(
    submissionIds.map((submissionId) => loadSubmission(contracts.submissions, submissionId)),
  );

  const [{ reviews, reviewers }, decisions, reputationLedger, disputes] = await Promise.all([
    loadReviewFeed(contracts.reviews, contracts.reputation),
    loadDecisions(contracts.reviews, getBlock, startBlock),
    loadReputationLedger(contracts.reputation, startBlock),
    loadDisputes(contracts.reviews),
  ]);

  return {
    protocolMetrics: [
      {
        label: "链上投稿",
        value: String(toNumber(activeSubmissionCount)),
        detail: `${journalName} 已归档投稿`,
      },
      {
        label: "公开评审",
        value: String(toNumber(completedReviewCount)),
        detail: `活跃评审 ${toNumber(activeReviewerCount)} 位`,
      },
      {
        label: "创世理事会",
        value: genesisCouncilActive ? "运行中" : "已休眠",
        detail: genesisCouncilActive ? "冷启动阈值尚未满足" : "达到阈值后自动退场",
      },
    ],
    submissions,
    reviews,
    reviewers,
    decisions,
    reputationLedger,
    disputes,
  };
}
