use anchor_lang::prelude::*;
declare_id!("BAkfv3c2i1Rtv3vRqp4HzMSVYGhtub6fQ7XXoitdWGgk");

pub mod errors;
pub mod states;
use crate::{errors::*, states::*};

#[program]
mod encrypted {
    use super::*;

    pub fn register(
        ctx: Context<Register>,
        username: String,
        messaging_pubkey: String,
    ) -> Result<()> {
        let registry = &mut ctx.accounts.registry_account;

        registry.username = username;
        registry.messaging_pubkey = messaging_pubkey;
        registry.pubkey = ctx.accounts.signer.key();

        Ok(())
    }

    pub fn init_chat(ctx: Context<InitChat>, alice: String, bob: String) -> Result<()> {
        let alice_chat_account = &mut ctx.accounts.alice_chat_account;
        let bob_chat_account = &mut ctx.accounts.bob_chat_account;

        alice_chat_account.idx = 0;
        bob_chat_account.idx = 0;

        alice_chat_account.owner = alice.clone();
        alice_chat_account.chatting_with = bob.clone();

        bob_chat_account.owner = bob;
        bob_chat_account.chatting_with = alice;

        Ok(())
    }

    pub fn send_message(
        ctx: Context<SendMessage>,
        alice: String,
        bob: String,
        timestamp: String,
        message_encrypted_for_alice: String,
        message_encrypted_for_bob: String,
    ) -> Result<()> {
        // let pubkey = &ctx.accounts.registry_account.pubkey;
        // let username = &ctx.accounts.registry_account.username;

        // check if signer pubkey equals alice's pubkey
        // require!(
        //     *pubkey != ctx.accounts.signer.key(),
        //     EncrytedAppError::Unauthorized
        // );
        // check if username equals alice's
        // require!(*username != alice, EncrytedAppError::Unauthorized);

        let alice_message_account = &mut ctx.accounts.alice_message_account;
        alice_message_account.author = alice.clone();
        alice_message_account.timestamp = timestamp.clone();
        alice_message_account.encrypted_message = message_encrypted_for_alice;

        let bob_message_account = &mut ctx.accounts.bob_message_account;
        bob_message_account.author = alice.clone();
        bob_message_account.timestamp = timestamp;
        bob_message_account.encrypted_message = message_encrypted_for_bob;

        let alice_chat_account = &mut ctx.accounts.alice_chat_account;
        alice_chat_account.idx = alice_chat_account.idx.checked_add(1).unwrap();

        let bob_chat_account = &mut ctx.accounts.bob_chat_account;
        bob_chat_account.idx = bob_chat_account.idx.checked_add(1).unwrap();

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(username: String)]
pub struct Register<'info> {
    #[account(
        init,
        payer = signer,
        space = 8 + 4 * 216 + std::mem::size_of::<RegistryAccount>(),
        seeds = [b"registry", username.as_bytes()],
        bump,
    )]
    pub registry_account: Account<'info, RegistryAccount>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(alice: String, bob: String)]
pub struct InitChat<'info> {
    #[account(
        init,
        payer = signer,
        space = 8 + 4 * 40 + std::mem::size_of::<ChatAccount>(),
        seeds = [b"chat", alice.as_bytes(), bob.as_bytes()],
        bump,
    )]
    pub alice_chat_account: Account<'info, ChatAccount>,

    #[account(
        init,
        payer = signer,
        space = 8 + 4 * 40 + std::mem::size_of::<ChatAccount>(),
        seeds = [b"chat", bob.as_bytes(), alice.as_bytes()],
        bump,
    )]
    pub bob_chat_account: Account<'info, ChatAccount>,

    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(alice: String, bob: String)]
pub struct SendMessage<'info> {
    #[account(
        mut,
        seeds = [b"registry", alice.as_bytes()],
        bump,
    )]
    pub registry_account: Account<'info, RegistryAccount>,

    #[account(
        mut,
        seeds = [b"chat", alice.as_bytes(), bob.as_bytes()],
        bump,
    )]
    pub alice_chat_account: Account<'info, ChatAccount>,

    #[account(
        mut,
        seeds = [b"chat", bob.as_bytes(), alice.as_bytes()],
        bump,
    )]
    pub bob_chat_account: Account<'info, ChatAccount>,

    #[account(
        init,
        payer = signer,
        space = 8 + 4 * 180 +  std::mem::size_of::<MessageAccount>(),
        seeds = [b"message", alice.as_bytes(), bob.as_bytes(), &alice_chat_account.idx.to_le_bytes()],
        bump
    )]
    pub alice_message_account: Account<'info, MessageAccount>,

    #[account(
        init,
        payer = signer,
        space = 8 + 4 * 180 + std::mem::size_of::<MessageAccount>(),
        seeds = [b"message", bob.as_bytes(), alice.as_bytes(), &alice_chat_account.idx.to_le_bytes()],
        bump
    )]
    pub bob_message_account: Account<'info, MessageAccount>,

    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}
