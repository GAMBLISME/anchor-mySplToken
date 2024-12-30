use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{
        create_metadata_accounts_v3, mpl_token_metadata::types::DataV2, CreateMetadataAccountsV3,
        Metadata as Metaplex,
    },
    token::{mint_to, Burn, Mint, MintTo, Token, TokenAccount}
};


declare_id!("53Tt3YDUVYtWBQEyWZdHebdDFebfhjt9fMAwG6D3uAEz");

#[program]
pub mod myspltoken {
    use super::*;

    // 初始化 SPL
    pub fn init_token(ctx: Context<InitToken>, metadata: InitTokenParams) -> Result<()> {
        let seeds = &["mint".as_bytes(), &[ctx.bumps.mint]];
        let signer = [&seeds[..]];

        let token_data: DataV2 = DataV2 {
            name: metadata.name,
            symbol: metadata.symbol,
            uri: metadata.uri,
            seller_fee_basis_points: 0,
            creators: None,
            collection: None,
            uses: None,
        };

        let metadata_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_metadata_program.to_account_info(),
            CreateMetadataAccountsV3 {
                payer: ctx.accounts.payer.to_account_info(),
                update_authority: ctx.accounts.mint.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                metadata: ctx.accounts.metadata.to_account_info(),
                mint_authority: ctx.accounts.mint.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
            },
            &signer,
        );

        create_metadata_accounts_v3(metadata_ctx, token_data, false, true, None)?;

        msg!("Token mint created successfully.");

        Ok(())
    }

    //  铸造 SPL
    pub fn mint_tokens(ctx: Context<MintTokens>, quantity: u64) -> Result<()> {
        let seeds = &["mint".as_bytes(), &[ctx.bumps.mint]];
        let signer = [&seeds[..]];

        mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    authority: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.destination.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                },
                &signer,
            ),
            quantity,
        )?;

        Ok(())
    }

    pub fn transfer_tokens(ctx: Context<TransferTokens>, quantity: u64) -> Result<()> {
       
        // 获取 Transfer 的 CPI 上下文
        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token::Transfer {
                from: ctx.accounts.source.to_account_info(),
                to: ctx.accounts.destination.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
        );
    
        // 执行转账操作
        anchor_spl::token::transfer(transfer_ctx, quantity)?;
    
        // 记录成功消息
        msg!("Transferred {} tokens successfully.", quantity);
        Ok(())
    }
    
    

    pub fn burn_tokens(ctx: Context<BurnTokens>, quantity: u64) -> Result<()> {
        let seeds = &["mint".as_bytes(), &[ctx.bumps.mint]];
        let signer = [&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.mint.to_account_info(),
                from: ctx.accounts.source.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            },
            &signer,
        );

        anchor_spl::token::burn(cpi_ctx, quantity)?;

        msg!("Burned {} tokens successfully.", quantity);
        Ok(())
    }
}

// 账户的数据
//   定义init令牌参数
#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct InitTokenParams {
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub decimals: u8,
}

// 主程序需要的账户
#[derive(Accounts)]
#[instruction(params: InitTokenParams)]
pub struct InitToken<'info> {
    // Metaplex 账户
    /// CHECK: This is a Metaplex metadata account. Its safety is guaranteed by the CPI call to create_metadata_accounts_v3.
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,
    #[account(
        init,
        seeds = [b"mint"],
        bump,
        payer = payer,
        mint::decimals = params.decimals,
        mint::authority = mint,
    )]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub token_metadata_program: Program<'info, Metaplex>,
}

#[derive(Accounts)]
pub struct MintTokens<'info> {
    #[account(
        mut,
        seeds = [b"mint"],
        bump,
        mint::authority = mint,
    )]
    pub mint: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = payer,
    )]
    pub destination: Account<'info, TokenAccount>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
pub struct BurnTokens<'info> {
    #[account(
        mut,
        seeds = [b"mint"],
        bump,
    )]
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = owner,
    )]
    pub source: Account<'info, TokenAccount>,
    pub owner: Signer<'info>, // 权限持有者
    pub token_program: Program<'info, Token>,
}
#[derive(Accounts)]
pub struct TransferTokens<'info> {
    #[account(mut)]
    pub source: Account<'info, TokenAccount>, // 发送方
    /// CHECK:checked
    #[account(mut)]
    pub destination: UncheckedAccount<'info>, // 接收方
    #[account(mut)]
    pub payer: Signer<'info>, // 支付创建 ATA 的账户
    #[account(mut)] // 确保 authority 是一个 Signer 或 AccountInfo，接收者
    pub authority: Signer<'info>, // 授权账户
    pub mint: Account<'info, Mint>, // Token 的 Mint
    pub token_program: Program<'info, Token>, // Token 程序
    pub system_program: Program<'info, System>, // 系统程序
    pub associated_token_program: Program<'info, AssociatedToken>, // ATA 程序
}
