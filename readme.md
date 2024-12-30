
# MySplToken - 基于 Anchor 框架的 Solana 代币程序

本项目是一个基于 **Anchor 框架** 的 Solana 代币程序，包含代币铸造、转账和销毁等功能。

---

## 前置环境配置

在运行本项目之前，请确保正确配置了开发环境。按照以下步骤安装所需依赖并完成配置：

### 1. **安装必要工具**
- **Node.js**: 请从 [nodejs.org](https://nodejs.org) 安装最新版本的 Node.js。
- **Solana CLI**: 按照 [Solana 官方文档](https://docs.solana.com/cli/install-solana-cli-tools) 的说明安装 Solana CLI。
- **Anchor CLI**: 使用以下命令安装 Anchor CLI：
  ```bash
  cargo install --git https://github.com/coral-xyz/anchor anchor-cli --locked
  ```

### 2. **配置 Solana CLI**
确保 Solana CLI 已配置为正确的网络（例如 Devnet）：
```bash
solana config set --url devnet
```

---

## Anchor 本地环境中的 Associated Token Program 问题

在默认的 Anchor 本地环境中，**ASSOCIATED_TOKEN_PROGRAM_ID** 未被配置。你需要手动设置，方法如下：

1. **下载 MPL Token Metadata 程序**
   使用以下命令从主网下载 `metadata.so` 文件：
   ```bash
   solana program dump --url mainnet-beta metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s metadata.so
   ```

2. **加载到本地验证器**
   使用以下命令将下载的程序加载到本地验证器并启动：
   ```bash
   solana-test-validator --bpf-program metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s metadata.so
   ```

   **注意**：此操作不会下载程序的历史记录，而是将其加载到本地环境中，供你创建与 Token Metadata 程序交互的指令（IXs）。

---

## 启动测试程序

完成上述配置后，运行以下命令启动 Anchor 测试程序：
```bash
anchor test
```

---

## 项目结构

- **`programs/`**: 包含 Solana 程序代码。
- **`tests/`**: 测试脚本，用于测试代币程序的功能。

---

## 支持

如果在使用过程中遇到问题，请提交 [Issue](https://github.com/your-repository/issues) 或联系维护者。
