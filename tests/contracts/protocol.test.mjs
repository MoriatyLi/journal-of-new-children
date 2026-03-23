import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import ganache from "ganache";
import { ethers } from "ethers";
import solc from "solc";

const projectRoot = process.cwd();
const contractsDir = path.join(projectRoot, "contracts");

async function compileContracts() {
  const contractFiles = [
    "JournalRegistry.sol",
    "SubmissionRegistry.sol",
    "ReviewRegistry.sol",
    "ReputationSBT.sol",
  ];

  const sources = Object.fromEntries(
    await Promise.all(
      contractFiles.map(async (fileName) => {
        const fullPath = path.join(contractsDir, fileName);
        const content = await fs.readFile(fullPath, "utf8");
        return [fileName, { content }];
      }),
    ),
  );

  const input = {
    language: "Solidity",
    sources,
    settings: {
      viaIR: true,
      evmVersion: "paris",
      optimizer: {
        enabled: true,
        runs: 200,
      },
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object"],
        },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = output.errors?.filter((entry) => entry.severity === "error") ?? [];

  assert.equal(errors.length, 0, errors.map((entry) => entry.formattedMessage).join("\n\n"));

  return {
    journal: output.contracts["JournalRegistry.sol"].JournalRegistry,
    submissions: output.contracts["SubmissionRegistry.sol"].SubmissionRegistry,
    reviews: output.contracts["ReviewRegistry.sol"].ReviewRegistry,
    reputation: output.contracts["ReputationSBT.sol"].ReputationSBT,
  };
}

async function deployProtocol() {
  const compiled = await compileContracts();
  const provider = new ethers.BrowserProvider(
    ganache.provider({
      chain: {
        hardfork: "shanghai",
      },
    }),
  );
  const admin = await provider.getSigner(0);
  const author = await provider.getSigner(1);
  const reviewerA = await provider.getSigner(2);
  const reviewerB = await provider.getSigner(3);

  const JournalFactory = new ethers.ContractFactory(compiled.journal.abi, compiled.journal.evm.bytecode.object, admin);
  const journal = await JournalFactory.deploy("Open Journal", "OJ", 2n, 2n, 2n);
  await journal.waitForDeployment();

  const ReputationFactory = new ethers.ContractFactory(compiled.reputation.abi, compiled.reputation.evm.bytecode.object, admin);
  const reputation = await ReputationFactory.deploy(await journal.getAddress());
  await reputation.waitForDeployment();

  const SubmissionFactory = new ethers.ContractFactory(compiled.submissions.abi, compiled.submissions.evm.bytecode.object, admin);
  const submissions = await SubmissionFactory.deploy(await journal.getAddress());
  await submissions.waitForDeployment();

  const ReviewFactory = new ethers.ContractFactory(compiled.reviews.abi, compiled.reviews.evm.bytecode.object, admin);
  const reviews = await ReviewFactory.deploy(
    await journal.getAddress(),
    await submissions.getAddress(),
    await reputation.getAddress(),
  );
  await reviews.waitForDeployment();

  await (await journal.configureProtocolModules(
    await submissions.getAddress(),
    await reviews.getAddress(),
    await reputation.getAddress(),
  )).wait();

  return { provider, admin, author, reviewerA, reviewerB, journal, submissions, reviews, reputation };
}

function withGasBuffer(estimate) {
  return (estimate * 12n) / 10n + 50_000n;
}

test("authors can create submissions and append immutable versions", async () => {
  const { author, submissions } = await deployProtocol();

  await (await submissions.connect(author).createSubmission(
    "Negative Result on Decoder Drift",
    "We report a failure mode for multilingual decoder distillation.",
    "ipfs://manifest-v1",
    "ipfs://paper-v1",
    "ar://paper-v1",
    "CC-BY-4.0",
    ["wallet:0xabc", "orcid:0000-0000-0000-0001"],
    [],
    [],
  )).wait();

  const submission = await submissions.getSubmission(1n);
  assert.equal(submission.author, await author.getAddress());
  assert.equal(submission.latestVersionId, 1n);
  assert.equal(submission.status, 1n);

  const versionOne = await submissions.getVersion(1n, 1n);
  assert.equal(versionOne.manifestURI, "ipfs://manifest-v1");
  assert.equal(versionOne.parentVersionId, 0n);

  const addVersionArgs = [
    1n,
    1n,
    "Negative Result on Decoder Drift (Revised)",
    "We add reproducibility notes and a better ablation appendix.",
    "ipfs://manifest-v2",
    "ipfs://paper-v2",
    "ar://paper-v2",
    ["ipfs://dataset-v2"],
    ["https://github.com/openjournal/repro"],
  ];
  const addVersionGas = await submissions.connect(author).addVersion.estimateGas(...addVersionArgs);

  await (await submissions.connect(author).addVersion(...addVersionArgs, {
    gasLimit: withGasBuffer(addVersionGas),
  })).wait();

  const submissionAfterUpdate = await submissions.getSubmission(1n);
  assert.equal(submissionAfterUpdate.latestVersionId, 2n);

  const versionTwo = await submissions.getVersion(1n, 2n);
  assert.equal(versionTwo.parentVersionId, 1n);

  const originalVersion = await submissions.getVersion(1n, 1n);
  assert.equal(originalVersion.contentURI, "ipfs://paper-v1");
});

test("reviewers with reputation can open and submit weighted reviews", async () => {
  const { admin, author, reviewerA, reputation, submissions, reviews } = await deployProtocol();

  await (await reputation.connect(admin).grantReputation(
    await reviewerA.getAddress(),
    1n,
    40n,
    "First-wave reviewer",
    "ipfs://reviewer-a",
  )).wait();

  await (await submissions.connect(author).createSubmission(
    "On-chain Peer Review Notes",
    "A short note about open review mechanics.",
    "ipfs://manifest-note",
    "ipfs://paper-note",
    "ar://paper-note",
    "CC-BY-4.0",
    ["wallet:0xdef"],
    [],
    [],
  )).wait();

  const openReviewArgs = [
    1n,
    await reviewerA.getAddress(),
    true,
    "No conflict declared.",
    Math.floor(Date.now() / 1000) + 86400,
  ];
  const openReviewGas = await reviews.connect(reviewerA).openReview.estimateGas(...openReviewArgs);

  await (await reviews.connect(reviewerA).openReview(...openReviewArgs, {
    gasLimit: withGasBuffer(openReviewGas),
  })).wait();

  const submitReviewArgs = [
    1n,
    5n,
    4n,
    5n,
    4n,
    1n,
    "Clear contribution, limited sample size, worthy of revision.",
    "ipfs://review-1",
  ];
  const submitReviewGas = await reviews.connect(reviewerA).submitReview.estimateGas(...submitReviewArgs);

  await (await reviews.connect(reviewerA).submitReview(...submitReviewArgs, {
    gasLimit: withGasBuffer(submitReviewGas),
  })).wait();

  const review = await reviews.getReview(1n);
  assert.equal(review.submissionId, 1n);
  assert.equal(review.reviewer, await reviewerA.getAddress());
  assert.equal(review.recommendation, 1n);
  assert.equal(review.reviewURI, "ipfs://review-1");

  const profile = await reputation.getProfile(await reviewerA.getAddress());
  assert.equal(profile.totalPoints, 40n);
  assert.equal(profile.reviewerWeight > 0n, true);
});

test("genesis council steps down once protocol activity thresholds are met", async () => {
  const { admin, author, reviewerA, reviewerB, journal, reputation, submissions, reviews } = await deployProtocol();

  await (await reputation.connect(admin).grantReputation(
    await reviewerA.getAddress(),
    1n,
    50n,
    "Seed reviewer A",
    "ipfs://seed-a",
  )).wait();

  await (await reputation.connect(admin).grantReputation(
    await reviewerB.getAddress(),
    1n,
    55n,
    "Seed reviewer B",
    "ipfs://seed-b",
  )).wait();

  await (await submissions.connect(author).createSubmission(
    "Protocol Warmup A",
    "Seed paper A",
    "ipfs://warmup-a",
    "ipfs://paper-a",
    "ar://paper-a",
    "CC-BY-4.0",
    ["wallet:0x111"],
    [],
    [],
  )).wait();

  await (await submissions.connect(author).createSubmission(
    "Protocol Warmup B",
    "Seed paper B",
    "ipfs://warmup-b",
    "ipfs://paper-b",
    "ar://paper-b",
    "CC-BY-4.0",
    ["wallet:0x222"],
    [],
    [],
  )).wait();

  const openReviewAArgs = [1n, await reviewerA.getAddress(), true, "none", Math.floor(Date.now() / 1000) + 86400];
  const openReviewAGas = await reviews.connect(reviewerA).openReview.estimateGas(...openReviewAArgs);
  await (await reviews.connect(reviewerA).openReview(...openReviewAArgs, {
    gasLimit: withGasBuffer(openReviewAGas),
  })).wait();

  const submitReviewAArgs = [1n, 5n, 5n, 4n, 4n, 1n, "Seed review A", "ipfs://seed-review-a"];
  const submitReviewAGas = await reviews.connect(reviewerA).submitReview.estimateGas(...submitReviewAArgs);
  await (await reviews.connect(reviewerA).submitReview(...submitReviewAArgs, {
    gasLimit: withGasBuffer(submitReviewAGas),
  })).wait();

  const openReviewBArgs = [2n, await reviewerB.getAddress(), true, "none", Math.floor(Date.now() / 1000) + 86400];
  const openReviewBGas = await reviews.connect(reviewerB).openReview.estimateGas(...openReviewBArgs);
  await (await reviews.connect(reviewerB).openReview(...openReviewBArgs, {
    gasLimit: withGasBuffer(openReviewBGas),
  })).wait();

  const submitReviewBArgs = [2n, 4n, 4n, 4n, 4n, 2n, "Seed review B", "ipfs://seed-review-b"];
  const submitReviewBGas = await reviews.connect(reviewerB).submitReview.estimateGas(...submitReviewBArgs);
  await (await reviews.connect(reviewerB).submitReview(...submitReviewBArgs, {
    gasLimit: withGasBuffer(submitReviewBGas),
  })).wait();

  assert.equal(await journal.genesisCouncilActive(), false);
});
