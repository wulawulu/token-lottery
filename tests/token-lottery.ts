import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenLottery } from "../target/types/token_lottery";
import { TOKEN_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";

describe("token-lottery", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const wallet = provider.wallet as anchor.Wallet;

  const program = anchor.workspace.tokenLottery as Program<TokenLottery>;

  async function buyTicket(){
    const buyTicketIx = await program.methods.buyTicket()
        .accounts({
          tokenProgram: TOKEN_PROGRAM_ID,
        }).instruction();

    const blockhashWithContext = await provider.connection.getLatestBlockhash();
    
    const computeIx = anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
      units: 300000,
    });

    const priorityIx = anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 1,
    });
    
    const tx = new anchor.web3.Transaction({
      feePayer: wallet.publicKey,
      blockhash: blockhashWithContext.blockhash,
      lastValidBlockHeight: blockhashWithContext.lastValidBlockHeight,
    })
    .add(computeIx)
    .add(priorityIx)
    .add(buyTicketIx);

    const signature = await anchor.web3.sendAndConfirmTransaction(provider.connection, tx, [wallet.payer],{skipPreflight: true});
    console.log("Your transaction signature", signature);
  }

  it("should init config", async () => {
    // Add your test here.
    const initConfigIx = await program.methods.initializeConfig(
      new anchor.BN(10), 
      new anchor.BN(1860085765), 
      new anchor.BN(10000) 
    ).instruction();
    const blockhashWithContext = await provider.connection.getLatestBlockhash();

    const tx = new anchor.web3.Transaction({
      feePayer: wallet.publicKey,
      blockhash: blockhashWithContext.blockhash,
      lastValidBlockHeight: blockhashWithContext.lastValidBlockHeight,
    })
    .add(initConfigIx);

    const signature = await anchor.web3.sendAndConfirmTransaction(provider.connection, tx, [wallet.payer],{skipPreflight: true});
    console.log("Your transaction signature", signature);
    
    const initLotteryIx = await program.methods.initializeLottery().accounts(
      { tokenProgram: TOKEN_PROGRAM_ID }
    ).instruction();
    const initLotteryTx = new anchor.web3.Transaction({
      feePayer: wallet.publicKey,
      blockhash: blockhashWithContext.blockhash,
      lastValidBlockHeight: blockhashWithContext.lastValidBlockHeight,
    })
    .add(initLotteryIx);
    const lotterySignature = await anchor.web3.sendAndConfirmTransaction(provider.connection, initLotteryTx, [wallet.payer],{skipPreflight: true});
    console.log("Your lotterySignature signature", lotterySignature);

    await buyTicket();
  });
});
