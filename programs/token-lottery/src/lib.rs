use anchor_lang::prelude::*;

declare_id!("HAsY3haak8k3TnvXhE2pZgVigvc1QBx4JF2Eixm2yJYV");

#[program]
pub mod token_lottery {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
