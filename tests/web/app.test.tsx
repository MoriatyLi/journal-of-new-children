import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

import { App } from "@/App";
import {
  buildDisputeDraftPayload,
  buildReviewerWeightLabel,
  buildReviewOpenDraftPayload,
  buildReviewSubmissionDraftPayload,
  buildSubmissionManifestFromDraft,
  buildVersionDraftPayload,
  submissionManifestSchema,
} from "@/lib/protocol";
import { resolveRuntimeConfig } from "@/lib/runtime";

describe("submission manifest schema", () => {
  test("accepts a versioned manifest for research notes", () => {
    const parsed = submissionManifestSchema.parse({
      title: "关于解码器漂移的负结果报告",
      abstract: "我们记录一条多语言蒸馏管线的失败案例，并解释为什么这类负结果值得公开。",
      authors: ["wallet:0xabc", "orcid:0000-0000-0000-0001"],
      orcid: "0000-0000-0000-0001",
      license: "CC-BY-4.0",
      content_uri: "ipfs://paper-v1",
      data_uri: ["ipfs://dataset-v1"],
      code_uri: ["https://github.com/openjournal/repro"],
      parent_version: null,
    });

    expect(parsed.title).toContain("负结果");
  });

  test("builds reviewer labels from weighted reputation", () => {
    expect(buildReviewerWeightLabel(87)).toBe("高信任评审人");
    expect(buildReviewerWeightLabel(42)).toBe("成长中评审人");
    expect(buildReviewerWeightLabel(8)).toBe("观察期评审人");
  });

  test("builds a manifest from draft form input", () => {
    const manifest = buildSubmissionManifestFromDraft({
      title: "儿童友好社区阅读实验的负结果记录",
      abstract: "我们记录一项失败的儿童友好社区阅读试点，并保留其可复核的数据引用。",
      authorsText: "wallet:0xabc, orcid:0000-0000-0000-0001",
      orcid: "0000-0000-0000-0001",
      license: "CC-BY-4.0",
      contentUri: "ipfs://paper-v1",
      dataUrisText: "ipfs://dataset-a\nipfs://dataset-b",
      codeUrisText: "https://github.com/newchildren/protocol",
      parentVersion: "",
    });

    expect(manifest.authors).toEqual(["wallet:0xabc", "orcid:0000-0000-0000-0001"]);
    expect(manifest.data_uri).toEqual(["ipfs://dataset-a", "ipfs://dataset-b"]);
    expect(manifest.parent_version).toBeNull();
  });

  test("builds a version draft payload from revision form input", () => {
    const payload = buildVersionDraftPayload({
      submissionId: "17",
      parentVersionId: "2",
      title: "匿名协作失败实验记录（修订）",
      abstract: "补充复现实验日志、数据索引与更完整的修订摘要说明。",
      manifestUri: "ipfs://manifest-v3",
      contentUri: "ipfs://paper-v3",
      mirrorUri: "ar://paper-v3",
      dataUrisText: "ipfs://dataset-v3",
      codeUrisText: "https://github.com/newchildren/revision",
    });

    expect(payload.submissionId).toBe(17);
    expect(payload.parentVersionId).toBe(2);
    expect(payload.dataUris).toEqual(["ipfs://dataset-v3"]);
  });

  test("builds a review opening payload from form input", () => {
    const payload = buildReviewOpenDraftPayload({
      submissionId: "17",
      conflictStatement: "无利益冲突",
      dueInDays: "5",
      isSelfNominated: true,
    });

    expect(payload.submissionId).toBe(17);
    expect(payload.isSelfNominated).toBe(true);
    expect(payload.dueInDays).toBe(5);
  });

  test("builds a review submission payload from form input", () => {
    const payload = buildReviewSubmissionDraftPayload({
      reviewId: "3",
      methodologyScore: "4",
      noveltyScore: "3",
      rigorScore: "5",
      clarityScore: "4",
      recommendation: "revise",
      summary: "建议作者补充失败原因的定量分析。",
      reviewUri: "ipfs://review-3",
    });

    expect(payload.reviewId).toBe(3);
    expect(payload.recommendation).toBe(1);
    expect(payload.methodologyScore).toBe(4);
  });

  test("builds a dispute payload from form input", () => {
    const payload = buildDisputeDraftPayload({
      targetType: "review",
      targetId: "3",
      reason: "第 3 号评审存在误引。",
      evidenceUri: "ipfs://dispute-3",
    });

    expect(payload.targetType).toBe(2);
    expect(payload.targetId).toBe(3);
    expect(payload.evidenceUri).toBe("ipfs://dispute-3");
  });
});

describe("runtime config", () => {
  test("defaults to mock mode when chain addresses are missing", () => {
    const config = resolveRuntimeConfig({});
    expect(config.mode).toBe("mock");
    expect(config.isReadyForWrites).toBe(false);
    expect(config.isReadyForReads).toBe(false);
  });

  test("enters live mode for writes when addresses are configured", () => {
    const config = resolveRuntimeConfig({
      VITE_CHAIN_ID: "84532",
      VITE_JOURNAL_ADDRESS: "0x1111111111111111111111111111111111111111",
      VITE_SUBMISSION_ADDRESS: "0x2222222222222222222222222222222222222222",
      VITE_REVIEW_ADDRESS: "0x3333333333333333333333333333333333333333",
      VITE_REPUTATION_ADDRESS: "0x4444444444444444444444444444444444444444",
    });

    expect(config.mode).toBe("live");
    expect(config.isReadyForWrites).toBe(true);
    expect(config.isReadyForReads).toBe(false);
  });

  test("enables live reads when public rpc is configured", () => {
    const config = resolveRuntimeConfig({
      VITE_CHAIN_ID: "84532",
      VITE_PUBLIC_RPC_URL: "https://example-rpc.invalid",
      VITE_PROTOCOL_START_BLOCK: "120",
      VITE_JOURNAL_ADDRESS: "0x1111111111111111111111111111111111111111",
      VITE_SUBMISSION_ADDRESS: "0x2222222222222222222222222222222222222222",
      VITE_REVIEW_ADDRESS: "0x3333333333333333333333333333333333333333",
      VITE_REPUTATION_ADDRESS: "0x4444444444444444444444444444444444444444",
    });

    expect(config.isReadyForReads).toBe(true);
    expect(config.publicRpcUrl).toBe("https://example-rpc.invalid");
    expect(config.startBlock).toBe(120);
  });
});

describe("app shell", () => {
  test("renders the protocol dashboard with core calls to action", () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain("NewChildren");
    expect(markup).toContain(
      "We are the world. We are the children. We are the ones who make a brighter day. So, let&#x27;s start giving.",
    );
    expect(markup).toContain("提交稿件");
    expect(markup).toContain("发起公开评审");
    expect(markup).toContain("版本树");
    expect(markup).toContain("连接钱包");
    expect(markup).toContain("生成投稿清单");
    expect(markup).toContain("演示模式");
    expect(markup).toContain("修订与评审工作流");
    expect(markup).toContain("提交修订版本");
    expect(markup).toContain("发起评审邀请");
    expect(markup).toContain("提交评审结论");
    expect(markup).toContain("发起治理异议");
    expect(markup).toContain("去中心化存储上传");
    expect(markup).toContain("Pinata JWT");
    expect(markup).toContain("上传到 IPFS");
  });
});
