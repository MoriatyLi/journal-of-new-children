import { describe, expect, test } from "vitest";

import { loadLiveProtocolSnapshot } from "@/lib/reader";
import { resolveRuntimeConfig } from "@/lib/runtime";

describe("live protocol snapshot reader", () => {
  test("requires a public rpc url before loading live data", async () => {
    const config = resolveRuntimeConfig({
      VITE_JOURNAL_ADDRESS: "0x1111111111111111111111111111111111111111",
      VITE_SUBMISSION_ADDRESS: "0x2222222222222222222222222222222222222222",
      VITE_REVIEW_ADDRESS: "0x3333333333333333333333333333333333333333",
      VITE_REPUTATION_ADDRESS: "0x4444444444444444444444444444444444444444",
    });

    await expect(loadLiveProtocolSnapshot(config)).rejects.toThrow("公共 RPC");
  });

  test("builds a dashboard snapshot from live contract readers", async () => {
    const config = resolveRuntimeConfig({
      VITE_PUBLIC_RPC_URL: "https://example-rpc.invalid",
      VITE_PROTOCOL_START_BLOCK: "90",
      VITE_JOURNAL_ADDRESS: "0x1111111111111111111111111111111111111111",
      VITE_SUBMISSION_ADDRESS: "0x2222222222222222222222222222222222222222",
      VITE_REVIEW_ADDRESS: "0x3333333333333333333333333333333333333333",
      VITE_REPUTATION_ADDRESS: "0x4444444444444444444444444444444444444444",
    });

    const timestampByBlock = new Map<number, number>([
      [101, 1710028800],
      [102, 1710115200],
      [103, 1710201600],
      [104, 1710288000],
    ]);

    const snapshot = await loadLiveProtocolSnapshot(config, {
      contracts: {
        journal: {
          journalName: async () => "NewChildren",
          activeReviewerCount: async () => 2n,
          activeSubmissionCount: async () => 2n,
          completedReviewCount: async () => 3n,
          genesisCouncilActive: async () => false,
        },
        submissions: {
          submissionCount: async () => 2n,
          getSubmission: async (submissionId: bigint) => {
            if (submissionId === 2n) {
              return {
                id: 2n,
                author: "0xB000000000000000000000000000000000000002",
                latestVersionId: 2n,
                status: 2n,
                createdAt: 1710115200n,
                updatedAt: 1710201600n,
              };
            }

            return {
              id: 1n,
              author: "0xA000000000000000000000000000000000000001",
              latestVersionId: 1n,
              status: 3n,
              createdAt: 1710028800n,
              updatedAt: 1710028800n,
            };
          },
          getVersion: async (submissionId: bigint, versionId: bigint) => {
            if (submissionId === 2n && versionId === 1n) {
              return {
                versionId: 1n,
                parentVersionId: 0n,
                title: "匿名协作失败实验记录",
                abstractText: "记录一次失败的犯罪网络识别实验，并公开初版结论。",
                manifestURI: "ipfs://manifest-2-v1",
                contentURI: "ipfs://paper-2-v1",
                mirrorURI: "ar://paper-2-v1",
                licenseCode: "CC-BY-4.0",
                authorRefs: ["wallet:0xb"],
                dataURIs: ["ipfs://dataset-2-v1"],
                codeURIs: ["https://github.com/crimenet/paper-2-v1"],
                createdAt: 1710115200n,
              };
            }

            if (submissionId === 2n && versionId === 2n) {
              return {
                versionId: 2n,
                parentVersionId: 1n,
                title: "匿名协作失败实验记录（修订）",
                abstractText: "补充复现实验日志与代码链接后的修订版本。",
                manifestURI: "ipfs://manifest-2-v2",
                contentURI: "ipfs://paper-2-v2",
                mirrorURI: "ar://paper-2-v2",
                licenseCode: "CC-BY-4.0",
                authorRefs: ["wallet:0xb"],
                dataURIs: ["ipfs://dataset-2-v2"],
                codeURIs: ["https://github.com/crimenet/paper-2-v2"],
                createdAt: 1710201600n,
              };
            }

            return {
              versionId: 1n,
              parentVersionId: 0n,
              title: "开放评审劳动短评",
              abstractText: "讨论开放评审劳动的记录与署名边界。",
              manifestURI: "ipfs://manifest-1-v1",
              contentURI: "ipfs://paper-1-v1",
              mirrorURI: "ar://paper-1-v1",
              licenseCode: "CC-BY-4.0",
              authorRefs: ["wallet:0xa"],
              dataURIs: [],
              codeURIs: [],
              createdAt: 1710028800n,
            };
          },
        },
        reviews: {
          reviewCount: async () => 3n,
          disputeCount: async () => 1n,
          getReview: async (reviewId: bigint) => {
            if (reviewId === 3n) {
              return {
                id: 3n,
                submissionId: 2n,
                reviewer: "0xC000000000000000000000000000000000000003",
                isSelfNominated: true,
                conflictStatement: "none",
                openedAt: 1710115200n,
                dueAt: 1710374400n,
                submitted: true,
                methodologyScore: 4n,
                noveltyScore: 4n,
                rigorScore: 5n,
                clarityScore: 4n,
                recommendation: 1n,
                summary: "建议返修后录用，链上证据很完整。",
                reviewURI: "ipfs://review-3",
                submittedAt: 1710288000n,
              };
            }

            if (reviewId === 2n) {
              return {
                id: 2n,
                submissionId: 1n,
                reviewer: "0xD000000000000000000000000000000000000004",
                isSelfNominated: false,
                conflictStatement: "none",
                openedAt: 1710028800n,
                dueAt: 1710288000n,
                submitted: true,
                methodologyScore: 5n,
                noveltyScore: 3n,
                rigorScore: 4n,
                clarityScore: 4n,
                recommendation: 0n,
                summary: "这篇短评可以直接录用。",
                reviewURI: "ipfs://review-2",
                submittedAt: 1710201600n,
              };
            }

            return {
              id: 1n,
              submissionId: 2n,
              reviewer: "0xE000000000000000000000000000000000000005",
              isSelfNominated: true,
              conflictStatement: "none",
              openedAt: 1710115200n,
              dueAt: 1710374400n,
              submitted: false,
              methodologyScore: 0n,
              noveltyScore: 0n,
              rigorScore: 0n,
              clarityScore: 0n,
              recommendation: 0n,
              summary: "",
              reviewURI: "",
              submittedAt: 0n,
            };
          },
          getDispute: async () => ({
            id: 1n,
            targetType: 2n,
            targetId: 3n,
            opener: "0xF000000000000000000000000000000000000006",
            reason: "评审总结存在误引",
            evidenceURI: "ipfs://dispute-1",
            resolved: true,
            upheld: true,
            resolutionURI: "ipfs://resolution-1",
          }),
          filters: {
            DecisionRecorded: () => "decision-filter",
          },
          queryFilter: async (filter: unknown) => {
            if (filter === "decision-filter") {
              return [
                {
                  args: {
                    submissionId: 1n,
                    decision: 3n,
                    rationaleURI: "ipfs://decision-1",
                  },
                  blockNumber: 103,
                },
              ];
            }

            return [];
          },
        },
        reputation: {
          getProfile: async (address: string) => {
            if (address === "0xC000000000000000000000000000000000000003") {
              return {
                totalPoints: 42n,
                reviewerWeight: 42n,
                authorWeight: 0n,
                editorWeight: 0n,
                metadataURI: "ipfs://reviewer-c",
              };
            }

            return {
              totalPoints: 12n,
              reviewerWeight: 12n,
              authorWeight: 0n,
              editorWeight: 0n,
              metadataURI: "",
            };
          },
          filters: {
            ReputationGranted: () => "reputation-filter",
          },
          queryFilter: async (filter: unknown) => {
            if (filter === "reputation-filter") {
              return [
                {
                  args: {
                    subject: "0xC000000000000000000000000000000000000003",
                    role: 1n,
                    points: 12n,
                    totalPoints: 42n,
                    reason: "提交评审",
                    metadataURI: "ipfs://reviewer-c",
                  },
                  blockNumber: 104,
                },
              ];
            }

            return [];
          },
        },
      },
      getBlock: async (blockNumber: number) => {
        const timestamp = timestampByBlock.get(blockNumber);
        return timestamp ? { timestamp } : null;
      },
    });

    expect(snapshot.protocolMetrics[0].value).toBe("2");
    expect(snapshot.protocolMetrics[1].value).toBe("3");
    expect(snapshot.protocolMetrics[2].value).toBe("已休眠");

    expect(snapshot.submissions).toHaveLength(2);
    expect(snapshot.submissions[0].id).toBe(2);
    expect(snapshot.submissions[0].status).toBe("under_review");
    expect(snapshot.submissions[0].versions[1].parentVersion).toBe(1);

    expect(snapshot.reviews).toHaveLength(2);
    expect(snapshot.reviews[0].recommendation).toBe("revise");
    expect(snapshot.reviews[0].weight).toBe(42);

    expect(snapshot.reviewers[0].address).toBe("0xC000000000000000000000000000000000000003");
    expect(snapshot.reviewers[0].completedReviews).toBe(1);

    expect(snapshot.decisions[0].label).toBe("accepted");
    expect(snapshot.decisions[0].recordedAt).toBe("2024-03-12");

    expect(snapshot.reputationLedger[0].delta).toBe(12);
    expect(snapshot.reputationLedger[0].role).toBe("reviewer");

    expect(snapshot.disputes[0].title).toContain("误引");
    expect(snapshot.disputes[0].status).toBe("resolved");
    expect(snapshot.disputes[0].targetType).toBe("review");
  });
});
