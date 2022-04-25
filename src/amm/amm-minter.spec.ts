import { Address, Cell } from "ton";
import BN from "bn.js";
import { JettonMinter } from "../jetton/jetton-minter";
import { AmmMinter } from "./amm-minter";
import { parseJettonTransfer, SendMsgOutAction, sliceToAddress267, toUnixTime } from "../utils";
import { JettonWallet } from "../jetton/jetton-wallet";
import { LpWallet } from "./amm-wallet";
import { actionToInternalMessage, actionToMessage } from "./amm-utils";
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

describe("Jetton Minter ", () => {
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

        const msg = actionToInternalMessage(amm, contractAddress, transferMessage.message?.body);
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
        await initAMM();
    });

    it("removes liquidity", async () => {
        const expectedLP = "708519";

        const { aliceUSDC, masterAMM, ammUsdcWallet, lpWallet } = await initAMM(); //create

        const data = await lpWallet.getData();
        expect(data.balance.toString()).toBe(expectedLP);
        console.log("lp balance ", data.balance.toString());

        const removeLiquidityResponse = await lpWallet.removeLiquidity(
            data.balance,
            alice,
            alice,
            amm
        );

        const removeLiquidityMessage = actionToMessage(
            amm,
            contractAddress,
            removeLiquidityResponse.actions[0]
        );
        const ammResponse = await masterAMM.sendInternalMessage(removeLiquidityMessage);

        let sendTonAfterRemoveLiquidity = ammResponse.actions[0] as SendMsgOutAction;
        console.log(
            "sendTonAfterRemoveLiquidity value=",
            sendTonAfterRemoveLiquidity.message.info?.value.coins.toString()
        );

        const aliceUsdcData1 = await aliceUSDC.getData();
        console.log("aliceUsdcData1", aliceUsdcData1.balance.toString());

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

        const msgTransferUsdcToAmm = actionToMessage(
            amm,
            contractAddress,
            transferUsdcResult.actions[2]
        );

        let ammSwapTokenResponse = await masterAMM.sendInternalMessage(msgTransferUsdcToAmm);
        let sendTonAfterSwapMessage = ammSwapTokenResponse.actions[0] as SendMsgOutAction;

        console.log(
            "sendTonAfterSwapMessage value=", //@ts-ignore
            sendTonAfterSwapMessage.message.info?.value.coins.toString()
        );

        //@ts-ignore
        expect(sendTonAfterSwapMessage.message.info?.value.coins.toString()).toBe(expectedOutPut);
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

        const swapTonResp = await masterAMM.swapTon(
            alice,
            new BN(100000000),
            new BN(tokensAfterSwap)
        );

        expect(swapTonResp.exit_code).toBe(ERROR_CODES.MinAmountOutIsInsufficient);
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

    it.only("claim rewards", async () => {
        const expectedRewards = "172800";
        const { masterAMM, lpWallet } = await initAMM(new BN(500), new BN(0)); //create

        // fast forward time in 24 hours.
        const oneDaySeconds = 3600 * 24;

        lpWallet.forwardTime(oneDaySeconds);
        const lpData = await lpWallet.getData();

        const rewards = await masterAMM.rewardsOf(lpData.balance, new BN(oneDaySeconds));
        expect(rewards.tokenRewards.toString()).toBe(expectedRewards);
        console.log(rewards);

        const walletClaimRewardsResponse = await lpWallet.claimRewards(alice, amm);
        console.log(walletClaimRewardsResponse);

        let msg = actionToMessage(alice, amm, walletClaimRewardsResponse.actions[0]);
        let ammResponse = await masterAMM.sendInternalMessage(msg);
        console.log(ammResponse);

        //@ts-ignore
        let action = ammResponse.actions[0] as SuccessfulExecutionResult;
        console.log(action.message.body);

        const transferData = parseJettonTransfer(action.message.body);
        expect(transferData.amount.toString()).toBe(expectedRewards);
    });
});

async function createBaseContracts(
    tokenRewardsRate = new BN(500),
    protocolRewardsRate = new BN(0)
) {
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

    const masterAMM = await AmmMinter.create(
        alice,
        "https://ipfs.io/ipfs/dasadas",
        rewardsWallet,
        tokenRewardsRate, // protocol rewards
        protocolWallet,
        protocolRewardsRate
    );

    return {
        masterUSDC,
        aliceUSDC,
        masterAMM,
    };
}

async function initAMM(tokenRewardsRate = new BN(500), protocolRewardsRate = new BN(0)) {
    const { aliceUSDC, masterAMM } = await createBaseContracts(
        tokenRewardsRate,
        protocolRewardsRate
    );

    let aliceData = await aliceUSDC.getData();
    console.log(`
    alice owner: ${sliceToAddress267(aliceData.owner).toFriendly()}
    alice balance: ${aliceData.balance.toString()}`);

    const transferResponse = await aliceUSDC.transferOverloaded(
        alice,
        amm,
        new BN(502),
        amm,
        undefined,
        new BN(101),
        OPS.ADD_LIQUIDITY,
        new BN(5)
    );
    const transferMessage = transferResponse.actions[0] as SendMsgOutAction;

    const jettonMsg = actionToInternalMessage(amm, contractAddress, transferMessage.message?.body);
    const ammUsdcWallet = await JettonWallet.createFromMessage(
        transferMessage.message?.init?.code as Cell,
        transferMessage.message?.init?.data as Cell,
        jettonMsg
    );

    const bobUsdcData = await ammUsdcWallet.getData();
    console.log(
        `bobUsdcData after transfer balance:${bobUsdcData.balance.toString()}  owner: ${sliceToAddress267(
            bobUsdcData.owner
        ).toFriendly()}`
    );
    //@ts-ignore
    const transferNotification = ammUsdcWallet.initMessageResult.actions[2] as SendMsgOutAction;
    //  console.log(transferNotification);

    const msgUsdcToAmm = actionToInternalMessage(
        amm,
        contractAddress,
        transferNotification.message?.body
    );

    let ammRes = await masterAMM.sendInternalMessage(msgUsdcToAmm);
    const ammData = await masterAMM.getData();
    console.log(`ammData 
        tonReservers:${ammData.tonReserves.toString()}
        tokenReserves:${ammData.tokenReserves.toString()}
        totalSupply:${ammData.totalSupply.toString()}
    `);

    let mintLpMessage = ammRes.actions[0] as SendMsgOutAction;

    const lpMsg = actionToInternalMessage(amm, contractAddress, mintLpMessage.message?.body);
    const lpWallet = await LpWallet.createFromMessage(
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
