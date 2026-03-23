import {
  startTransition,
  useDeferredValue,
  useEffect,
  useState,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
} from "react";

import { mockProtocolSnapshot } from "@/lib/mockData";
import {
  buildReviewerWeightLabel,
  buildSubmissionManifestFromDraft,
  type DisputeDraftInput,
  formatDecisionLabel,
  formatDisputeStatus,
  formatRecommendation,
  formatRole,
  formatStatus,
  type ProtocolDashboardSnapshot,
  type ReviewOpenDraftInput,
  type ReviewSubmissionDraftInput,
  type SubmissionDraftInput,
  type VersionDraftInput,
} from "@/lib/protocol";
import { runtimeConfig as envRuntimeConfig, type RuntimeConfig } from "@/lib/runtime";

const initialDraft: SubmissionDraftInput = {
  title: "儿童友好社区阅读实验的负结果记录",
  abstract:
    "我们记录一项面向儿童友好社区的阅读试点失败案例，并保留可复核的数据引用、访谈摘录与版本化说明。",
  authorsText: "wallet:0xabc, orcid:0000-0000-0000-0001",
  orcid: "0000-0000-0000-0001",
  license: "CC-BY-4.0",
  manifestUri: "",
  contentUri: "ipfs://paper-v1",
  mirrorUri: "ar://paper-v1",
  dataUrisText: "ipfs://dataset-a",
  codeUrisText: "https://github.com/newchildren/protocol",
  parentVersion: "",
};

const initialWalletState = {
  hasProvider: false,
  connected: false,
  account: null,
  chainId: null,
};

const initialVersionDraft: VersionDraftInput = {
  submissionId: "17",
  parentVersionId: "2",
  title: "儿童友好社区阅读实验的负结果记录（修订版）",
  abstract: "补充试点日志、受访者反馈、版本差异说明与复现实验摘要。",
  manifestUri: "ipfs://manifest-v3",
  contentUri: "ipfs://paper-v3",
  mirrorUri: "ar://paper-v3",
  dataUrisText: "ipfs://dataset-v3",
  codeUrisText: "https://github.com/newchildren/revision",
};

const initialReviewOpenDraft: ReviewOpenDraftInput = {
  submissionId: "17",
  conflictStatement: "无利益冲突。",
  dueInDays: "5",
  isSelfNominated: true,
};

const initialReviewSubmissionDraft: ReviewSubmissionDraftInput = {
  reviewId: "3",
  methodologyScore: "4",
  noveltyScore: "4",
  rigorScore: "5",
  clarityScore: "4",
  recommendation: "revise",
  summary: "建议作者补充对失败模式的定量归因，并保留当前公开证据链。",
  reviewUri: "ipfs://review-3",
};

const initialDisputeDraft: DisputeDraftInput = {
  targetType: "review",
  targetId: "3",
  reason: "第 3 号评审存在误引，需要发起更正争议。",
  evidenceUri: "ipfs://dispute-3",
};

const initialStorageDraft = {
  target: "submission" as "submission" | "review",
  fileStem: "newchildren-open-journal",
  body: "# NewChildren 投稿正文\n\n请在这里撰写正文，再上传到 IPFS。",
  pinataJwt: "",
};

type DraftChangeEvent = ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "发生了未知错误。";
}

function createDraftChangeHandler<T extends Record<string, string | boolean>>(
  setter: Dispatch<SetStateAction<T>>,
) {
  return (event: DraftChangeEvent) => {
    const target = event.currentTarget;
    const value =
      target instanceof HTMLInputElement && target.type === "checkbox"
        ? target.checked
        : target.value;

    setter((current) => ({ ...current, [target.name]: value } as T));
  };
}

