import type {
  Decision,
  DisputeCase,
  ProtocolDashboardSnapshot,
  ReputationRecord,
  Review,
  ReviewerProfile,
  Submission,
} from "@/lib/protocol";

export const protocolMetrics = [
  { label: "链上投稿", value: "128", detail: "永久编号 + 版本树" },
  { label: "公开评审", value: "364", detail: "按声誉权重计入影响力" },
  { label: "创世理事会", value: "已休眠", detail: "达到阈值后自动退场" },
];

export const featuredSubmissions: Submission[] = [
  {
    id: 17,
    title: "关于解码器漂移的负结果报告",
    status: "under_review",
    authors: ["wallet:0xabc", "orcid:0000-0000-0000-0001"],
    currentVersion: 2,
    category: "negative-result",
    versions: [
      {
        id: 1,
        parentVersion: null,
        title: "关于解码器漂移的负结果报告",
        abstract: "首次记录多语蒸馏在受限算力条件下的失败模式，并公开不可复现实验日志。",
        manifestUri: "ipfs://manifest-v1",
        contentUri: "ipfs://paper-v1",
        mirrorUri: "ar://paper-v1",
        createdAt: "2026-03-10",
      },
      {
        id: 2,
        parentVersion: 1,
        title: "关于解码器漂移的负结果报告（修订版）",
        abstract: "补入复现实验附录、更加清晰的消融对照，以及数据公开承诺。",
        manifestUri: "ipfs://manifest-v2",
        contentUri: "ipfs://paper-v2",
        mirrorUri: "ar://paper-v2",
        createdAt: "2026-03-18",
      },
    ],
  },
  {
    id: 21,
    title: "谁拥有一篇评审？关于公开学术劳动的短评",
    status: "accepted",
    authors: ["wallet:0x98c"],
    currentVersion: 1,
    category: "commentary",
    versions: [
      {
        id: 1,
        parentVersion: null,
        title: "谁拥有一篇评审？关于公开学术劳动的短评",
        abstract: "讨论评审劳动的归属、署名权与开放学术档案的边界。",
        manifestUri: "ipfs://manifest-labor",
        contentUri: "ipfs://paper-labor",
        mirrorUri: "ar://paper-labor",
        createdAt: "2026-03-07",
      },
    ],
  },
];

export const recentReviews: Review[] = [
  {
    id: 11,
    submissionId: 17,
    reviewer: "0x91C8...A11F",
    recommendation: "revise",
    summary: "材料公开做得很扎实，但对失败原因的因果解释仍然偏薄，建议返修后再定结论。",
    weight: 84,
    publishedAt: "2026-03-20",
  },
  {
    id: 12,
    submissionId: 17,
    reviewer: "0xA9B1...24E3",
    recommendation: "accept",
    summary: "这篇负结果的价值恰恰在于，它替后来者省掉了六周重复踩坑的时间。",
    weight: 48,
    publishedAt: "2026-03-21",
  },
];

export const reviewers: ReviewerProfile[] = [
  {
    handle: "复现实验北侧站",
    address: "0x91C8...A11F",
    weight: 84,
    completedReviews: 19,
    discipline: "机器学习系统",
  },
  {
    handle: "负结果俱乐部",
    address: "0xA9B1...24E3",
    weight: 48,
    completedReviews: 8,
    discipline: "开放科学",
  },
  {
    handle: "协议编辑部",
    address: "0xD31C...E9F0",
    weight: 16,
    completedReviews: 2,
    discipline: "治理设计",
  },
];

export const decisions: Decision[] = [
  {
    submissionId: 21,
    label: "accepted",
    rationale: "在两篇公开评审意见一致且无未决争议后，作为编辑短评正式录用。",
    recordedAt: "2026-03-14",
  },
];

export const reputationLedger: ReputationRecord[] = [
  {
    subject: "0x91C8...A11F",
    role: "reviewer",
    delta: 12,
    evidenceUri: "ipfs://rep-evidence-91c8",
  },
  {
    subject: "0xabc...0001",
    role: "author",
    delta: 9,
    evidenceUri: "ipfs://rep-evidence-author",
  },
];

export const disputes: DisputeCase[] = [
  {
    id: 4,
    title: "对第 7 号评审中方法学夸大表述的异议",
    status: "open",
    targetType: "review",
    evidenceUri: "ipfs://dispute-4",
  },
];

export const mockProtocolSnapshot: ProtocolDashboardSnapshot = {
  protocolMetrics,
  submissions: featuredSubmissions,
  reviews: recentReviews,
  reviewers,
  decisions,
  reputationLedger,
  disputes,
};
