import { describe, expect, test } from "vitest";

import {
  buildReviewUploadArtifact,
  buildSubmissionContentArtifact,
  buildSubmissionManifestArtifact,
  toIpfsUri,
} from "@/lib/storage";

describe("storage helpers", () => {
  test("builds a markdown artifact for submission body upload", () => {
    const artifact = buildSubmissionContentArtifact(
      "NewChildren-negative-result",
      "# 标题\n\n这是正文。",
    );

    expect(artifact.fileName).toBe("NewChildren-negative-result.md");
    expect(artifact.mimeType).toBe("text/markdown");
    expect(artifact.contents).toContain("这是正文");
  });

  test("builds manifest json after content cid is known", () => {
    const artifact = buildSubmissionManifestArtifact(
      {
        title: "儿童友好社区阅读实验的负结果记录",
        abstract: "我们记录一项失败的儿童友好社区阅读试点，并保留其可复核的数据引用、代码线索与版本化说明。",
        authorsText: "wallet:0xabc",
        orcid: "",
        license: "CC-BY-4.0",
        manifestUri: "",
        contentUri: "ipfs://placeholder",
        mirrorUri: "ar://paper-v1",
        dataUrisText: "ipfs://dataset-a",
        codeUrisText: "https://github.com/newchildren/protocol",
        parentVersion: "",
      },
      "crime-manifest",
      "ipfs://bafycontentcid",
    );

    expect(artifact.fileName).toBe("crime-manifest.manifest.json");
    expect(artifact.manifest.content_uri).toBe("ipfs://bafycontentcid");
    expect(artifact.contents).toContain("\"content_uri\": \"ipfs://bafycontentcid\"");
  });

  test("builds review markdown artifact for long-form review body", () => {
    const artifact = buildReviewUploadArtifact("review-3", "## 评审正文\n\n建议补充定量对照。");

    expect(artifact.fileName).toBe("review-3.review.md");
    expect(artifact.contents).toContain("建议补充定量对照");
  });

  test("formats bare cids as ipfs uris", () => {
    expect(toIpfsUri("bafybeigdyrzt")).toBe("ipfs://bafybeigdyrzt");
    expect(toIpfsUri("ipfs://bafybeigdyrzt")).toBe("ipfs://bafybeigdyrzt");
  });
});
