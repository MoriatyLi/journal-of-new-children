import { buildSubmissionManifestFromDraft, type SubmissionDraftInput } from "@/lib/protocol";

export type UploadArtifact = {
  fileName: string;
  mimeType: string;
  contents: string;
};

export type SubmissionManifestArtifact = UploadArtifact & {
  manifest: ReturnType<typeof buildSubmissionManifestFromDraft>;
};

export type PinataSession = {
  jwt: string;
  apiBaseUrl?: string;
  gatewayBaseUrl?: string;
};

function normalizeStem(stem: string): string {
  return stem.trim().replace(/\s+/g, "-").replace(/[^\w-]/g, "").replace(/-+/g, "-");
}

export function toIpfsUri(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith("ipfs://") ? trimmed : `ipfs://${trimmed}`;
}

export function buildSubmissionContentArtifact(fileStem: string, manuscriptBody: string): UploadArtifact {
  const stem = normalizeStem(fileStem) || "newchildren-submission";

  return {
    fileName: `${stem}.md`,
    mimeType: "text/markdown",
    contents: manuscriptBody.trim(),
  };
}

export function buildSubmissionManifestArtifact(
  draft: SubmissionDraftInput,
  fileStem: string,
  contentUri: string,
): SubmissionManifestArtifact {
  const stem = normalizeStem(fileStem) || "newchildren-submission";
  const manifest = buildSubmissionManifestFromDraft({
    ...draft,
    contentUri,
  });
  const contents = JSON.stringify(manifest, null, 2);

  return {
    fileName: `${stem}.manifest.json`,
    mimeType: "application/json",
    contents,
    manifest,
  };
}

export function buildReviewUploadArtifact(fileStem: string, reviewBody: string): UploadArtifact {
  const stem = normalizeStem(fileStem) || "newchildren-review";

  return {
    fileName: `${stem}.review.md`,
    mimeType: "text/markdown",
    contents: reviewBody.trim(),
  };
}

async function uploadArtifactToPinata(
  session: PinataSession,
  artifact: UploadArtifact,
): Promise<{ cid: string; uri: string; gatewayUrl: string }> {
  if (!session.jwt.trim()) {
    throw new Error("请先提供 Pinata JWT。");
  }

  const formData = new FormData();
  const blob = new Blob([artifact.contents], { type: artifact.mimeType });
  formData.append("file", blob, artifact.fileName);

  const response = await fetch(
    `${session.apiBaseUrl ?? "https://api.pinata.cloud"}/pinning/pinFileToIPFS`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.jwt.trim()}`,
      },
      body: formData,
    },
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`IPFS 上传失败：${details || response.statusText}`);
  }

  const payload = (await response.json()) as { IpfsHash?: string };
  const cid = payload.IpfsHash?.trim();

  if (!cid) {
    throw new Error("Pinata 没有返回可用的 CID。");
  }

  const uri = toIpfsUri(cid);
  const gatewayBase = session.gatewayBaseUrl ?? "https://gateway.pinata.cloud/ipfs";

  return {
    cid,
    uri,
    gatewayUrl: `${gatewayBase.replace(/\/$/, "")}/${cid}`,
  };
}

export async function uploadSubmissionBundleToPinata(
  session: PinataSession,
  draft: SubmissionDraftInput,
  manuscriptBody: string,
  fileStem: string,
): Promise<{
  contentUri: string;
  manifestUri: string;
  contentGatewayUrl: string;
  manifestGatewayUrl: string;
}> {
  const contentArtifact = buildSubmissionContentArtifact(fileStem, manuscriptBody);
  const contentUpload = await uploadArtifactToPinata(session, contentArtifact);
  const manifestArtifact = buildSubmissionManifestArtifact(draft, fileStem, contentUpload.uri);
  const manifestUpload = await uploadArtifactToPinata(session, manifestArtifact);

  return {
    contentUri: contentUpload.uri,
    manifestUri: manifestUpload.uri,
    contentGatewayUrl: contentUpload.gatewayUrl,
    manifestGatewayUrl: manifestUpload.gatewayUrl,
  };
}

export async function uploadReviewArtifactToPinata(
  session: PinataSession,
  reviewBody: string,
  fileStem: string,
): Promise<{ reviewUri: string; reviewGatewayUrl: string }> {
  const artifact = buildReviewUploadArtifact(fileStem, reviewBody);
  const upload = await uploadArtifactToPinata(session, artifact);

  return {
    reviewUri: upload.uri,
    reviewGatewayUrl: upload.gatewayUrl,
  };
}
