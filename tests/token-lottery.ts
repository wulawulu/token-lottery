import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenLottery } from "../target/types/token_lottery";

describe("token-lottery", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const wallet = provider.wallet as anchor.Wallet;

  const program = anchor.workspace.tokenLottery as Program<TokenLottery>;

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
    console.log("Your transaction signature", tx);

    const signature = await anchor.web3.sendAndConfirmTransaction(provider.connection, tx, [wallet.payer]);
    console.log("Your transaction signature", signature);
  });
});
