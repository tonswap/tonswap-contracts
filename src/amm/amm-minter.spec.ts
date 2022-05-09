import { Address, Cell } from "ton";
import BN from "bn.js";
import { JettonMinter } from "../jetton/jetton-minter";
import { AmmMinter } from "./amm-minter";
import { parseJettonTransfer, SendMsgOutAction, sliceToAddress267, toUnixTime } from "../utils";
import { JettonWallet } from "../jetton/jetton-wallet";
import { AmmLpWallet } from "./amm-wallet";
import { actionToInternalMessage, actionToMessage, actionToMessage2 } from "./amm-utils";
import { ERROR_CODES, OPS } from "./ops";

const contractAddress = Address.parse("EQD4FPq-PRDieyQKkizFTRtSDyucUIqrj0v_zXJmqaDp6_0t");
const rewardsWallet = Address.parse("EQD4FPq-PRDieyQKkizFTRtSDyucUIqrj0v_zXJmqaDp6_0t");
const protocolWallet = Address.parse("EQDjhy1Ig-S0vKCWwd3XZRKODGx0RJyhqW37ZDMl-pgv8iBr");
const alice = Address.parseFriendly("EQCLjyIQ9bF5t9h3oczEX3hPVK4tpW2Dqby0eHOH1y5_Nvb7").address;
const amm = Address.parseFriendly("EQCbPJVt83Noxmg8Qw-Ut8HsZ1lz7lhp4k0v9mBX2BJewhpe").address;

const ALICE_INITIAL_BALANCE = 1500;

const aliceSubWallet = Address.parseFriendly(
    "EQCLjyIQ9bF5t9h3oczEX3hPVK4tpW2Dqby0eHOH1y5_Nvb7"
).address;

const ZERO_ADDRESS = Address.parse("EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c");