export function App() {
  const [activeConfig, setActiveConfig] = useState<RuntimeConfig>(envRuntimeConfig);
  const [wallet, setWallet] = useState(() => initialWalletState);
  const [dashboard, setDashboard] = useState<ProtocolDashboardSnapshot>(mockProtocolSnapshot);
  const [draft, setDraft] = useState<SubmissionDraftInput>(initialDraft);
  const [versionDraft, setVersionDraft] = useState<VersionDraftInput>(initialVersionDraft);
  const [reviewOpenDraft, setReviewOpenDraft] =
    useState<ReviewOpenDraftInput>(initialReviewOpenDraft);
  const [reviewSubmissionDraft, setReviewSubmissionDraft] =
    useState<ReviewSubmissionDraftInput>(initialReviewSubmissionDraft);
  const [disputeDraft, setDisputeDraft] = useState<DisputeDraftInput>(initialDisputeDraft);
  const [storageDraft, setStorageDraft] = useState(initialStorageDraft);
  const [walletMessage, setWalletMessage] = useState("尚未连接钱包。");
  const [configNotice, setConfigNotice] = useState<string | null>(null);
  const [readMessage, setReadMessage] = useState(() => {
    if (envRuntimeConfig.isReadyForReads) {
      return `正在同步 ${envRuntimeConfig.chainName} 的链上快照。`;
    }

    if (envRuntimeConfig.mode === "live") {
      return "已开启真实写入，但尚未配置公共 RPC，浏览区先展示示例数据。";
    }

    return "演示模式：当前展示示例数据。";
  });
  const [submitMessage, setSubmitMessage] = useState(
    envRuntimeConfig.isReadyForWrites
      ? "已配置链上写入环境，可在连接钱包后提交交易。"
      : "当前为演示模式：可以生成 manifest，但不会真的把稿件写入链上。",
  );
  const [txHash, setTxHash] = useState<string | null>(null);
  const [versionMessage, setVersionMessage] = useState("为已有稿件追加修订版本，旧版本将永久保留。");
  const [versionTxHash, setVersionTxHash] = useState<string | null>(null);
  const [reviewOpenMessage, setReviewOpenMessage] = useState(
    "有评审权重的钱包可以在这里自荐或发起公开评审。",
  );
  const [reviewOpenTxHash, setReviewOpenTxHash] = useState<string | null>(null);
  const [reviewSubmitMessage, setReviewSubmitMessage] = useState(
    "提交评审会把结论、评分和长评链接写入链上。",
  );
  const [reviewSubmitTxHash, setReviewSubmitTxHash] = useState<string | null>(null);
  const [disputeMessage, setDisputeMessage] = useState(
    "治理异议会保留证据 URI，并与原始记录一起公开。",
  );
  const [disputeTxHash, setDisputeTxHash] = useState<string | null>(null);
  const [storageMessage, setStorageMessage] = useState(
    "可使用 Pinata JWT 把正文上传到 IPFS，并自动回填稿件或评审所需的 URI。",
  );
  const [storageLinks, setStorageLinks] = useState<string[]>([]);

  const deferredDraft = useDeferredValue(draft);
  const leadSubmission = dashboard.submissions[0] ?? null;
  const wrongChain =
    wallet.connected && wallet.chainId !== null && wallet.chainId !== activeConfig.chainId;
  const writesBlocked = !activeConfig.isReadyForWrites || !wallet.connected || wrongChain;

  let manifestPreview = null;
  let manifestError: string | null = null;

  try {
    manifestPreview = buildSubmissionManifestFromDraft(deferredDraft);
  } catch (error) {
    manifestError = getErrorMessage(error);
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (window.ethereum) {
      setWallet({
        hasProvider: true,
        connected: false,
        account: null,
        chainId: null,
      });
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const { applyDeploymentToRuntimeConfig, loadDeploymentSnapshot } = await import(
          "@/lib/deployments"
        );
        const deployment = await loadDeploymentSnapshot(envRuntimeConfig.chainId);

        if (!deployment || cancelled) {
          return;
        }

        const mergedConfig = applyDeploymentToRuntimeConfig(envRuntimeConfig, deployment);

        if (cancelled) {
          return;
        }

        setActiveConfig(mergedConfig);
        setConfigNotice(`已自动载入 ${deployment.network} 的部署配置。`);
      } catch {
        // Deployment auto-load is opportunistic; keep env config when absent.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeConfig.isReadyForReads) {
      setReadMessage(
        activeConfig.mode === "live"
          ? "已开启真实写入，但尚未配置公共 RPC，浏览区先展示示例数据。"
          : "演示模式：当前展示示例数据。",
      );
      return;
    }

    let cancelled = false;

    setReadMessage(`正在同步 ${activeConfig.chainName} 的链上快照。`);

    void (async () => {
      try {
        const { loadLiveProtocolSnapshot } = await import("@/lib/reader");
        const nextDashboard = await loadLiveProtocolSnapshot(activeConfig);

        if (cancelled) {
          return;
        }

        startTransition(() => {
          setDashboard(nextDashboard);
        });
        setReadMessage(`链上快照已同步，当前展示 ${activeConfig.chainName} 的真实数据。`);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setReadMessage(`链上读取失败，已回退到示例数据：${getErrorMessage(error)}`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeConfig]);

  useEffect(() => {
    setSubmitMessage(
      activeConfig.isReadyForWrites
        ? "已配置链上写入环境，可在连接钱包后提交交易。"
        : "当前为演示模式：可以生成 manifest，但不会真的把稿件写入链上。",
    );
  }, [activeConfig]);

  const handleDraftChange = createDraftChangeHandler(setDraft);
  const handleVersionDraftChange = createDraftChangeHandler(setVersionDraft);
  const handleReviewOpenDraftChange = createDraftChangeHandler(setReviewOpenDraft);
  const handleReviewSubmissionDraftChange = createDraftChangeHandler(setReviewSubmissionDraft);
  const handleDisputeDraftChange = createDraftChangeHandler(setDisputeDraft);
  const handleStorageDraftChange = createDraftChangeHandler(setStorageDraft);

  async function handleConnectWallet() {
    try {
      const { connectWallet } = await import("@/lib/chain");
      const nextWallet = await connectWallet();
      setWallet(nextWallet);
      setWalletMessage(
        nextWallet.connected && nextWallet.account
          ? `已连接 ${nextWallet.account}`
          : "钱包已检测到，但当前没有授权账户。",
      );
    } catch (error) {
      setWalletMessage(getErrorMessage(error));
    }
  }

  function handleDownloadManifest() {
    if (!manifestPreview || typeof window === "undefined") {
      setSubmitMessage("当前稿件信息尚未通过校验，暂时不能导出 manifest。");
      return;
    }

    const blob = new Blob([JSON.stringify(manifestPreview, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "newchildren-manifest.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setSubmitMessage("manifest 已导出，可以上传到 IPFS 后回填 URI。");
  }

  async function handleSubmitOnchain() {
    try {
      const { submitSubmissionTransaction } = await import("@/lib/chain");
      const result = await submitSubmissionTransaction(activeConfig, draft);
      setTxHash(result.hash);
      setSubmitMessage("投稿交易已发送，等待链上确认后即可在快照中看到。");
    } catch (error) {
      setSubmitMessage(getErrorMessage(error));
    }
  }

  async function handleAddVersionOnchain() {
    try {
      const { submitSubmissionVersionTransaction } = await import("@/lib/chain");
      const result = await submitSubmissionVersionTransaction(activeConfig, versionDraft);
      setVersionTxHash(result.hash);
      setVersionMessage("修订版本交易已发送，链上确认后会出现在版本树里。");
    } catch (error) {
      setVersionMessage(getErrorMessage(error));
    }
  }

  async function handleOpenReviewOnchain() {
    try {
      const { openReviewTransaction } = await import("@/lib/chain");
      const result = await openReviewTransaction(activeConfig, reviewOpenDraft);
      setReviewOpenTxHash(result.hash);
      setReviewOpenMessage("评审邀请交易已发送，确认后会进入公开评审区。");
    } catch (error) {
      setReviewOpenMessage(getErrorMessage(error));
    }
  }

  async function handleSubmitReviewOnchain() {
    try {
      const { submitReviewTransaction } = await import("@/lib/chain");
      const result = await submitReviewTransaction(activeConfig, reviewSubmissionDraft);
      setReviewSubmitTxHash(result.hash);
      setReviewSubmitMessage("评审提交交易已发送，确认后会计入声誉与公开记录。");
    } catch (error) {
      setReviewSubmitMessage(getErrorMessage(error));
    }
  }

  async function handleOpenDisputeOnchain() {
    try {
      const { openDisputeTransaction } = await import("@/lib/chain");
      const result = await openDisputeTransaction(activeConfig, disputeDraft);
      setDisputeTxHash(result.hash);
      setDisputeMessage("争议交易已发送，确认后会出现在治理面板。");
    } catch (error) {
      setDisputeMessage(getErrorMessage(error));
    }
  }

  async function handleUploadToIpfs() {
    try {
      setStorageLinks([]);
      const {
        uploadReviewArtifactToPinata,
        uploadSubmissionBundleToPinata,
      } = await import("@/lib/storage");

      if (storageDraft.target === "submission") {
        const result = await uploadSubmissionBundleToPinata(
          { jwt: storageDraft.pinataJwt },
          draft,
          storageDraft.body,
          storageDraft.fileStem,
        );

        setDraft((current) => ({
          ...current,
          contentUri: result.contentUri,
          manifestUri: result.manifestUri,
        }));
        setStorageMessage("正文与 manifest 已上传到 IPFS，投稿表单已自动回填 URI。");
        setStorageLinks([result.contentGatewayUrl, result.manifestGatewayUrl]);
        setSubmitMessage("IPFS 上传完成，已回填投稿 URI，可以继续发起链上交易。");
        return;
      }

      const result = await uploadReviewArtifactToPinata(
        { jwt: storageDraft.pinataJwt },
        storageDraft.body,
        storageDraft.fileStem,
      );

      setReviewSubmissionDraft((current) => ({
        ...current,
        reviewUri: result.reviewUri,
      }));
      setStorageMessage("评审长文已上传到 IPFS，评审表单已自动回填 reviewUri。");
      setStorageLinks([result.reviewGatewayUrl]);
      setReviewSubmitMessage("长评上传完成，评审表单已回填 reviewUri。");
    } catch (error) {
      setStorageMessage(getErrorMessage(error));
    }
  }

  return (
    <div className="shell">
      <div className="grain" aria-hidden="true" />
      <header className="hero">
        <div className="hero__eyebrow">NewChildren</div>
        <div className="hero__grid">
          <section className="hero__copy">
            <p className="hero__kicker">Open journal for kinder evidence and brighter futures.</p>
            <p className="hero__mission">
              We are the world. We are the children. We are the ones who make a brighter day. So,
              let's start giving.
            </p>
            <h1>
              NewChildren 把投稿、公开评审、版本演进与治理记录，
              编织成一条更透明、更温柔的链上知识档案。
            </h1>
            <p className="hero__lede">
              摘要、录用决定、作者归属和声誉记录全部可链上验证；正文、数据集与长评审
              存放在 IPFS 与 Arweave，让值得被看见的研究不再轻易被掩埋。
            </p>

            <div className="hero__actions">
              <a className="button button--primary" href="#composer">
                提交稿件
              </a>
              <a className="button button--ghost" href="#review">
                发起公开评审
              </a>
            </div>
          </section>

          <aside className="hero__panel">
            <div className="hero__panel-label">
              {activeConfig.mode === "live" ? "真实模式" : "演示模式"}
            </div>
            <h2>
              {activeConfig.mode === "live"
                ? `正在连接 ${activeConfig.chainName}`
                : "NewChildren 预览站点已就绪"}
            </h2>
            <p>
              {activeConfig.mode === "live"
                ? activeConfig.isReadyForReads
                  ? "已检测到完整的合约地址与公共 RPC 配置，读者现在可以直接查看真实链上快照，并尝试完成投稿与评审交易。"
                  : "已检测到完整的合约地址配置，可以连接钱包并尝试提交真实交易。若要让读者直接浏览链上内容，还需要补上公共 RPC。"
                : "当前仍是本地演示态，但你已经可以整理投稿、预览数据结构，并把整条工作流打磨成更适合公开展示的版本。"}
            </p>
            <p className="hero__sync">{readMessage}</p>
            {configNotice ? <p className="hero__notice">{configNotice}</p> : null}
            <dl className="hero__facts">
              <div>
                <dt>状态</dt>
                <dd>{activeConfig.mode === "live" ? "可写入" : "演示模式"}</dd>
              </div>
              <div>
                <dt>目标链</dt>
                <dd>{activeConfig.chainName}</dd>
              </div>
              <div>
                <dt>缺失项</dt>
                <dd>
                  {activeConfig.missing.length > 0
                    ? activeConfig.missing.join(", ")
                    : "已配置完成"}
                </dd>
              </div>
              <div>
                <dt>数据源</dt>
                <dd>{activeConfig.isReadyForReads ? "链上实时快照" : "示例数据"}</dd>
              </div>
            </dl>
          </aside>
        </div>
      </header>

      <main className="main-grid">
        <section className="metrics">
          {dashboard.protocolMetrics.map((metric) => (
            <article className="metric-card" key={metric.label}>
              <p>{metric.label}</p>
              <strong>{metric.value}</strong>
              <span>{metric.detail}</span>
            </article>
          ))}
        </section>

        <section className="section-card section-card--wallet">
          <div className="section-card__header">
            <span className="section-card__index">00</span>
            <h2>连接钱包</h2>
          </div>
          <div className="wallet-panel">
            <div>
              <p className="wallet-panel__status">{walletMessage}</p>
              <p className="wallet-panel__hint">
                推荐使用 MetaMask 连接 {activeConfig.chainName}，这样就能直接调用
                SubmissionRegistry 的 `createSubmission`。
              </p>
            </div>
            <div className="wallet-panel__actions">
              <button className="button button--primary" type="button" onClick={handleConnectWallet}>
                连接钱包
              </button>
              <span className="wallet-panel__meta">
                {wallet.connected ? `链 ID: ${wallet.chainId ?? "未知"}` : "尚未授权"}
              </span>
            </div>
          </div>
          {wrongChain ? (
            <p className="inline-warning">
              当前钱包链 ID 为 {wallet.chainId}，与配置目标链 {activeConfig.chainId} 不一致，
              请切换后再提交交易。
            </p>
          ) : null}
        </section>

        <section className="section-card section-card--composer" id="composer">
          <div className="section-card__header">
            <span className="section-card__index">01</span>
            <h2>投稿工作台</h2>
          </div>
          <div className="composer-grid">
            <form className="composer-form" onSubmit={(event) => event.preventDefault()}>
              <label>
                <span>标题</span>
                <input name="title" value={draft.title} onChange={handleDraftChange} />
              </label>
              <label>
                <span>摘要</span>
                <textarea
                  name="abstract"
                  rows={4}
                  value={draft.abstract}
                  onChange={handleDraftChange}
                />
              </label>
              <label>
                <span>作者标识</span>
                <textarea
                  name="authorsText"
                  rows={2}
                  value={draft.authorsText}
                  onChange={handleDraftChange}
                />
              </label>
              <label>
                <span>ORCID</span>
                <input name="orcid" value={draft.orcid} onChange={handleDraftChange} />
              </label>
              <label>
                <span>许可协议</span>
                <input name="license" value={draft.license} onChange={handleDraftChange} />
              </label>
              <label>
                <span>Manifest URI</span>
                <input
                  name="manifestUri"
                  placeholder="ipfs://your-manifest"
                  value={draft.manifestUri}
                  onChange={handleDraftChange}
                />
              </label>
              <label>
                <span>正文 URI</span>
                <input name="contentUri" value={draft.contentUri} onChange={handleDraftChange} />
              </label>
              <label>
                <span>镜像 URI</span>
                <input name="mirrorUri" value={draft.mirrorUri} onChange={handleDraftChange} />
              </label>
              <label>
                <span>数据 URI</span>
                <textarea
                  name="dataUrisText"
                  rows={2}
                  value={draft.dataUrisText}
                  onChange={handleDraftChange}
                />
              </label>
              <label>
                <span>代码 URI</span>
                <textarea
                  name="codeUrisText"
                  rows={2}
                  value={draft.codeUrisText}
                  onChange={handleDraftChange}
                />
              </label>
              <label>
                <span>父版本</span>
                <input
                  name="parentVersion"
                  placeholder="留空表示首发"
                  value={draft.parentVersion}
                  onChange={handleDraftChange}
                />
              </label>

              <div className="composer-actions">
                <button className="button button--ghost" type="button" onClick={handleDownloadManifest}>
                  生成投稿清单
                </button>
                <button
                  className="button button--primary"
                  type="button"
                  onClick={handleSubmitOnchain}
                  disabled={writesBlocked}
                >
                  提交到链上
                </button>
              </div>
              <p className="composer-message">{submitMessage}</p>
              {txHash ? (
                <p className="composer-message">
                  交易哈希：
                  <a href={`${activeConfig.explorerBaseUrl}/tx/${txHash}`} target="_blank" rel="noreferrer">
                    {txHash}
                  </a>
                </p>
              ) : null}
            </form>

            <div className="manifest-preview">
              <div className="manifest-preview__label">Manifest 预览</div>
              {manifestError ? (
                <p className="inline-warning">{manifestError}</p>
              ) : (
                <pre>{JSON.stringify(manifestPreview, null, 2)}</pre>
              )}
            </div>
          </div>
        </section>

        <section className="section-card">
          <div className="section-card__header">
            <span className="section-card__index">02</span>
            <h2>去中心化存储上传</h2>
          </div>
          <div className="storage-grid">
            <form className="workflow-card" onSubmit={(event) => event.preventDefault()}>
              <p className="workflow-card__eyebrow">IPFS Upload</p>
              <h3>上传到 IPFS</h3>
              <p className="workflow-card__hint">
                Pinata JWT 只保留在当前页面会话中，用来把正文或长评直接 pin 到 IPFS。
              </p>
              <label>
                <span>上传目标</span>
                <select name="target" value={storageDraft.target} onChange={handleStorageDraftChange}>
                  <option value="submission">稿件正文与 manifest</option>
                  <option value="review">评审长文</option>
                </select>
              </label>
              <label>
                <span>文件前缀</span>
                <input
                  name="fileStem"
                  value={storageDraft.fileStem}
                  onChange={handleStorageDraftChange}
                />
              </label>
              <label>
                <span>Pinata JWT</span>
                <textarea
                  name="pinataJwt"
                  rows={3}
                  value={storageDraft.pinataJwt}
                  onChange={handleStorageDraftChange}
                />
              </label>
              <label>
                <span>{storageDraft.target === "submission" ? "正文 Markdown" : "评审 Markdown"}</span>
                <textarea
                  name="body"
                  rows={10}
                  value={storageDraft.body}
                  onChange={handleStorageDraftChange}
                />
              </label>
              <button className="button button--primary" type="button" onClick={handleUploadToIpfs}>
                上传到 IPFS
              </button>
              <p className="composer-message">{storageMessage}</p>
            </form>

            <div className="manifest-preview">
              <div className="manifest-preview__label">上传结果</div>
              <div className="storage-summary">
                <p>
                  {storageDraft.target === "submission"
                    ? `上传成功后会自动回填投稿表单里的 contentUri / manifestUri。`
                    : "上传成功后会自动回填评审表单里的 reviewUri。"}
                </p>
                {storageLinks.length > 0 ? (
                  <div className="storage-links">
                    {storageLinks.map((link, index) => (
                      <a key={link} href={link} target="_blank" rel="noreferrer">
                        {index === 0
                          ? storageDraft.target === "submission"
                            ? "查看正文网关链接"
                            : "查看评审网关链接"
                          : "查看 manifest 网关链接"}
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="section-empty">上传完成后，这里会显示可直接访问的网关链接。</p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="section-card">
          <div className="section-card__header">
            <span className="section-card__index">03</span>
            <h2>修订与评审工作流</h2>
          </div>
          <div className="workflow-grid">
            <form className="workflow-card" onSubmit={(event) => event.preventDefault()}>
              <p className="workflow-card__eyebrow">Version Append</p>
              <h3>提交修订版本</h3>
              <label>
                <span>稿件编号</span>
                <input
                  name="submissionId"
                  value={versionDraft.submissionId}
                  onChange={handleVersionDraftChange}
                />
              </label>
              <label>
                <span>父版本号</span>
                <input
                  name="parentVersionId"
                  value={versionDraft.parentVersionId}
                  onChange={handleVersionDraftChange}
                />
              </label>
              <label>
                <span>修订标题</span>
                <input name="title" value={versionDraft.title} onChange={handleVersionDraftChange} />
              </label>
              <label>
                <span>修订摘要</span>
                <textarea
                  name="abstract"
                  rows={3}
                  value={versionDraft.abstract}
                  onChange={handleVersionDraftChange}
                />
              </label>
              <label>
                <span>Manifest URI</span>
                <input
                  name="manifestUri"
                  value={versionDraft.manifestUri}
                  onChange={handleVersionDraftChange}
                />
              </label>
              <label>
                <span>正文 URI</span>
                <input
                  name="contentUri"
                  value={versionDraft.contentUri}
                  onChange={handleVersionDraftChange}
                />
              </label>
              <label>
                <span>镜像 URI</span>
                <input
                  name="mirrorUri"
                  value={versionDraft.mirrorUri}
                  onChange={handleVersionDraftChange}
                />
              </label>
              <label>
                <span>数据 URI</span>
                <textarea
                  name="dataUrisText"
                  rows={2}
                  value={versionDraft.dataUrisText}
                  onChange={handleVersionDraftChange}
                />
              </label>
              <label>
                <span>代码 URI</span>
                <textarea
                  name="codeUrisText"
                  rows={2}
                  value={versionDraft.codeUrisText}
                  onChange={handleVersionDraftChange}
                />
              </label>
              <button
                className="button button--primary"
                type="button"
                onClick={handleAddVersionOnchain}
                disabled={writesBlocked}
              >
                提交修订版本
              </button>
              <p className="composer-message">{versionMessage}</p>
              {versionTxHash ? (
                <p className="composer-message">
                  交易哈希：
                  <a href={`${activeConfig.explorerBaseUrl}/tx/${versionTxHash}`} target="_blank" rel="noreferrer">
                    {versionTxHash}
                  </a>
                </p>
              ) : null}
            </form>

            <form className="workflow-card" onSubmit={(event) => event.preventDefault()}>
              <p className="workflow-card__eyebrow">Review Open</p>
              <h3>发起评审邀请</h3>
              <p className="workflow-card__hint">
                当前评审人地址会使用已连接钱包：
                {wallet.account ?? "尚未连接"}
              </p>
              <label>
                <span>稿件编号</span>
                <input
                  name="submissionId"
                  value={reviewOpenDraft.submissionId}
                  onChange={handleReviewOpenDraftChange}
                />
              </label>
              <label>
                <span>冲突声明</span>
                <textarea
                  name="conflictStatement"
                  rows={3}
                  value={reviewOpenDraft.conflictStatement}
                  onChange={handleReviewOpenDraftChange}
                />
              </label>
              <label>
                <span>截止天数</span>
                <input
                  name="dueInDays"
                  value={reviewOpenDraft.dueInDays}
                  onChange={handleReviewOpenDraftChange}
                />
              </label>
              <label className="workflow-card__check">
                <input
                  type="checkbox"
                  name="isSelfNominated"
                  checked={reviewOpenDraft.isSelfNominated}
                  onChange={handleReviewOpenDraftChange}
                />
                <span>作为自荐评审发起</span>
              </label>
              <button
                className="button button--primary"
                type="button"
                onClick={handleOpenReviewOnchain}
                disabled={writesBlocked}
              >
                发起评审邀请
              </button>
              <p className="composer-message">{reviewOpenMessage}</p>
              {reviewOpenTxHash ? (
                <p className="composer-message">
                  交易哈希：
                  <a
                    href={`${activeConfig.explorerBaseUrl}/tx/${reviewOpenTxHash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {reviewOpenTxHash}
                  </a>
                </p>
              ) : null}
            </form>

            <form className="workflow-card" onSubmit={(event) => event.preventDefault()}>
              <p className="workflow-card__eyebrow">Review Submit</p>
              <h3>提交评审结论</h3>
              <label>
                <span>评审编号</span>
                <input
                  name="reviewId"
                  value={reviewSubmissionDraft.reviewId}
                  onChange={handleReviewSubmissionDraftChange}
                />
              </label>
              <div className="workflow-card__score-grid">
                <label>
                  <span>方法学</span>
                  <input
                    name="methodologyScore"
                    value={reviewSubmissionDraft.methodologyScore}
                    onChange={handleReviewSubmissionDraftChange}
                  />
                </label>
                <label>
                  <span>新颖性</span>
                  <input
                    name="noveltyScore"
                    value={reviewSubmissionDraft.noveltyScore}
                    onChange={handleReviewSubmissionDraftChange}
                  />
                </label>
                <label>
                  <span>严谨性</span>
                  <input
                    name="rigorScore"
                    value={reviewSubmissionDraft.rigorScore}
                    onChange={handleReviewSubmissionDraftChange}
                  />
                </label>
                <label>
                  <span>清晰度</span>
                  <input
                    name="clarityScore"
                    value={reviewSubmissionDraft.clarityScore}
                    onChange={handleReviewSubmissionDraftChange}
                  />
                </label>
              </div>
              <label>
                <span>结论</span>
                <select
                  name="recommendation"
                  value={reviewSubmissionDraft.recommendation}
                  onChange={handleReviewSubmissionDraftChange}
                >
                  <option value="accept">建议录用</option>
                  <option value="revise">建议修改</option>
                  <option value="reject">建议拒稿</option>
                </select>
              </label>
              <label>
                <span>摘要</span>
                <textarea
                  name="summary"
                  rows={3}
                  value={reviewSubmissionDraft.summary}
                  onChange={handleReviewSubmissionDraftChange}
                />
              </label>
              <label>
                <span>长评 URI</span>
                <input
                  name="reviewUri"
                  value={reviewSubmissionDraft.reviewUri}
                  onChange={handleReviewSubmissionDraftChange}
                />
              </label>
              <button
                className="button button--primary"
                type="button"
                onClick={handleSubmitReviewOnchain}
                disabled={writesBlocked}
              >
                提交评审结论
              </button>
              <p className="composer-message">{reviewSubmitMessage}</p>
              {reviewSubmitTxHash ? (
                <p className="composer-message">
                  交易哈希：
                  <a
                    href={`${activeConfig.explorerBaseUrl}/tx/${reviewSubmitTxHash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {reviewSubmitTxHash}
                  </a>
                </p>
              ) : null}
            </form>

            <form className="workflow-card" onSubmit={(event) => event.preventDefault()}>
              <p className="workflow-card__eyebrow">Dispute Open</p>
              <h3>发起治理异议</h3>
              <label>
                <span>目标类型</span>
                <select
                  name="targetType"
                  value={disputeDraft.targetType}
                  onChange={handleDisputeDraftChange}
                >
                  <option value="review">评审</option>
                  <option value="decision">决定</option>
                </select>
              </label>
              <label>
                <span>目标编号</span>
                <input
                  name="targetId"
                  value={disputeDraft.targetId}
                  onChange={handleDisputeDraftChange}
                />
              </label>
              <label>
                <span>争议原因</span>
                <textarea
                  name="reason"
                  rows={3}
                  value={disputeDraft.reason}
                  onChange={handleDisputeDraftChange}
                />
              </label>
              <label>
                <span>证据 URI</span>
                <input
                  name="evidenceUri"
                  value={disputeDraft.evidenceUri}
                  onChange={handleDisputeDraftChange}
                />
              </label>
              <button
                className="button button--primary"
                type="button"
                onClick={handleOpenDisputeOnchain}
                disabled={writesBlocked}
              >
                发起治理异议
              </button>
              <p className="composer-message">{disputeMessage}</p>
              {disputeTxHash ? (
                <p className="composer-message">
                  交易哈希：
                  <a href={`${activeConfig.explorerBaseUrl}/tx/${disputeTxHash}`} target="_blank" rel="noreferrer">
                    {disputeTxHash}
                  </a>
                </p>
              ) : null}
            </form>
          </div>
        </section>

        <section className="section-card">
          <div className="section-card__header">
            <span className="section-card__index">04</span>
            <h2>版本树</h2>
          </div>
          {leadSubmission ? (
            <div className="timeline-groups">
              {dashboard.submissions.map((submission) => (
                <article className="timeline-group" key={submission.id}>
                  <div className="timeline-group__header">
                    <div>
                      <p className="timeline-group__eyebrow">稿件 #{submission.id}</p>
                      <h3>{submission.title}</h3>
                    </div>
                    <span className="timeline-group__status">{formatStatus(submission.status)}</span>
                  </div>
                  <div className="timeline">
                    {submission.versions.map((version) => (
                      <article className="timeline__item" key={`${submission.id}-${version.id}`}>
                        <div className="timeline__dot" />
                        <div className="timeline__content">
                          <div className="timeline__version">v{version.id}</div>
                          <h3>{version.title}</h3>
                          <p>{version.abstract}</p>
                          <div className="timeline__meta">
                            <span>{version.createdAt}</span>
                            <span>{version.manifestUri}</span>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="section-empty">当前链上还没有可展示的投稿版本。</p>
          )}
        </section>

        <section className="section-card" id="review">
          <div className="section-card__header">
            <span className="section-card__index">05</span>
            <h2>公开评审</h2>
          </div>
          {dashboard.reviews.length > 0 ? (
            <div className="review-grid">
              {dashboard.reviews.map((review) => (
                <article className="review-card" key={review.id}>
                  <p className="review-card__badge">
                    {formatRecommendation(review.recommendation)} · {buildReviewerWeightLabel(review.weight)}
                  </p>
                  <h3>{review.reviewer}</h3>
                  <p>{review.summary}</p>
                  <div className="review-card__meta">
                    <span>权重 {review.weight}</span>
                    <span>{review.publishedAt}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="section-empty">当前还没有公开提交的链上评审。</p>
          )}
        </section>

        <section className="section-card">
          <div className="section-card__header">
            <span className="section-card__index">06</span>
            <h2>声誉账本</h2>
          </div>
          <div className="columns">
            <div className="stack">
              {dashboard.reviewers.length > 0 ? (
                dashboard.reviewers.map((reviewer) => (
                  <article className="reviewer-card" key={reviewer.address}>
                    <div>
                      <h3>{reviewer.handle}</h3>
                      <p>{reviewer.discipline}</p>
                    </div>
                    <strong>{buildReviewerWeightLabel(reviewer.weight)}</strong>
                    <span>已完成 {reviewer.completedReviews} 篇评审</span>
                  </article>
                ))
              ) : (
                <p className="section-empty">声誉画像会在第一批真实评审提交后出现。</p>
              )}
            </div>

            <div className="stack">
              {dashboard.reputationLedger.length > 0 ? (
                dashboard.reputationLedger.map((entry) => (
                  <article className="ledger-row" key={`${entry.subject}-${entry.evidenceUri}`}>
                    <span>{entry.subject}</span>
                    <span>{formatRole(entry.role)}</span>
                    <strong>+{entry.delta}</strong>
                  </article>
                ))
              ) : (
                <p className="section-empty">当前还没有可回放的声誉增量记录。</p>
              )}
            </div>
          </div>
        </section>

        <section className="section-card">
          <div className="section-card__header">
            <span className="section-card__index">07</span>
            <h2>治理面板</h2>
          </div>
          <div className="columns">
            <div className="stack">
              {dashboard.decisions.length > 0 ? (
                dashboard.decisions.map((decision) => (
                  <article className="decision-card" key={`${decision.submissionId}-${decision.recordedAt}`}>
                    <p className="decision-card__label">{formatDecisionLabel(decision.label)}</p>
                    <h3>决定 #{decision.submissionId}</h3>
                    <p>{decision.rationale}</p>
                    <span>{decision.recordedAt}</span>
                  </article>
                ))
              ) : (
                <p className="section-empty">当前还没有新的治理决定写入链上。</p>
              )}
            </div>

            <div className="stack">
              {dashboard.disputes.length > 0 ? (
                dashboard.disputes.map((dispute) => (
                  <article className="dispute-card" key={dispute.id}>
                    <p className="decision-card__label">异议 {formatDisputeStatus(dispute.status)}</p>
                    <h3>{dispute.title}</h3>
                    <p>{dispute.evidenceUri}</p>
                  </article>
                ))
              ) : (
                <p className="section-empty">当前还没有进入仲裁流程的争议。</p>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
