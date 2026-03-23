import { z } from "zod";

export const submissionManifestSchema = z.object({
  title: z.string().min(6),
  abstract: z.string().min(24),
  authors: z.array(z.string()).min(1),
  orcid: z.string().nullable().optional(),
  license: z.string().min(3),
  content_uri: z.string().min(8),
  data_uri: z.array(z.string()).default([]),
  code_uri: z.array(z.string()).default([]),
  parent_version: z.number().int().positive().nullable(),
});

export type SubmissionManifest = z.infer<typeof submissionManifestSchema>;

export const submissionDraftSchema = z.object({
  title: z.string().min(6),
  abstract: z.string().min(24),
  authorsText: z.string().min(4),
  orcid: z.string().optional(),
  license: z.string().min(3),
  manifestUri: z.string().optional(),
  contentUri: z.string().min(8),
  mirrorUri: z.string().optional(),
  dataUrisText: z.string().optional(),
  codeUrisText: z.string().optional(),
  parentVersion: z.string().optional(),
});

export type SubmissionDraftInput = z.infer<typeof submissionDraftSchema>;

export const versionDraftSchema = z.object({
  submissionId: z.string().min(1),
  parentVersionId: z.string().min(1),
  title: z.string().min(6),
  abstract: z.string().min(24),
  manifestUri: z.string().min(8),
  contentUri: z.string().min(8),
  mirrorUri: z.string().min(6),
  dataUrisText: z.string().optional(),
  codeUrisText: z.string().optional(),
});

export type VersionDraftInput = z.infer<typeof versionDraftSchema>;

export const reviewOpenDraftSchema = z.object({
  submissionId: z.string().min(1),
  conflictStatement: z.string().min(2),
  dueInDays: z.string().min(1),
  isSelfNominated: z.boolean(),
});

export type ReviewOpenDraftInput = z.infer<typeof reviewOpenDraftSchema>;

export const reviewSubmissionDraftSchema = z.object({
  reviewId: z.string().min(1),
  methodologyScore: z.string().min(1),
  noveltyScore: z.string().min(1),
  rigorScore: z.string().min(1),
  clarityScore: z.string().min(1),
  recommendation: z.enum(["accept", "revise", "reject"]),
  summary: z.string().min(10),
  reviewUri: z.string().min(8),
});

export type ReviewSubmissionDraftInput = z.infer<typeof reviewSubmissionDraftSchema>;

export const disputeDraftSchema = z.object({
  targetType: z.enum(["decision", "review"]),
  targetId: z.string().min(1),
  reason: z.string().min(6),
  evidenceUri: z.string().min(8),
});

export type DisputeDraftInput = z.infer<typeof disputeDraftSchema>;

export type SubmissionStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "accepted"
  | "revise"
  | "rejected"
  | "archived";

export type SubmissionVersion = {
  id: number;
  parentVersion: number | null;
  title: string;
  abstract: string;
  manifestUri: string;
  contentUri: string;
  mirrorUri: string;
  createdAt: string;
};

export type Submission = {
  id: number;
  title: string;
  status: SubmissionStatus;
  authors: string[];
  currentVersion: number;
  versions: SubmissionVersion[];
  category: "research-note" | "commentary" | "replication" | "negative-result";
};

export type Review = {
  id: number;
  submissionId: number;
  reviewer: string;
  recommendation: "accept" | "revise" | "reject";
  summary: string;
  weight: number;
  publishedAt: string;
};

export type Decision = {
  submissionId: number;
  label: "accepted" | "revise" | "rejected";
  rationale: string;
  recordedAt: string;
};

export type ReviewerProfile = {
  handle: string;
  address: string;
  weight: number;
  completedReviews: number;
  discipline: string;
};

export type ReputationRecord = {
  subject: string;
  role: "author" | "reviewer" | "editor";
  delta: number;
  evidenceUri: string;
};

export type DisputeCase = {
  id: number;
  title: string;
  status: "open" | "resolved";
  targetType: "decision" | "review";
  evidenceUri: string;
};

export type ProtocolMetric = {
  label: string;
  value: string;
  detail: string;
};

export type ProtocolDashboardSnapshot = {
  protocolMetrics: ProtocolMetric[];
  submissions: Submission[];
  reviews: Review[];
  reviewers: ReviewerProfile[];
  decisions: Decision[];
  reputationLedger: ReputationRecord[];
  disputes: DisputeCase[];
};

export type VersionDraftPayload = {
  submissionId: number;
  parentVersionId: number;
  title: string;
  abstract: string;
  manifestUri: string;
  contentUri: string;
  mirrorUri: string;
  dataUris: string[];
  codeUris: string[];
};

export type ReviewOpenDraftPayload = {
  submissionId: number;
  conflictStatement: string;
  dueInDays: number;
  isSelfNominated: boolean;
};

export type ReviewSubmissionDraftPayload = {
  reviewId: number;
  methodologyScore: number;
  noveltyScore: number;
  rigorScore: number;
  clarityScore: number;
  recommendation: 0 | 1 | 2;
  summary: string;
  reviewUri: string;
};

export type DisputeDraftPayload = {
  targetType: 1 | 2;
  targetId: number;
  reason: string;
  evidenceUri: string;
};