describe("Jetton Minter ", () => {
    it("mint USDC", async () => {
        const { masterUSDC, aliceUSDC } = await createBaseContracts();

        const jettonWalletResponse = await aliceUSDC.getData();
        console.log(
            `jettonWalletResponse  (after send) balance:${jettonWalletResponse.balance.toString()}`
        );

        ///////// mint again
        const mintResponse2 = await masterUSDC.mint(alice, alice, new BN(2505));
        console.log(mintResponse2);

        const data = await masterUSDC.getData();

        // const mintMessageRAW = actionToMessage(amm, contractAddress, mintResponse2.actions[0]);

        // const mintMessageResponse2 = await aliceUSDC.sendInternalMessage(mintMessageRAW);
        // expect(mintMessageResponse2.exit_code).toBe(0);

        // const data2 = await aliceUSDC.getData();
        // console.log(`jettonWalletResponse2  (after send #2) balance:${data2.balance.toString()}`);
    });

    it("mint USDC", async () => {
        const { masterUSDC, aliceUSDC } = await createBaseContracts();

        const jettonWalletResponse = await aliceUSDC.getData();
        console.log(
            `jettonWalletResponse  (after send) balance:${jettonWalletResponse.balance.toString()}`
        );

        ///////// mint again
        const mintResponse2 = await masterUSDC.mint(alice, alice, new BN(2505));
        const mintMessageRAW = actionToMessage(amm, contractAddress, mintResponse2.actions[0]);

        const mintMessageResponse2 = await aliceUSDC.sendInternalMessage(mintMessageRAW);
        expect(mintMessageResponse2.exit_code).toBe(0);

        const data2 = await aliceUSDC.getData();
        console.log(`jettonWalletResponse2  (after send #2) balance:${data2.balance.toString()}`);
    });

    it("send bob USDC", async () => {
        const { masterUSDC, aliceUSDC } = await createBaseContracts();

        let aliceData = await aliceUSDC.getData();
        console.log(`alice owner: ${sliceToAddress267(aliceData.owner).toFriendly()}`);

        const transferResponse = await aliceUSDC.transferOverloaded(
            alice,
            amm,
            new BN(502),
            amm,
            undefined,
            new BN(100000000),
            OPS.ADD_LIQUIDITY,
            new BN(5)
        );

        const transferMessage = transferResponse.actions[0] as SendMsgOutAction;

        const msg = actionToInternalMessage(
            amm,
            transferMessage.message?.info.dest as Address,
            transferMessage.message?.body
        );
        const bobUSDC = await JettonWallet.createFromMessage(
            transferMessage.message?.init?.code as Cell,
            transferMessage.message?.init?.data as Cell,
            msg
        );

        const bobUsdcData = await bobUSDC.getData();
        console.log(
            `bobUsdcData after transfer balance:${bobUsdcData.balance.toString()}  owner: ${sliceToAddress267(
                bobUsdcData.owner
            ).toFriendly()}`
        );
    });

    it("adds Liquidity", async () => {
        const { masterAMM, ammUsdcWallet } = await initAMM();

        const { tokenWalletAddress } = await masterAMM.getData();

        expect(tokenWalletAddress).toBe(ammUsdcWallet.address?.toFriendly());
    });

    it("removes liquidity", async () => {
        const expectedLP = "708519";

        const { aliceUSDC, masterAMM, ammUsdcWallet, lpWallet } = await initAMM(); //create

        const { balance: lpBalance } = await lpWallet.getData();
        expect(lpBalance.toString()).toBe(expectedLP);
        const removeLiquidityResponse = await lpWallet.removeLiquidity(
            lpBalance,
            alice,
            alice,
            amm
        );

        const removeLiquidityNotification = actionToMessage(
            amm,
            lpWallet.address as Address,
            removeLiquidityResponse.actions[0]
        );

        const ammResponse = await masterAMM.sendInternalMessage(removeLiquidityNotification);
        expect(ammResponse.exit_code).toBe(0);
        let sendTonAfterRemoveLiquidity = ammResponse.actions[0] as SendMsgOutAction;
        //@ts-ignore
        expect(sendTonAfterRemoveLiquidity.message.info.value.coins.toString());

        const usdcResponseAfterAddLiquidity = await ammUsdcWallet.sendInternalMessage(
            actionToMessage(alice, amm, ammResponse.actions[1])
        );
        await aliceUSDC.sendInternalMessage(
            actionToMessage(alice, amm, usdcResponseAfterAddLiquidity.actions[0])
        );
        const aliceUsdcData2 = await aliceUSDC.getData();
        expect(aliceUsdcData2.balance.toString()).toBe(ALICE_INITIAL_BALANCE.toString());
    });

    it("swaps usdc to TON", async () => {
        const expectedOutPut = "332665999";
        const minAmountOut = new BN(expectedOutPut);
        const { aliceUSDC, masterAMM, ammUsdcWallet } = await initAMM(); //create

        const transferResponse = await aliceUSDC.transferOverloaded(
            alice,
            amm,
            new BN(251),
            amm,
            undefined,
            new BN(101),
            OPS.SWAP_TOKEN,
            minAmountOut
        );

        const jettonMsg = actionToMessage(amm, contractAddress, transferResponse.actions[0]);
        const transferUsdcResult = await ammUsdcWallet.sendInternalMessage(jettonMsg);

        const ammUsdcData = await ammUsdcWallet.getData();
        console.log(
            `bobUsdcData after transfer balance:${ammUsdcData.balance.toString()}  owner: ${sliceToAddress267(
                ammUsdcData.owner
            ).toFriendly()}`
        );

        const msgTransferUsdcToAmm = actionToMessage2(
            ammUsdcWallet.address as Address,
            transferUsdcResult.actions[2]
        );

        let ammSwapTokenResponse = await masterAMM.sendInternalMessage(msgTransferUsdcToAmm);
        expect(ammSwapTokenResponse.exit_code).toBe(0);
        let sendTonAfterSwapMessage = ammSwapTokenResponse.actions[0] as SendMsgOutAction;

        console.log(
            "sendTonAfterSwapMessage value=", //@ts-ignore
            sendTonAfterSwapMessage.message.info?.value.coins.toString()
        );

        //@ts-ignore
        expect(sendTonAfterSwapMessage.message.info?.value.coins.toString()).toBe(expectedOutPut);
    });

    it("swaps usdc to TON and revert", async () => {
        const expectedOutPut = "3266599999999";
        const minAmountOut = new BN(expectedOutPut);
        const { aliceUSDC, masterAMM, ammUsdcWallet } = await initAMM(); //create

        const jettonAmount = new BN(251);
        const transferResponse = await aliceUSDC.transferOverloaded(
            alice,
            amm,
            jettonAmount,
            amm,
            undefined,
            new BN(101),
            OPS.SWAP_TOKEN,
            minAmountOut
        );

        const jettonMsg = actionToMessage2(
            aliceUSDC.address as Address,
            transferResponse.actions[0]
        );
        const transferUsdcResult = await ammUsdcWallet.sendInternalMessage(jettonMsg);

        const msgTransferUsdcToAmm = actionToMessage2(
            ammUsdcWallet.address as Address,
            transferUsdcResult.actions[2]
        );

        let ammSwapTokenResponse = await masterAMM.sendInternalMessage(msgTransferUsdcToAmm);
        expect(ammSwapTokenResponse.exit_code).toBe(0); // expect to fail
        let sendTonAfterSwapMessage = ammSwapTokenResponse.actions[0] as SendMsgOutAction;
        const { amount } = parseJettonTransfer(sendTonAfterSwapMessage.message.body);

        //@ts-ignore
        expect(amount.toString()).toBe(jettonAmount.toString());
    });

    it("swaps TON to USDC", async () => {
        const tokensAfterSwap = new BN("45");
        const { aliceUSDC, masterAMM, ammUsdcWallet } = await initAMM(); //create

        const swapTonResp = await masterAMM.swapTon(
            alice,
            new BN(100000000),
            new BN(tokensAfterSwap)
        );

        const ammUsdcResponseAfterSwap = await ammUsdcWallet.sendInternalMessage(
            actionToMessage(alice, amm, swapTonResp.actions[0])
        );

        const aliceUsdcData1 = await aliceUSDC.getData();
        const aliceUsdcTransferResponse = await aliceUSDC.sendInternalMessage(
            actionToMessage(alice, amm, ammUsdcResponseAfterSwap.actions[0])
        );
        expect(aliceUsdcTransferResponse.exit_code).toBe(0);

        const aliceUsdcData2 = await aliceUSDC.getData();

        expect(aliceUsdcData2.balance.toString()).toBe(
            aliceUsdcData1.balance.add(tokensAfterSwap).toString()
        );
    });

    it("swaps TON to USDC min amount out should fail", async () => {
        const tokensAfterSwap = new BN("51");
        const { masterAMM } = await initAMM(); //create
        const amountOfTon = new BN(100000000);
        const swapTonResp = await masterAMM.swapTon(alice, amountOfTon, new BN(tokensAfterSwap));

        const sendTonBackMessage = swapTonResp.actions[0] as SendMsgOutAction;

        expect(amountOfTon.toString()).toBe(
            // @ts-ignore
            sendTonBackMessage.message.info?.value.coins.toString()
        );
    });

    it("call rewards getter for token", async () => {
        const expectedRewards = "172800";
        const { masterAMM, lpWallet } = await initAMM(); //create

        // fast forward time in 24 hours.
        masterAMM.setUnixTime(toUnixTime(Date.now() + 3600000 * 24));
        const lpData = await lpWallet.getData();

        const oneDay = new BN(3600 * 24);
        const rewards = await masterAMM.rewardsOf(lpData.balance, oneDay);
        expect(rewards.tokenRewards.toString()).toBe(expectedRewards);
    });

    it("call rewards getter for protocol", async () => {
        const expectedRewards = "172800";
        const { masterAMM, lpWallet } = await initAMM(new BN(0), new BN(500)); //create

        // fast forward time in 24 hours.
        masterAMM.setUnixTime(toUnixTime(Date.now() + 3600000 * 24));
        const lpData = await lpWallet.getData();

        const oneDay = new BN(3600 * 24);
        const rewards = await masterAMM.rewardsOf(lpData.balance, oneDay);
        expect(rewards.protocolRewards.toString()).toBe(expectedRewards);
    });

    it("claim rewards", async () => {
        const expectedRewards = "172800";
        const { masterAMM, lpWallet } = await initAMM(new BN(500), new BN(0)); //create

        // fast forward time in 24 hours.
        const oneDaySeconds = 3600 * 24;
        lpWallet.forwardTime(oneDaySeconds);
        const lpData = await lpWallet.getData();

        const rewards = await masterAMM.rewardsOf(lpData.balance, new BN(oneDaySeconds));
        expect(rewards.tokenRewards.toString()).toBe(expectedRewards);
        const walletClaimRewardsResponse = await lpWallet.claimRewards(alice, amm);

        let msg = actionToMessage(alice, amm, walletClaimRewardsResponse.actions[0]);
        let ammResponse = await masterAMM.sendInternalMessage(msg);
        //@ts-ignore
        let action = ammResponse.actions[0] as SuccessfulExecutionResult;
        const transferData = parseJettonTransfer(action.message.body);
        expect(transferData.amount.toString()).toBe(expectedRewards);
    });

    it("auto claim rewards on lp balance change - data should be rested to now() after balance change", async () => {
        const lpSize = 708519;
        const { masterAMM, lpWallet, aliceUSDC, ammUsdcWallet } = await initAMM(
            new BN(500),
            new BN(0)
        ); //create

        // fast forward time in 24 hours.

        const lpData = await lpWallet.getData();
        const oneDaySeconds = 3600 * 24;
        lpWallet.forwardTime(oneDaySeconds);
        const { stakeStart } = lpData;
        await addLiquidity(aliceUSDC, ammUsdcWallet, masterAMM, lpWallet, `${lpSize * 2}`);

        const lpWalletData = await lpWallet.getData();
        // data should be rested to now() after balance change
        expect(lpWalletData.stakeStart.toString()).toBe(
            lpData.stakeStart.add(new BN(oneDaySeconds)).toString()
        );
    });

    it("auto claim rewards on lp balance change - rewards should be sent upon balance change", async () => {
        const expectedRewards = "172800";
        const { masterAMM, lpWallet, aliceUSDC, ammUsdcWallet } = await initAMM(
            new BN(500),
            new BN(0)
        ); //create

        // fast forward time in 24 hours.

        const lpData = await lpWallet.getData();
        const oneDaySeconds = 3600 * 24;
        lpWallet.forwardTime(oneDaySeconds);
        const { stakeStart } = lpData;

        const { lpWalletResponse } = await addLiquidity(
            aliceUSDC,
            ammUsdcWallet,
            masterAMM,
            lpWallet,
            `${708519 * 2}`
        );

        const claimRewardsNotificationAction = lpWalletResponse.actions[2] as SendMsgOutAction;
        const msgSlice = claimRewardsNotificationAction.message.body.beginParse();
        expect(msgSlice.readUint(32).toNumber()).toBe(OPS.ClaimRewardsNotification);
        msgSlice.readUint(64); //query-id
        expect(msgSlice.readAddress()?.toFriendly()).toBe(alice.toFriendly());
        expect(msgSlice.readCoins().toString()).toBe(`${708519}`);
        expect(msgSlice.readUint(64).toString()).toBe(`${oneDaySeconds}`);
    });

    it("auto claim rewards on lp transfer - rewards should be sent upon transfer", async () => {
        const expectedRewards = "172800";
        const expectedLP = "708519";
        const { masterAMM, lpWallet, aliceUSDC, ammUsdcWallet } = await initAMM(
            new BN(500),
            new BN(0)
        ); //create

        const lpData = await lpWallet.getData();
        const { stakeStart, balance } = lpData;
        const oneDaySeconds = 3600 * 24;
        const time = lpWallet.forwardTime(oneDaySeconds);
        expect(lpData.stakeStart.toNumber()).toBe(time - 3600 * 24);

        expect(balance.toString()).toBe(expectedLP);
        await lpWallet.transfer(alice, rewardsWallet, lpData.balance, amm, new BN(0));
        const lpWalletAfterTransfer = await lpWallet.getData();
        expect(lpWalletAfterTransfer.balance.toString()).toBe("0");
        expect(lpWalletAfterTransfer.stakeStart.toNumber()).toBe(time);
    });
});

