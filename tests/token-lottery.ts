import * as anchor from "@coral-xyz/anchor";
import * as sb from "@switchboard-xyz/on-demand";
import { Program, Idl } from "@coral-xyz/anchor";
import { TokenLottery } from "../target/types/token_lottery";
import { TOKEN_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";
import { readFileSync } from "fs";
import path from "path";

describe("token-lottery", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  const connection = provider.connection;
  const wallet = provider.wallet as anchor.Wallet;
  anchor.setProvider(provider);

  const program = anchor.workspace.tokenLottery as Program<TokenLottery>;

  let switchboardProgram;
  const rngKp = anchor.web3.Keypair.generate();
  console.log("sb ondemand mainnet pid", sb.ON_DEMAND_MAINNET_PID);

  before("Loading switchboard program", async () => {
    const switchboardIdlPath = path.resolve(
      __dirname,
      "../setup/switchboard_on_demand_idl.json"
    );
    const switchboardIdl = JSON.parse(
      readFileSync(switchboardIdlPath, "utf-8")
    ) as Idl;
    switchboardProgram = new Program(switchboardIdl, provider);
  });

  async function buyTicket() {
    const buyTicketIx = await program.methods
      .buyTicket()
      .accounts({
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

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

    const signature = await anchor.web3.sendAndConfirmTransaction(
      provider.connection,
      tx,
      [wallet.payer],
      { skipPreflight: true }
    );
    console.log("Your transaction signature", signature);
  }

  it("should init config", async () => {
    // Add your test here.
    const initConfigIx = await program.methods
      .initializeConfig(
        new anchor.BN(10),
        new anchor.BN(1860085765),
        new anchor.BN(10000)
      )
      .instruction();
    const blockhashWithContext = await provider.connection.getLatestBlockhash();

    const tx = new anchor.web3.Transaction({
      feePayer: wallet.publicKey,
      blockhash: blockhashWithContext.blockhash,
      lastValidBlockHeight: blockhashWithContext.lastValidBlockHeight,
    }).add(initConfigIx);

    const signature = await anchor.web3.sendAndConfirmTransaction(
      provider.connection,
      tx,
      [wallet.payer],
      { skipPreflight: true }
    );
    console.log("Your transaction signature", signature);

    const initLotteryIx = await program.methods
      .initializeLottery()
      .accounts({ tokenProgram: TOKEN_PROGRAM_ID })
      .instruction();
    const initLotteryTx = new anchor.web3.Transaction({
      feePayer: wallet.publicKey,
      blockhash: blockhashWithContext.blockhash,
      lastValidBlockHeight: blockhashWithContext.lastValidBlockHeight,
    }).add(initLotteryIx);
    const lotterySignature = await anchor.web3.sendAndConfirmTransaction(
      provider.connection,
      initLotteryTx,
      [wallet.payer],
      { skipPreflight: true }
    );
    console.log("Your lotterySignature signature", lotterySignature);

    await buyTicket();
    await buyTicket();
    await buyTicket();
    await buyTicket();
    await buyTicket();
    await buyTicket();

    const queue = new anchor.web3.PublicKey(
      "A43DyUGA7s8eXPxqEjJY6EBu1KKbNgfxF8h17VAHn13w"
    );

    const queueAccount = new sb.Queue(switchboardProgram, queue);
    console.log("Queue account", queue.toString());
    try {
      await queueAccount.loadData();
    } catch (err) {
      console.log("Queue account not found");
      process.exit(1);
    }

    const [randomness, ix] = await sb.Randomness.create(
      switchboardProgram,
      rngKp,
      queue
    );
    console.log("Created randomness account..");
    console.log("Randomness account", randomness.pubkey.toBase58());
    console.log("rkp account", rngKp.publicKey.toBase58());
    const createRandomnessTx = await sb.asV0Tx({
      connection: provider.connection,
      ixs: [ix],
      payer: wallet.publicKey,
      signers: [wallet.payer, rngKp],
      computeUnitPrice: 75_000,
      computeUnitLimitMultiple: 1.3,
    });

    const blockhashWithContext2 =
      await provider.connection.getLatestBlockhashAndContext();

    const createRandomnessSignature = await connection.sendTransaction(
      createRandomnessTx
    );
    await connection.confirmTransaction({
      signature: createRandomnessSignature,
      blockhash: blockhashWithContext2.value.blockhash,
      lastValidBlockHeight: blockhashWithContext2.value.lastValidBlockHeight,
    });
    console.log(
      "Transaction Signature for randomness account creatation: ",
      createRandomnessSignature
    );

    const oracleKeys = await queueAccount.fetchOracleKeys();
    const oracleAccounts =
      oracleKeys.length > 0
        ? await connection.getMultipleAccountsInfo(oracleKeys)
        : [];

    const validOracleIndex = oracleAccounts.findIndex(
      (info): info is NonNullable<typeof info> =>
        !!info && info.owner.equals(sb.ON_DEMAND_MAINNET_PID)
    );

    if (validOracleIndex === -1) {
      throw new Error("Queue configured without oracles");
    }

    const oracleKey = oracleKeys[validOracleIndex];

    const sbCommitIx = await switchboardProgram.instruction.randomnessCommit(
      {},
      {
        accounts: {
          randomness: randomness.pubkey,
          queue,
          oracle: oracleKey,
          recentSlothashes: sb.SPL_SYSVAR_SLOT_HASHES_ID,
          authority: wallet.publicKey,
        },
      }
    );

    const commitIx = await program.methods
      .commitAWinner()
      .accounts({
        randomnessAccountData: randomness.pubkey,
      })
      .instruction();
    
    const commitTx = await sb.asV0Tx({
      connection: provider.connection,
      ixs: [sbCommitIx, commitIx],
      payer: wallet.publicKey,
      signers: [wallet.payer],
      computeUnitPrice: 75_000,
      computeUnitLimitMultiple: 1.3,
    });

    const commitSignature = await connection.sendTransaction(commitTx);
    await connection.confirmTransaction({
      signature: commitSignature,
      blockhash: blockhashWithContext2.value.blockhash,
      lastValidBlockHeight: blockhashWithContext2.value.lastValidBlockHeight,
    });
    console.log(
      "Transaction Signature for commit: ",
      commitSignature
    );

  });
});
