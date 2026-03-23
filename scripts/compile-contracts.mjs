import fs from "node:fs/promises";
import path from "node:path";

import solc from "solc";

const root = process.cwd();
const contractsDir = path.join(root, "contracts");
const artifactsDir = path.join(root, "artifacts", "contracts");

const contractFiles = [
  "JournalRegistry.sol",
  "SubmissionRegistry.sol",
  "ReviewRegistry.sol",
  "ReputationSBT.sol",
];

async function compile() {
  const sources = Object.fromEntries(
    await Promise.all(
      contractFiles.map(async (fileName) => {
        const content = await fs.readFile(path.join(contractsDir, fileName), "utf8");
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

  if (errors.length > 0) {
    throw new Error(errors.map((entry) => entry.formattedMessage).join("\n\n"));
  }

  await fs.mkdir(artifactsDir, { recursive: true });

  for (const [fileName, contracts] of Object.entries(output.contracts)) {
    for (const [contractName, artifact] of Object.entries(contracts)) {
      const payload = {
        contractName,
        sourceName: fileName,
        abi: artifact.abi,
        bytecode: artifact.evm.bytecode.object,
      };

      await fs.writeFile(
        path.join(artifactsDir, `${contractName}.json`),
        JSON.stringify(payload, null, 2),
      );
    }
  }
}

compile().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
