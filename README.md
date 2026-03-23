# NewChildren

NewChildren 是一个面向中文学术社区的链上开放期刊原型，目标是把投稿、评审、录用决定、版本演进和声誉记录做成可验证的协议，而不是依赖单一平台数据库。

## 在线访问

- 公网地址：[https://works-five-nu.vercel.app](https://works-five-nu.vercel.app)
- 部署网络：`Base Sepolia`
- 当前链上配置会优先从 `public/deployments/base-sepolia.json` 自动读取

当前线上合约地址：

- `JournalRegistry`: `0x04A7cfeF1b0a1da3bF9868cC5678aB6DE0029D4e`
- `SubmissionRegistry`: `0x62ec64aC73a5113D43F2b41b8A3E4f9Bf3a3D82B`
- `ReviewRegistry`: `0x1CdC14d62ED4290Ce8A0aA4734719056A21576e0`
- `ReputationSBT`: `0x34C5F3D4185e61477181FA07204E17b2Bcc60cc3`
- `startBlock`: `39241510`

## 仓库包含内容

- 4 个核心 Solidity 合约：
  - `JournalRegistry`
  - `SubmissionRegistry`
  - `ReviewRegistry`
  - `ReputationSBT`
- 一个中文前端站点，支持：
  - 演示模式浏览
  - 钱包连接
  - 投稿草稿编辑
  - manifest 预览与导出
  - 使用 Pinata JWT 直接把正文或评审上传到 IPFS，并自动回填 URI
  - 在配置链上地址后发起真实投稿交易
  - 为已有稿件追加修订版本
  - 发起评审邀请 / 自荐评审
  - 提交评审结论
  - 发起链上治理异议
  - 自动读取 `public/deployments/*.json` 中的部署地址与起始区块
  - 在配置公共 RPC 后直接回放最近的链上投稿、评审、治理和声誉快照
- 合约编译与部署脚本

## 本地运行

安装依赖：

```powershell
cd C:\Users\15061\Desktop\works
npm install
```

启动开发环境：

```powershell
npm run dev
```

打开 [http://localhost:5173](http://localhost:5173)。

如果没有配置链上地址，前端会自动进入“演示模式”。

## 测试与编译

运行测试：

```powershell
npm test
```

编译合约：

```powershell
npm run compile:contracts
```

产物会写入 `artifacts/contracts/`。

## 部署到 Base Sepolia

先复制环境模板：

```powershell
Copy-Item .env.example .env.local
```

然后补上：

- `DEPLOY_RPC_URL`
- `DEPLOY_PRIVATE_KEY`

执行部署：

```powershell
npm run deploy:contracts
```

部署脚本会：

1. 重新编译合约
2. 部署 4 个核心合约
3. 自动执行模块地址配置
4. 同时生成：
   - `deployments/base-sepolia.json`
   - `public/deployments/base-sepolia.json`

部署产物会带上：

- `startBlock`
- 每个模块的部署区块号 `blocks.*`

## 前端切换到真实模式

把部署结果填回环境变量：

- `VITE_PUBLIC_RPC_URL`
- `VITE_PROTOCOL_START_BLOCK`
- `VITE_JOURNAL_ADDRESS`
- `VITE_SUBMISSION_ADDRESS`
- `VITE_REVIEW_ADDRESS`
- `VITE_REPUTATION_ADDRESS`

重新运行：

```powershell
npm run dev
```

如果部署脚本已经生成了 `public/deployments/base-sepolia.json`，前端会优先自动载入其中的：

- 4 个合约地址
- `startBlock`

这样通常只需要补 `VITE_PUBLIC_RPC_URL`，就能直接读链上快照；当然，也仍然可以手动用环境变量覆盖。

进入“真实模式”后：

- 可以连接钱包并调用 `SubmissionRegistry.createSubmission(...)`
- 可以直接调用 `addVersion / openReview / submitReview / openDispute`
- 如果 `VITE_PUBLIC_RPC_URL` 可用，首页会直接读取最近的链上投稿、评审、决定、争议和声誉记录
- 如果没有公共 RPC，写入能力依然可用，但浏览区会自动回退到示例数据

## GitHub 发布说明

- `.env.local`、本地日志、`.vercel/`、`.opencode/`、构建产物和依赖目录都应保持忽略，不要提交。
- 仓库中保留 `.env.example` 作为环境变量模板，便于其他人复现。
- 线上可公开访问的地址、测试网合约地址和前端静态部署配置可以安全提交。

## 当前限制

- IPFS 上传当前依赖你在浏览器里临时提供 Pinata JWT；它不会写入仓库，也不会自动长期保存。
- Arweave 镜像仍然需要你自行补充，当前自动上传只覆盖 IPFS。
- 当前读取层是“客户端轻索引器”，适合原型和小规模站点；如果以后数据量变大，仍然建议补一个正式索引器。
- `DecisionRecorded` 和 `ReputationGranted` 等事件建议配合 `VITE_PROTOCOL_START_BLOCK` 使用，避免公共 RPC 扫描过大的历史范围。

## 下一步建议

1. 在前端里补上交易确认后的自动刷新与结果回执，让链上工作流更接近可直接运营的站点。
2. 增加 Arweave 镜像上传，把正文与长评从“单 IPFS”升级为“双存储冗余”。
3. 把当前客户端读取层迁移到正式索引器，降低公共 RPC 的扫描压力。