async function createBaseContracts() {
    const masterUSDC = await JettonMinter.create(new BN(0), alice, "https://ipfs.io/ipfs/dasadas");
    const mintResponse = await masterUSDC.mint(alice, alice, new BN(ALICE_INITIAL_BALANCE));
    const mintMessage = mintResponse.actions[0] as SendMsgOutAction;
    //send the transfer message to the contract
    const initTransferMessage = actionToInternalMessage(
        amm,
        aliceSubWallet,
        mintMessage.message?.body
    );
    // Deploy USDC Sub wallet based on the output action from the mint result,
    // so we take the output message and initiate a contract based on the code data and init state and save reference to it
    let aliceUSDC = await JettonWallet.createFromMessage(
        mintMessage.message?.init?.code as Cell,
        mintMessage.message?.init?.data as Cell,
        initTransferMessage
    );

    return {
        masterUSDC,
        aliceUSDC,
    };
}

async function createAmm(tokenRewardsRate = new BN(500), protocolRewardsRate = new BN(0)) {
    return await AmmMinter.create2(
        "https://ipfs.io/ipfs/dasadas",
        rewardsWallet,
        tokenRewardsRate, // protocol rewards
        protocolWallet,
        protocolRewardsRate
    );
}

async function initAMM(tokenRewardsRate = new BN(500), protocolRewardsRate = new BN(0)) {
    const { aliceUSDC } = await createBaseContracts();

    let aliceData = await aliceUSDC.getData();

    const transferWithAddLiquidityResponse = await aliceUSDC.transferOverloaded(
        alice,
        amm,
        new BN(502),
        amm,
        undefined,
        new BN(101),
        OPS.ADD_LIQUIDITY,
        new BN(5) // slippage
    );

    const jettonTransferToAmmWallet = transferWithAddLiquidityResponse
        .actions[0] as SendMsgOutAction;

    const jettonInternalTransferMessage = actionToMessage2(
        amm,
        transferWithAddLiquidityResponse.actions[0]
    );

    const ammUsdcWallet = await JettonWallet.createFromMessage(
        jettonTransferToAmmWallet.message?.init?.code as Cell,
        jettonTransferToAmmWallet.message?.init?.data as Cell,
        jettonInternalTransferMessage
    );

    const masterAMM = await createAmm(tokenRewardsRate, protocolRewardsRate);
    const { tokenWalletAddress } = await masterAMM.getData();
    expect(tokenWalletAddress).toBe(ZERO_ADDRESS.toFriendly());

    //const ammUsdcData = await ammUsdcWallet.getData();
    // console.log(
    //     `ammUsdcData after transfer balance:${ammUsdcData.balance.toString()}  owner: ${sliceToAddress267(
    //         ammUsdcData.owner
    //     ).toFriendly()}`
    // );
    //@ts-ignore
    const transferNotification = ammUsdcWallet.initMessageResult.actions[2] as SendMsgOutAction;

    const msgUsdcToAmm = actionToInternalMessage(
        amm,
        ammUsdcWallet.address as Address,
        transferNotification.message?.body
    );

    let ammRes = await masterAMM.sendInternalMessage(msgUsdcToAmm);
    expect(ammRes.exit_code).toBe(0);

    const ammData = await masterAMM.getData();
    console.log(`ammData 
        tonReservers:${ammData.tonReserves.toString()}
        tokenReserves:${ammData.tokenReserves.toString()}
        totalSupply:${ammData.totalSupply.toString()}
    `);

    let mintLpMessage = ammRes.actions[0] as SendMsgOutAction;

    const lpMsg = actionToInternalMessage(
        mintLpMessage.message?.info.dest as Address,
        contractAddress,
        mintLpMessage.message?.body
    );
    const lpWallet = await AmmLpWallet.createFromMessage(
        mintLpMessage.message?.init?.code as Cell,
        mintLpMessage.message?.init?.data as Cell,
        lpMsg
    );

    let lpData = await lpWallet.getData();
    expect(lpData.balance.toString()).toBe("708519"); // lp amount

    return {
        aliceUSDC,
        masterAMM,
        ammUsdcWallet,
        lpWallet,
    };
}

