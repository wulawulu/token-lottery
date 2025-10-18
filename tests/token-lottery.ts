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
  const RANDOMNESS_TIMEOUT_MS = 60_000;
  const RANDOMNESS_RETRY_DELAY_MS = 2_000;

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

  async function confirmSignature(
    signature: anchor.web3.TransactionSignature,
    commitment: anchor.web3.Commitment = "confirmed"
  ) {
    await connection.confirmTransaction(signature, commitment);
    console.log(`Confirmed transaction ${signature}`);
  }

  async function waitForRandomnessWindow(randomness: sb.Randomness) {
    const randomnessData = await randomness.loadData();
    const seedSlot = (randomnessData.seedSlot as anchor.BN).toNumber();
    console.log("Randomness seed slot", seedSlot);

    const start = Date.now();
    while (true) {
      const currentSlot = await connection.getSlot();
      if (currentSlot > seedSlot) {
        console.log(
          `Current slot ${currentSlot} exceeded seed slot ${seedSlot}`
        );
        return { seedSlot, currentSlot };
      }

      if (Date.now() - start > RANDOMNESS_TIMEOUT_MS) {
        throw new Error(
          `Timed out waiting for slot to pass seed slot ${seedSlot}`
        );
      }

      await sleep(1000);
    }
  }

  async function buildRevealIxWithRetry(randomness: sb.Randomness) {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        return await randomness.revealIx();
      } catch (err) {
        lastError = err;
        console.warn(
          `Reveal attempt ${attempt} failed: ${
            err instanceof Error ? err.message : err
          }`
        );
        if (attempt === 5) {
          break;
        }
        await sleep(RANDOMNESS_RETRY_DELAY_MS);
      }
    }
    throw lastError ?? new Error("Failed to build reveal instruction");
  }

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
    const slot = await connection.getSlot();
    console.log("Current slot:", slot);

    // Add your test here.
    const initConfigIx = await program.methods
      .initializeConfig(
        new anchor.BN(0),
        new anchor.BN(slot + 10),
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

    if (!switchboardProgram) {
      throw new Error("Switchboard program not initialized");
    }

    const queueAccount = await sb.Queue.loadDefault(switchboardProgram);
    const queue = queueAccount.pubkey;
    console.log("Queue account", queue.toBase58());
    try {
      await queueAccount.loadData();
    } catch (err) {
      throw new Error("Queue account not found");
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

    const createRandomnessSignature = await connection.sendTransaction(
      createRandomnessTx
    );
    await confirmSignature(createRandomnessSignature);
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
        !!info &&
        (info.owner.equals(sb.ON_DEMAND_MAINNET_PID) ||
          info.owner.equals(sb.ON_DEMAND_DEVNET_PID))
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
    await confirmSignature(commitSignature);
    console.log(
      "Transaction Signature for commit: ",
      commitSignature
    );

    await waitForRandomnessWindow(randomness);

    const sbRevealIx = await buildRevealIxWithRetry(randomness);
    const revealIx = await program.methods.chooseAWinner()
      .accounts({
        randomnessAccountData: randomness.pubkey,
      })
      .instruction();

    const revealTx = await sb.asV0Tx({
      connection: provider.connection,
      ixs: [sbRevealIx, revealIx],
      payer: wallet.publicKey,
      signers: [wallet.payer],
      computeUnitPrice: 75_000,
      computeUnitLimitMultiple: 1.3,
    });

    const revealSignature = await connection.sendTransaction(revealTx);
    await confirmSignature(revealSignature);
    console.log(
      "Transaction Signature for reveal: ",
      revealSignature
    );

    const claimIx = await program.methods.claimPrize()
      .accounts({
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
      
    const claimTx = new anchor.web3.Transaction({
      feePayer: wallet.publicKey,
      blockhash: blockhashWithContext.blockhash,
      lastValidBlockHeight: blockhashWithContext.lastValidBlockHeight,
    }).add(claimIx);
    const claimSignature = await anchor.web3.sendAndConfirmTransaction(
      provider.connection,
      claimTx,
      [wallet.payer],
      { skipPreflight: true }
    );
    console.log("Your claim transaction signature", claimSignature);  

  });

});
