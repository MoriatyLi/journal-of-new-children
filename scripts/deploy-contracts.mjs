import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { ethers } from "ethers";

const root = process.cwd();
const artifactsDir = path.join(root, "artifacts", "contracts");
const deploymentsDir = path.join(root, "deployments");
const publicDeploymentsDir = path.join(root, "public", "deployments");

const rpcUrl = process.env.DEPLOY_RPC_URL;
const privateKey = process.env.DEPLOY_PRIVATE_KEY;
const networkName = process.env.DEPLOY_NETWORK_NAME ?? "base-sepolia";

if (!rpcUrl || !privateKey) {
  console.error("Missing DEPLOY_RPC_URL or DEPLOY_PRIVATE_KEY.");
  process.exit(1);
}

function compileContracts() {
  execFileSync(process.execPath, [path.join(root, "scripts", "compile-contracts.mjs")], {
    cwd: root,
    stdio: "inherit",
  });
}

async function loadArtifact(name) {
  const fullPath = path.join(artifactsDir, `${name}.json`);
  const raw = await fs.readFile(fullPath, "utf8");
  return JSON.parse(raw);
}

async function deploy() {
  compileContracts();

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  const journalArtifact = await loadArtifact("JournalRegistry");
  const reputationArtifact = await loadArtifact("ReputationSBT");
  const submissionArtifact = await loadArtifact("SubmissionRegistry");
  const reviewArtifact = await loadArtifact("ReviewRegistry");

  const JournalFactory = new ethers.ContractFactory(journalArtifact.abi, journalArtifact.bytecode, wallet);
  const journal = await JournalFactory.deploy("NewChildren", "NEWC", 5n, 5n, 8n);
  await journal.waitForDeployment();
  const journalReceipt = await journal.deploymentTransaction()?.wait();

  const ReputationFactory = new ethers.ContractFactory(reputationArtifact.abi, reputationArtifact.bytecode, wallet);
  const reputation = await ReputationFactory.deploy(await journal.getAddress());
  await reputation.waitForDeployment();
  const reputationReceipt = await reputation.deploymentTransaction()?.wait();

  const SubmissionFactory = new ethers.ContractFactory(submissionArtifact.abi, submissionArtifact.bytecode, wallet);
  const submission = await SubmissionFactory.deploy(await journal.getAddress());
  await submission.waitForDeployment();
  const submissionReceipt = await submission.deploymentTransaction()?.wait();

  const ReviewFactory = new ethers.ContractFactory(reviewArtifact.abi, reviewArtifact.bytecode, wallet);
  const review = await ReviewFactory.deploy(
    await journal.getAddress(),
    await submission.getAddress(),
    await reputation.getAddress(),
  );
  await review.waitForDeployment();
  const reviewReceipt = await review.deploymentTransaction()?.wait();

  await (
    await journal.configureProtocolModules(
      await submission.getAddress(),
      await review.getAddress(),
      await reputation.getAddress(),
    )
  ).wait();

  const network = await provider.getNetwork();
  const payload = {
    network: networkName,
    chainId: Number(network.chainId),
    deployer: wallet.address,
    deployedAt: new Date().toISOString(),
    startBlock: journalReceipt?.blockNumber ?? null,
    addresses: {
      journal: await journal.getAddress(),
      submission: await submission.getAddress(),
      review: await review.getAddress(),
      reputation: await reputation.getAddress(),
    },
    blocks: {
      journal: journalReceipt?.blockNumber ?? null,
      submission: submissionReceipt?.blockNumber ?? null,
      review: reviewReceipt?.blockNumber ?? null,
      reputation: reputationReceipt?.blockNumber ?? null,
    },
  };

  const serialized = JSON.stringify(payload, null, 2);

  await fs.mkdir(deploymentsDir, { recursive: true });
  await fs.mkdir(publicDeploymentsDir, { recursive: true });
  await fs.writeFile(path.join(deploymentsDir, `${networkName}.json`), serialized);
  await fs.writeFile(path.join(publicDeploymentsDir, `${networkName}.json`), serialized);

  console.log(serialized);
}

deploy().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