async function addLiquidity(
    aliceUSDC: JettonWallet,
    ammUsdcWallet: JettonWallet,
    masterAMM: AmmMinter,
    lpWallet: AmmLpWallet,
    expectedLP: string
) {
    const transferResponse = await aliceUSDC.transferOverloaded(
        alice,
        amm,
        new BN(502),
        amm,
        undefined,
        new BN(101),
        OPS.ADD_LIQUIDITY,
        new BN(5) // slippage
    );

    const transferResponseAction = actionToMessage2(amm, transferResponse.actions[0]);
    ammUsdcWallet.sendInternalMessage(transferResponseAction);

    const msgUsdcToAmm = actionToMessage2(
        ammUsdcWallet.address as Address,
        //@ts-ignore
        ammUsdcWallet.initMessageResult.actions[2]
    );
    let ammRes = await masterAMM.sendInternalMessage(msgUsdcToAmm);
    expect(ammRes.exit_code).toBe(0);

    const ammData = await masterAMM.getData();
    console.log(`ammData 
        tonReservers:${ammData.tonReserves.toString()}
        tokenReserves:${ammData.tokenReserves.toString()}
        totalSupply:${ammData.totalSupply.toString()}
    `);

    let mintLpMessage = ammRes.actions[0] as SendMsgOutAction;
    const lpMsg = actionToInternalMessage(amm, contractAddress, mintLpMessage.message?.body);
    const lpWalletResponse = await lpWallet.sendInternalMessage(lpMsg);
    let lpData = await lpWallet.getData();
    expect(lpData.balance.toString()).toBe(expectedLP); // lp amount

    return {
        lpWalletResponse,
    };
}
