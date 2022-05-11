import { Address, Cell, fromNano, toNano } from "ton";
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
const alice = Address.parse("EQCLjyIQ9bF5t9h3oczEX3hPVK4tpW2Dqby0eHOH1y5_Nvb7");
const liyi = Address.parse("EQDrjaLahLkMB-hMCmkzOyBuHJ139ZUYmPHu6RRBKnbdLIYI");
const amm = Address.parse("EQCbPJVt83Noxmg8Qw-Ut8HsZ1lz7lhp4k0v9mBX2BJewhpe");

const ALICE_INITIAL_BALANCE = toNano(3500);
const JETTON_LIQUIDITY = toNano(1000);
const TON_LIQUIDITY = toNano(500);
const LP_DEFAULT_AMOUNT = 707071424963;
const EXPECTED_REWARDS = "499999999996800";
const aliceSubWallet = Address.parseFriendly("EQCLjyIQ9bF5t9h3oczEX3hPVK4tpW2Dqby0eHOH1y5_Nvb7").address;

const ZERO_ADDRESS = Address.parse("EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c");

describe("Jetton Minter ", () => {
    it("mint USDC", async () => {
        const { masterUSDC, aliceUSDC } = await createBaseContracts();

        const jettonWalletResponse = await aliceUSDC.getData();

        ///////// mint again
        let mintAmount = toNano(2505);
        await masterUSDC.mint(alice, alice, mintAmount);

        const data = await masterUSDC.getData();
        expect(data.totalSupply.toString()).toBe(mintAmount.add(ALICE_INITIAL_BALANCE).toString());
        // const mintMessageRAW = actionToMessage(amm, contractAddress, mintResponse2.actions[0]);

        // const mintMessageResponse2 = await aliceUSDC.sendInternalMessage(mintMessageRAW);
        // expect(mintMessageResponse2.exit_code).toBe(0);

        // const data2 = await aliceUSDC.getData();
        // console.log(`jettonWalletResponse2  (after send #2) balance:${data2.balance.toString()}`);
    });

    it("mint USDC", async () => {
        const { masterUSDC, aliceUSDC } = await createBaseContracts();

        const jettonWalletResponse = await aliceUSDC.getData();

        ///////// mint again
        const jettonAmount = new BN(2505);

        const mintResponse2 = await masterUSDC.mint(alice, alice, jettonAmount);
        const mintMessageRAW = actionToMessage(amm, contractAddress, mintResponse2.actions[0]);

        const mintMessageResponse2 = await aliceUSDC.sendInternalMessage(mintMessageRAW);
        expect(mintMessageResponse2.exit_code).toBe(0);

        const data2 = await aliceUSDC.getData();
        expect(data2.balance.toString()).toBe(ALICE_INITIAL_BALANCE.add(jettonAmount).toString());
    });

    it("send bob USDC", async () => {
        const { aliceUSDC } = await createBaseContracts();

        const jettonAmount = new BN(502);
        const transferResponse = await aliceUSDC.transferOverloaded(
            alice,
            amm,
            jettonAmount,
            amm,
            undefined,
            new BN(100000000),
            OPS.ADD_LIQUIDITY,
            new BN(5)
        );

        const transferMessage = transferResponse.actions[0] as SendMsgOutAction;

        const msg = actionToInternalMessage(amm, transferMessage.message?.info.dest as Address, transferMessage.message?.body);
        const bobUSDC = await JettonWallet.createFromMessage(
            transferMessage.message?.init?.code as Cell,
            transferMessage.message?.init?.data as Cell,
            msg
        );

        const bobUsdcData = await bobUSDC.getData();
        expect(bobUsdcData.balance.toString()).toBe(jettonAmount.toString());
    });

    it("adds Liquidity", async () => {
        const { masterAMM, ammUsdcWallet } = await initAMM({});

        const { tokenWalletAddress } = await masterAMM.getData();

        expect(tokenWalletAddress).toBe(ammUsdcWallet.address?.toFriendly());
    });

    it("removes liquidity", async () => {
        const { aliceUSDC, masterAMM, ammUsdcWallet, lpWallet } = await initAMM({}); //create

        const { balance: lpBalance } = await lpWallet.getData();
        expect(lpBalance.toString()).toBe(LP_DEFAULT_AMOUNT.toString());
        const removeLiquidityResponse = await lpWallet.removeLiquidity(lpBalance, alice, alice, amm);

        const removeLiquidityNotification = actionToMessage(amm, lpWallet.address as Address, removeLiquidityResponse.actions[0]);

        const ammResponse = await masterAMM.sendInternalMessage(removeLiquidityNotification);
        expect(ammResponse.exit_code).toBe(0);
        let sendTonAfterRemoveLiquidity = ammResponse.actions[0] as SendMsgOutAction;
        //@ts-ignore
        expect(sendTonAfterRemoveLiquidity.message.info.value.coins.toString());

        const usdcResponseAfterAddLiquidity = await ammUsdcWallet.sendInternalMessage(actionToMessage(alice, amm, ammResponse.actions[1]));
        await aliceUSDC.sendInternalMessage(actionToMessage(alice, amm, usdcResponseAfterAddLiquidity.actions[0]));
        const aliceUsdcData2 = await aliceUSDC.getData();
        expect(aliceUsdcData2.balance.toString()).toBe(ALICE_INITIAL_BALANCE.toString());
    });

    it("swap usdc to TON", async () => {
        const jettonToSwap = toNano(51);
        const { aliceUSDC, masterAMM, ammUsdcWallet } = await initAMM({}); //create
        const { tonReserves, tokenReserves } = await masterAMM.getData();
        const { minAmountOut } = await masterAMM.getAmountOut(jettonToSwap, tokenReserves, tonReserves);

        const transferResponse = await aliceUSDC.transferOverloaded(
            alice,
            amm,
            jettonToSwap,
            amm,
            undefined,
            new BN(101),
            OPS.SWAP_TOKEN,
            minAmountOut
        );

        const internalTransferMessage = actionToMessage(amm, contractAddress, transferResponse.actions[0]);

        const transferUsdcResult = await ammUsdcWallet.sendInternalMessage(internalTransferMessage);

        const transferNotificationMessage = actionToMessage2(ammUsdcWallet.address as Address, transferUsdcResult.actions[2]);

        let ammSwapTokenResponse = await masterAMM.sendInternalMessage(transferNotificationMessage);

        expect(ammSwapTokenResponse.exit_code).toBe(0);
        let sendTonAfterSwapMessage = ammSwapTokenResponse.actions[0] as SendMsgOutAction;

        //@ts-ignore
        expect(sendTonAfterSwapMessage.message.info?.value.coins.toString()).toBe(minAmountOut.toString());
    });

    it("swap usdc to TON and revert", async () => {
        const expectedOutPut = "3266599999999";
        const minAmountOut = new BN(expectedOutPut);
        const { aliceUSDC, masterAMM, ammUsdcWallet } = await initAMM({}); //create

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

        const jettonMsg = actionToMessage2(aliceUSDC.address as Address, transferResponse.actions[0]);
        const transferUsdcResult = await ammUsdcWallet.sendInternalMessage(jettonMsg);

        const msgTransferUsdcToAmm = actionToMessage2(ammUsdcWallet.address as Address, transferUsdcResult.actions[2]);

        const ammSwapTokenResponse = await masterAMM.sendInternalMessage(msgTransferUsdcToAmm);
        expect(ammSwapTokenResponse.exit_code).toBe(0); // expect to fail
        const sendTonAfterSwapMessage = ammSwapTokenResponse.actions[0] as SendMsgOutAction;
        const { amount } = parseJettonTransfer(sendTonAfterSwapMessage.message.body);

        //@ts-ignore
        expect(amount.toString()).toBe(jettonAmount.toString());
    });

    it("swap TON to USDC", async () => {
        const { aliceUSDC, masterAMM, ammUsdcWallet } = await initAMM({}); //create

        let tonSide = toNano(1);

        const { tonReserves, tokenReserves } = await masterAMM.getData();
        const { minAmountOut } = await masterAMM.getAmountOut(tonSide, tonReserves, tokenReserves);
        const price = tonReserves.div(tokenReserves);

        const swapTonResp = await masterAMM.swapTon(alice, tonSide, minAmountOut);

        const ammUsdcResponseAfterSwap = await ammUsdcWallet.sendInternalMessage(actionToMessage(alice, amm, swapTonResp.actions[0]));

        const aliceUsdcData1 = await aliceUSDC.getData();

        const aliceUsdcTransferResponse = await aliceUSDC.sendInternalMessage(
            actionToMessage(alice, amm, ammUsdcResponseAfterSwap.actions[0])
        );
        expect(aliceUsdcTransferResponse.exit_code).toBe(0);

        const aliceUsdcData2 = await aliceUSDC.getData();
        console.log(aliceUsdcData2.balance.toString());

        expect(aliceUsdcData2.balance.toString()).toBe(aliceUsdcData1.balance.add(minAmountOut).toString());
    });

    it("swap TON to USDC min amount out should fail, expecting the funds to be sent back", async () => {
        const { masterAMM } = await initAMM({}); //create
        let tonSide = toNano(1);
        const swapTonResp = await masterAMM.swapTon(alice, tonSide, toNano(3));
        const sendTonBackMessage = swapTonResp.actions[0] as SendMsgOutAction;
        // @ts-ignore
        console.log(swapTonResp.actions[0].message.info);
        // @ts-ignore
        // expecting funds to be sent back
        expect(sendTonBackMessage.message.info?.value.coins.toString()).toBe(tonSide.toString());
        // expecting destination to be alice ( sender is receiving the funds)
        // @ts-ignore
        expect(sendTonBackMessage.message.info?.dest.toFriendly()).toBe(alice.toFriendly());
    });

    it("call rewards getter for token", async () => {
        const { masterAMM, lpWallet } = await initAMM({}); //create

        // fast forward time in 24 hours.
        masterAMM.setUnixTime(toUnixTime(Date.now() + 3600000 * 24));
        const lpData = await lpWallet.getData();

        const oneDay = new BN(3600 * 24);
        const rewards = await masterAMM.rewardsOf(lpData.balance, oneDay);
        expect(rewards.tokenRewards.toString()).toBe(EXPECTED_REWARDS);
    });

    it("call rewards getter for protocol", async () => {
        const { masterAMM, lpWallet } = await initAMM({
            tokenRewardsRate: new BN(0),
            protocolRewardsRate: new BN(500),
        }); //create

        // fast forward time in 24 hours.
        masterAMM.setUnixTime(toUnixTime(Date.now() + 3600000 * 24));
        const lpData = await lpWallet.getData();

        const oneDay = new BN(3600 * 24);
        const rewards = await masterAMM.rewardsOf(lpData.balance, oneDay);
        expect(rewards.protocolRewards.toString()).toBe(EXPECTED_REWARDS);
    });

    it("claim rewards", async () => {
        const { masterAMM, lpWallet } = await initAMM({
            tokenRewardsRate: new BN(500),
            protocolRewardsRate: new BN(0),
        }); //create

        // fast forward time in 24 hours.
        const oneDaySeconds = 3600 * 24;
        lpWallet.forwardTime(oneDaySeconds);
        const lpData = await lpWallet.getData();

        const rewards = await masterAMM.rewardsOf(lpData.balance, new BN(oneDaySeconds));
        expect(rewards.tokenRewards.toString()).toBe(EXPECTED_REWARDS);
        const walletClaimRewardsResponse = await lpWallet.claimRewards(alice, amm);

        let msg = actionToMessage(alice, amm, walletClaimRewardsResponse.actions[0]);
        let ammResponse = await masterAMM.sendInternalMessage(msg);
        //@ts-ignore
        let action = ammResponse.actions[0] as SuccessfulExecutionResult;
        const transferData = parseJettonTransfer(action.message.body);
        expect(transferData.amount.toString()).toBe(EXPECTED_REWARDS);
    });

    it("auto claim rewards on lp balance change - data should be rested to now() after balance change", async () => {
        const lpSize = LP_DEFAULT_AMOUNT;
        const { masterAMM, lpWallet, aliceUSDC, ammUsdcWallet } = await initAMM({
            tokenRewardsRate: new BN(500),
            protocolRewardsRate: new BN(0),
        }); //create

        // fast forward time in 24 hours.

        const lpData = await lpWallet.getData();
        const oneDaySeconds = 3600 * 24;
        lpWallet.forwardTime(oneDaySeconds);
        const { stakeStart } = lpData;
        await addLiquidity(aliceUSDC, ammUsdcWallet, masterAMM, lpWallet, `${lpSize * 2}`);

        const lpWalletData = await lpWallet.getData();
        // data should be rested to now() after balance change
        expect(lpWalletData.stakeStart.toString()).toBe(lpData.stakeStart.add(new BN(oneDaySeconds)).toString());
    });

    it("add liquidity twice", async () => {
        const lpSize = LP_DEFAULT_AMOUNT;
        const { masterAMM, lpWallet, aliceUSDC, ammUsdcWallet } = await initAMM({}); //create
        let alRes = await addLiquidity(aliceUSDC, ammUsdcWallet, masterAMM, lpWallet, `${lpSize * 2}`);
        expect(alRes.addLiquidityMessage.exit_code).toBe(0);

        const lpWalletData = await lpWallet.getData();
        // data should be rested to now() after balance change
        expect(lpWalletData.balance.toString()).toBe(`${lpSize * 2}`);
    });

    it("add liquidity twice and fail", async () => {
        const lpSize = LP_DEFAULT_AMOUNT;
        const jettonLiquidity = JETTON_LIQUIDITY;
        const tonLiquidity = TON_LIQUIDITY;

        const { masterAMM, lpWallet, aliceUSDC, ammUsdcWallet } = await initAMM({
            jettonLiquidity: jettonLiquidity,
            tonLiquidity: tonLiquidity,
        }); //create

        let amm0 = await masterAMM.getData();
        printAmmData(amm0);

        let alRes = await addLiquidity(aliceUSDC, ammUsdcWallet, masterAMM, lpWallet, `${lpSize * 2}`);

        let amm1 = await masterAMM.getData();
        printAmmData(amm1);
        expect(alRes.addLiquidityMessage.exit_code).toBe(0);

        await addLiquidity(
            aliceUSDC,
            ammUsdcWallet,
            masterAMM,
            lpWallet,
            `${lpSize * 3}`,
            JETTON_LIQUIDITY.sub(toNano(100)),
            tonLiquidity,
            new BN(6),
            ERROR_CODES.ADD_LIQUIDITY_INSUFFICIENT_BALANCE
        );

        let ammData2 = await masterAMM.getData();
        printAmmData(ammData2);

        const lpWalletData = await lpWallet.getData();
        expect(lpWalletData.balance.toString()).toBe(`${lpSize * 2}`);
    });

    it("add liquidity from a bad source wallet", async () => {
        const lpSize = LP_DEFAULT_AMOUNT;
        const jettonLiquidity = JETTON_LIQUIDITY;
        const tonLiquidity = TON_LIQUIDITY;

        const { masterAMM, lpWallet, aliceUSDC, ammUsdcWallet } = await initAMM({
            jettonLiquidity: jettonLiquidity,
            tonLiquidity: tonLiquidity,
        }); //create

        let amm0 = await masterAMM.getData();
        printAmmData(amm0);

        await addLiquidity(
            aliceUSDC,
            ammUsdcWallet,
            masterAMM,
            lpWallet,
            `${lpSize * 2}`,
            JETTON_LIQUIDITY,
            TON_LIQUIDITY,
            new BN(5),
            ERROR_CODES.ADD_LIQUIDITY_WRONG_JETTON_SENDER,
            liyi
        );
    });

    it("auto claim rewards on lp balance change - rewards should be sent upon balance change", async () => {
        const expectedRewards = "499999999996800";
        const { masterAMM, lpWallet, aliceUSDC, ammUsdcWallet } = await initAMM({}); //create

        // fast forward time in 24 hours.

        const lpData = await lpWallet.getData();
        const oneDaySeconds = 3600 * 24;
        lpWallet.forwardTime(oneDaySeconds);
        const { stakeStart } = lpData;

        const { lpWalletResponse } = await addLiquidity(aliceUSDC, ammUsdcWallet, masterAMM, lpWallet, `${LP_DEFAULT_AMOUNT * 2}`);

        const claimRewardsNotificationAction = lpWalletResponse.actions[2] as SendMsgOutAction;
        const msgSlice = claimRewardsNotificationAction.message.body.beginParse();
        expect(msgSlice.readUint(32).toNumber()).toBe(OPS.ClaimRewardsNotification);
        msgSlice.readUint(64); //query-id
        expect(msgSlice.readAddress()?.toFriendly()).toBe(alice.toFriendly());
        expect(msgSlice.readCoins().toString()).toBe(`${LP_DEFAULT_AMOUNT}`);
        expect(msgSlice.readUint(64).toString()).toBe(`${oneDaySeconds}`);
    });

    it("auto claim rewards on lp transfer - rewards should be sent upon transfer", async () => {
        const expectedRewards = "499999999996800";

        const { masterAMM, lpWallet, aliceUSDC, ammUsdcWallet } = await initAMM({}); //create

        const lpData = await lpWallet.getData();
        const { stakeStart, balance } = lpData;
        const oneDaySeconds = 3600 * 24;
        const time = lpWallet.forwardTime(oneDaySeconds);
        expect(lpData.stakeStart.toNumber()).toBe(time - 3600 * 24);

        expect(balance.toString()).toBe(LP_DEFAULT_AMOUNT.toString());
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
    const initTransferMessage = actionToInternalMessage(amm, aliceSubWallet, mintMessage.message?.body);
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

async function initAMM({
    jettonLiquidity = JETTON_LIQUIDITY,
    tonLiquidity = TON_LIQUIDITY,
    addLiquiditySlippage = new BN(5),
    tokenRewardsRate = new BN(500),
    protocolRewardsRate = new BN(0),
}) {
    const { aliceUSDC } = await createBaseContracts();
    const transferWithAddLiquidityResponse = await aliceUSDC.transferOverloaded(
        alice,
        amm,
        jettonLiquidity,
        amm,
        undefined,
        tonLiquidity,
        OPS.ADD_LIQUIDITY,
        addLiquiditySlippage // slippage
    );

    const jettonTransferToAmmWallet = transferWithAddLiquidityResponse.actions[0] as SendMsgOutAction;

    const jettonInternalTransferMessage = actionToMessage2(amm, transferWithAddLiquidityResponse.actions[0]);

    const ammUsdcWallet = await JettonWallet.createFromMessage(
        jettonTransferToAmmWallet.message?.init?.code as Cell,
        jettonTransferToAmmWallet.message?.init?.data as Cell,
        jettonInternalTransferMessage
    );

    const masterAMM = await AmmMinter.create2(
        "https://ipfs.io/ipfs/dasadas",
        rewardsWallet,
        tokenRewardsRate, // protocol rewards
        protocolWallet,
        protocolRewardsRate
    );

    const { tokenWalletAddress } = await masterAMM.getData();
    expect(tokenWalletAddress).toBe(ZERO_ADDRESS.toFriendly());

    //@ts-ignore
    const transferNotificationAction = ammUsdcWallet.initMessageResult.actions[0] as SendMsgOutAction;

    const usdcToAmmTransferNotification = actionToInternalMessage(
        amm,
        ammUsdcWallet.address as Address,
        transferNotificationAction.message?.body,
        tonLiquidity
    );

    let ammRes = await masterAMM.sendInternalMessage(usdcToAmmTransferNotification);
    expect(ammRes.exit_code).toBe(0);

    const ammData = await masterAMM.getData();
    printAmmData(ammData);

    let mintLpMessage = ammRes.actions[0] as SendMsgOutAction;

    const lpMsg = actionToInternalMessage(mintLpMessage.message?.info.dest as Address, contractAddress, mintLpMessage.message?.body);
    const lpWallet = await AmmLpWallet.createFromMessage(
        mintLpMessage.message?.init?.code as Cell,
        mintLpMessage.message?.init?.data as Cell,
        lpMsg
    );

    let lpData = await lpWallet.getData();
    expect(lpData.balance.toString()).toBe(LP_DEFAULT_AMOUNT.toString()); // lp amount

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
    expectedLP: string,
    jettonLiquidity = JETTON_LIQUIDITY,
    tonLiquidity = TON_LIQUIDITY,
    slippage = new BN(5),
    addLiquidityExitCode = 0,
    jettonSenderOverride?: Address
) {
    tonLiquidity = tonLiquidity.add(toNano(0.1));

    const transferResponse = await aliceUSDC.transferOverloaded(
        alice,
        amm,
        jettonLiquidity,
        amm,
        undefined,
        tonLiquidity,
        OPS.ADD_LIQUIDITY,
        slippage
    );

    expect(transferResponse.exit_code).toBe(0);

    const internalTransferMessage = actionToMessage2(amm, transferResponse.actions[0], tonLiquidity);
    const ammUsdcWalletResponse = await ammUsdcWallet.sendInternalMessage(internalTransferMessage);
    // @ts-ignore
    const usdcToAmmTransferNotification = actionToMessage2(
        jettonSenderOverride || (ammUsdcWallet.address as Address),
        //@ts-ignore
        ammUsdcWalletResponse.actions[0],
        tonLiquidity
    );
    let transferNotificationRes = await masterAMM.sendInternalMessage(usdcToAmmTransferNotification);

    console.log(transferNotificationRes);

    expect(transferNotificationRes.exit_code).toBe(addLiquidityExitCode);
    if (addLiquidityExitCode > 0) {
        return {
            addLiquidityMessage: transferNotificationRes,
        };
    }

    let mintLpMessage = transferNotificationRes.actions[0] as SendMsgOutAction;
    const lpMsg = actionToInternalMessage(amm, contractAddress, mintLpMessage.message?.body);
    const lpWalletResponse = await lpWallet.sendInternalMessage(lpMsg);
    let lpData = await lpWallet.getData();

    // expect(lpData.balance.toString()).toBe(expectedLP); // lp amount

    return {
        lpWalletResponse,
        addLiquidityMessage: transferNotificationRes,
    };
}

function printAmmData(data: { tonReserves: BN; tokenReserves: BN; totalSupply: BN }) {
    console.log(`ammData 
        tonReservers:${fromNano(data.tonReserves).toString()}
        tokenReserves:${fromNano(data.tokenReserves).toString()}
        totalSupply:${fromNano(data.totalSupply).toString()}
    `);
}