export function buildReviewerWeightLabel(weight: number): string {
  if (weight >= 70) return "高信任评审人";
  if (weight >= 25) return "成长中评审人";
  return "观察期评审人";
}

export function splitDelimitedEntries(value: string | undefined): string[] {
  return (value ?? "")
    .split(/[\n,]/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function buildSubmissionManifestFromDraft(
  input: SubmissionDraftInput,
): SubmissionManifest {
  const parsed = submissionDraftSchema.parse(input);

  return submissionManifestSchema.parse({
    title: parsed.title.trim(),
    abstract: parsed.abstract.trim(),
    authors: splitDelimitedEntries(parsed.authorsText),
    orcid: parsed.orcid?.trim() || null,
    license: parsed.license.trim(),
    content_uri: parsed.contentUri.trim(),
    data_uri: splitDelimitedEntries(parsed.dataUrisText),
    code_uri: splitDelimitedEntries(parsed.codeUrisText),
    parent_version: parsed.parentVersion?.trim()
      ? Number(parsed.parentVersion.trim())
      : null,
  });
}

function parsePositiveInteger(value: string, fieldName: string): number {
  const parsed = Number(value.trim());

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} 必须是正整数。`);
  }

  return parsed;
}

function parseScore(value: string, fieldName: string): number {
  const parsed = parsePositiveInteger(value, fieldName);

  if (parsed > 5) {
    throw new Error(`${fieldName} 必须介于 1 到 5 之间。`);
  }

  return parsed;
}

export function buildVersionDraftPayload(input: VersionDraftInput): VersionDraftPayload {
  const parsed = versionDraftSchema.parse(input);

  return {
    submissionId: parsePositiveInteger(parsed.submissionId, "稿件编号"),
    parentVersionId: parsePositiveInteger(parsed.parentVersionId, "父版本号"),
    title: parsed.title.trim(),
    abstract: parsed.abstract.trim(),
    manifestUri: parsed.manifestUri.trim(),
    contentUri: parsed.contentUri.trim(),
    mirrorUri: parsed.mirrorUri.trim(),
    dataUris: splitDelimitedEntries(parsed.dataUrisText),
    codeUris: splitDelimitedEntries(parsed.codeUrisText),
  };
}

export function buildReviewOpenDraftPayload(
  input: ReviewOpenDraftInput,
): ReviewOpenDraftPayload {
  const parsed = reviewOpenDraftSchema.parse(input);

  return {
    submissionId: parsePositiveInteger(parsed.submissionId, "稿件编号"),
    conflictStatement: parsed.conflictStatement.trim(),
    dueInDays: parsePositiveInteger(parsed.dueInDays, "截止天数"),
    isSelfNominated: parsed.isSelfNominated,
  };
}

export function buildReviewSubmissionDraftPayload(
  input: ReviewSubmissionDraftInput,
): ReviewSubmissionDraftPayload {
  const parsed = reviewSubmissionDraftSchema.parse(input);

  const recommendationMap: Record<ReviewSubmissionDraftInput["recommendation"], 0 | 1 | 2> = {
    accept: 0,
    revise: 1,
    reject: 2,
  };

  return {
    reviewId: parsePositiveInteger(parsed.reviewId, "评审编号"),
    methodologyScore: parseScore(parsed.methodologyScore, "方法学评分"),
    noveltyScore: parseScore(parsed.noveltyScore, "新颖性评分"),
    rigorScore: parseScore(parsed.rigorScore, "严谨性评分"),
    clarityScore: parseScore(parsed.clarityScore, "表达清晰度评分"),
    recommendation: recommendationMap[parsed.recommendation],
    summary: parsed.summary.trim(),
    reviewUri: parsed.reviewUri.trim(),
  };
}

export function buildDisputeDraftPayload(input: DisputeDraftInput): DisputeDraftPayload {
  const parsed = disputeDraftSchema.parse(input);

  return {
    targetType: parsed.targetType === "decision" ? 1 : 2,
    targetId: parsePositiveInteger(parsed.targetId, "目标编号"),
    reason: parsed.reason.trim(),
    evidenceUri: parsed.evidenceUri.trim(),
  };
}

export function formatStatus(status: SubmissionStatus): string {
  const labels: Record<SubmissionStatus, string> = {
    draft: "草稿",
    submitted: "已提交",
    under_review: "评审中",
    accepted: "已录用",
    revise: "需修改",
    rejected: "未录用",
    archived: "已归档",
  };

  return labels[status];
}

export function formatRecommendation(recommendation: Review["recommendation"]): string {
  const labels: Record<Review["recommendation"], string> = {
    accept: "建议录用",
    revise: "建议修改",
    reject: "建议拒稿",
  };

  return labels[recommendation];
}

export function formatDecisionLabel(label: Decision["label"]): string {
  const labels: Record<Decision["label"], string> = {
    accepted: "录用",
    revise: "返修",
    rejected: "拒稿",
  };

  return labels[label];
}

export function formatRole(role: ReputationRecord["role"]): string {
  const labels: Record<ReputationRecord["role"], string> = {
    author: "作者",
    reviewer: "评审人",
    editor: "编辑",
  };

  return labels[role];
}

export function formatDisputeStatus(status: DisputeCase["status"]): string {
  const labels: Record<DisputeCase["status"], string> = {
    open: "处理中",
    resolved: "已解决",
  };

  return labels[status];
}
