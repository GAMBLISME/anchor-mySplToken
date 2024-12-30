import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Myspltoken } from "../target/types/myspltoken";
import { Keypair, SystemProgram } from "@solana/web3.js";
import { PROGRAM_ID as METADATA_PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  AccountLayout,
  createAssociatedTokenAccount
} from "@solana/spl-token";

describe("Test MySplToken", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider); // 设置全局 provider
  console.log(`Cluster RPC Endpoint: ${provider.connection.rpcEndpoint}`);

  const program = anchor.workspace.Myspltoken as Program<Myspltoken>;

  const iniTokenParams = {
    name: "My The first token",
    symbol: "TFT",
    uri: "https://5vfxc4tr6xoy23qefqbj4qx2adzkzapneebanhcalf7myvn5gzja.arweave.net/7UtxcnH13Y1uBCwCnkL6APKsge0hAgacQFl-zFW9NlI",
    decimals: 9,
  };

  const payer = provider.wallet.publicKey; // 钱包地址
  const MINT_SEED = "mint";

  const [mint] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from(MINT_SEED)],
    program.programId
  );

  const [metadataAddress] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"), // 确保这里是 "metadata" 字符串
      METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    METADATA_PROGRAM_ID // 确保这里是 METADATA_PROGRAM_ID
  );

  console.log(`Mint address: ${mint}`);
  console.log(`Metadata address: ${metadataAddress}`);
  console.log(`Program ID: ${program.programId}`);
  console.log(`METADATA_PROGRAM_ID: ${METADATA_PROGRAM_ID}`);

  beforeEach(async () => {
    // 检查是否已经初始化
    const mintInfo = await provider.connection.getAccountInfo(mint);
    if (mintInfo) {
      console.log("Mint account already exists.");
      return;
    }

    console.log("Mint account not found. Initializing...");

    const initContext = {
      metadata: metadataAddress,
      mint,
      payer,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      systemProgram: SystemProgram.programId,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      tokenMetadataProgram: METADATA_PROGRAM_ID,
    };

    // 调用 initToken 方法初始化代币
    const tx = await program.methods
      .initToken(iniTokenParams)
      .accounts(initContext)
      .rpc();

    console.log(`Token initialized. Transaction: https://explorer.solana.com/tx/${tx}?cluster=devnet`);
  });

  it("Test minting tokens", async () => {
    console.log(`\n==================\n`);
    const quantity = 1000000000; // Mint 1 token (10^decimals units)
    const associatedTokenAccount = await getAssociatedTokenAddress(
      mint,
      payer
    );

    console.log(`Associated Token Account: ${associatedTokenAccount}`);

    const mintContext = {
      mint,
      destination: associatedTokenAccount,
      payer,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    };

    const tx = await program.methods
      .mintTokens(new anchor.BN(quantity))
      .accounts(mintContext)
      .rpc();

    console.log(
      `Tokens minted. Transaction: https://explorer.solana.com/tx/${tx}?cluster=devnet`
    );

    // Fetch the balance of the associated token account
    const accountInfo = await provider.connection.getAccountInfo(
      associatedTokenAccount
    );
    if (accountInfo) {
      const tokenAmount = AccountLayout.decode(accountInfo.data).amount;
      console.log(`Balance: ${tokenAmount}`);
    } else {
      console.error("Associated Token Account not found.");
    }
  });



  it("Test transferring tokens", async () => {
    console.log(`\n==================\n`);
    const quantity = 500000000; // 转账 0.5 个代币（10^decimals 单位）

    // 创建一个新的接收者钱包用于测试
    const receiver = Keypair.generate();
    console.log(`接收者公钥地址:${receiver.publicKey}`)

    const payerBalance = await provider.connection.getBalance(payer);
    console.log(`发送者钱包余额: ${payerBalance / 1e9} SOL`);

    // 发送 2 SOL (2e9 lamports)
    const transferAmount = 2 * 1e9; // 2 SOL in lamports

    const transaction = new anchor.web3.Transaction().add(
      SystemProgram.transfer({
        fromPubkey: payer,           // 发送者的钱包地址
        toPubkey: receiver.publicKey, // 接收者的钱包地址
        lamports: transferAmount,     // 发送的 SOL 数量（以 lamports 为单位）
      })
    );
    try {
      const tx = await provider.sendAndConfirm(transaction);
      console.log(`Sent 2 SOL to receiver. 交易链接: https://explorer.solana.com/tx/${tx}?cluster=devnet`);

      // 检查接收者的余额
      const receiverBalance = await provider.connection.getBalance(receiver.publicKey);
      console.log(`接收者余额: ${receiverBalance / 1e9} SOL`);
    } catch (error) {
      console.error("Transfer failed:", error);
    }


    const sourceTokenAccount = await getAssociatedTokenAddress(mint, payer); // 发送者的 ATA
    const receiverTokenAccount = await getAssociatedTokenAddress(mint, receiver.publicKey); // 接收者的 ATA

    console.log(`发送者 Token 账户: ${sourceTokenAccount}`);
    console.log(`接收者 Token 账户: ${receiverTokenAccount}`);

    const receiverAccountInfo = await provider.connection.getAccountInfo(receiverTokenAccount);

    if (!receiverAccountInfo) {
      console.log("Creating receiver's ATA...");

      const receiverAta = await createAssociatedTokenAccount(
        provider.connection as unknown as import("@solana/web3.js").Connection,           // 当前连接
        receiver,         // 支付者
        mint,                          // Mint 地址
        receiver.publicKey,            // 接收者地址
        undefined,                     // 确认选项 (默认)
        TOKEN_PROGRAM_ID,              // Token Program ID
        ASSOCIATED_TOKEN_PROGRAM_ID    // Associated Token Program ID
      );

      console.log(`Receiver's ATA created at: ${receiverAta}`);
    }


    // 构建转账上下文
    const transferContext = {
      source: sourceTokenAccount,
      destination: receiverTokenAccount,
      payer, // 支付创建 ATA 的账户
      authority: payer, // 授权账户,指这个ATA账户的所有者是谁，也就是接收者
      mint,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    };

    // 执行转账
    const transferTx = await program.methods
      .transferTokens(new anchor.BN(quantity))
      .accounts(transferContext)
      .rpc();

    console.log(`代币转账成功. 交易链接: https://explorer.solana.com/tx/${transferTx}?cluster=devnet`);

    // 检查接收者的 ATA 余额
    const updatedReceiverAccountInfo = await provider.connection.getAccountInfo(receiverTokenAccount);
    if (updatedReceiverAccountInfo) {
      const receiverTokenAmount = AccountLayout.decode(updatedReceiverAccountInfo.data).amount;
      console.log(`接收者转账后的余额: ${receiverTokenAmount}`);
    } else {
      console.error("接收者的 ATA 在转账后未找到.");
    }

    // 检查发送者的余额是否减少
    const updatedSourceAccountInfo = await provider.connection.getAccountInfo(sourceTokenAccount);
    if (updatedSourceAccountInfo) {
      const sourceTokenAmount = AccountLayout.decode(updatedSourceAccountInfo.data).amount;
      console.log(`发送者转账后的余额: ${sourceTokenAmount}`);
    } else {
      console.error("发送者的 ATA 在转账后未找到.");
    }
  });

  it("Test burning tokens", async () => {
    console.log(`\n==================\n`);
    const quantity = 300000000; // Burn 0.3 tokens (10^decimals units)
    const burnContext = {
      mint,
      source: await getAssociatedTokenAddress(mint, payer),
      owner: payer,
      tokenProgram: TOKEN_PROGRAM_ID,
    };

    const burnTx = await program.methods
      .burnTokens(new anchor.BN(quantity))
      .accounts(burnContext)
      .rpc();

    console.log(`Tokens burned. Transaction: https://explorer.solana.com/tx/${burnTx}?cluster=devnet`);

    // Check the balance after burning
    const accountInfo = await provider.connection.getAccountInfo(
      await getAssociatedTokenAddress(mint, payer)
    );
    if (accountInfo) {
      const tokenAmount = AccountLayout.decode(accountInfo.data).amount;
      console.log(`Balance after burning: ${tokenAmount}`);
    } else {
      console.error("Associated Token Account not found.");
    }
  });
});
