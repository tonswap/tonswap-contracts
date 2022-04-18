import { Address, Cell } from "ton";
import BN from "bn.js";
import { JettonMinter } from "../jetton/jetton-minter";
import { AmmMinter } from "./amm-minter";
import { SendMsgOutAction, sliceToAddress267 } from "../utils";
import { JettonWallet } from "../jetton/jetton-wallet";
import { LpWallet } from "./amm-wallet";
import { actionToInternalMessage as actionToMessage } from "./amm-utils";
import { OPS } from "./ops";

const contractAddress = Address.parse("EQD4FPq-PRDieyQKkizFTRtSDyucUIqrj0v_zXJmqaDp6_0t");
const minterAddress = Address.parse("EQD4FPq-PRDieyQKkizFTRtSDyucUIqrj0v_zXJmqaDp6_0t");
const alice = Address.parseFriendly("EQCLjyIQ9bF5t9h3oczEX3hPVK4tpW2Dqby0eHOH1y5_Nvb7").address;
const amm = Address.parseFriendly("EQCbPJVt83Noxmg8Qw-Ut8HsZ1lz7lhp4k0v9mBX2BJewhpe").address;

const ALICE_INITIAL_BALANCE = 1500;

const aliceSubWallet = Address.parseFriendly(
    "EQCLjyIQ9bF5t9h3oczEX3hPVK4tpW2Dqby0eHOH1y5_Nvb7"
).address;

describe("Jetton Minter ", () => {
    it("mint USDC", async () => {
        const { masterUSDC, aliceUSDC } = await initEnvironment();

        const jettonWalletResponse = await aliceUSDC.getData();
        console.log(
            `jettonWalletResponse  (after send) balance:${jettonWalletResponse.balance.toString()}`
        );

        ///////// mint again
        const mintResponse2 = await masterUSDC.mint(alice, alice, new BN(2505));
        const mintMessage2 = mintResponse2.actions[0] as SendMsgOutAction;
        const mintMessageRAW = actionToMessage(amm, contractAddress, mintMessage2.message?.body);

        const mintMessageResponse2 = await aliceUSDC.sendInternalMessage(mintMessageRAW);
        expect(mintMessageResponse2.exit_code).toBe(0);

        const data2 = await aliceUSDC.getData();
        console.log(`jettonWalletResponse2  (after send #2) balance:${data2.balance.toString()}`);
    });

    it("alice sends bob USDC", async () => {
        const { masterUSDC, aliceUSDC } = await initEnvironment();

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

        const msg = actionToMessage(amm, contractAddress, transferMessage.message?.body);
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

    it("alice adds Liquidity", async () => {
        await addLiquidity();
    });

    it("alice removes liquidity", async () => {
        const expectedLP = "708519";

        const { aliceUSDC, masterAMM, ammUsdcWallet, lpWallet } = await addLiquidity(); //create

        const data = await lpWallet.getData();
        expect(data.balance.toString()).toBe(expectedLP);
        console.log("lp balance ", data.balance.toString());

        const removeLiquidityResponse = await lpWallet.removeLiquidity(
            data.balance,
            alice,
            alice,
            amm
        );

        const removeLiquidityNotification = removeLiquidityResponse.actions[0] as SendMsgOutAction;
        const removeLiquidityMessage = actionToMessage(
            amm,
            contractAddress,
            removeLiquidityNotification.message?.body
        );
        const ammResponse = await masterAMM.sendInternalMessage(removeLiquidityMessage);

        let sendTonAfterRemoveLiquidity = ammResponse.actions[0] as SendMsgOutAction;
        console.log(
            "sendTonAfterRemoveLiquidity value=",
            sendTonAfterRemoveLiquidity.message.info?.value.coins.toString()
        );

        let sendTokensAfterRemoveLiquidity = ammResponse.actions[1] as SendMsgOutAction;

        const aliceUsdcData1 = await aliceUSDC.getData();
        console.log("aliceUsdcData1", aliceUsdcData1.balance.toString());

        const usdcResponseAfterAddLiquidity = await ammUsdcWallet.sendInternalMessage(
            actionToMessage(alice, amm, sendTokensAfterRemoveLiquidity.message?.body)
        );
        const usdcMessageAction = usdcResponseAfterAddLiquidity.actions[0] as SendMsgOutAction;
        await aliceUSDC.sendInternalMessage(
            actionToMessage(alice, amm, usdcMessageAction.message?.body)
        );

        const aliceUsdcData2 = await aliceUSDC.getData();
        expect(aliceUsdcData2.balance.toString()).toBe(ALICE_INITIAL_BALANCE.toString());

        // expect(dataAfter.balance.toString()).toBe('0');
    });

    it("alice swaps usdc to TON", async () => {
        const expectedOutPut = "332665999";
        const minAmountOut = new BN(expectedOutPut);

        const { aliceUSDC, masterAMM, ammUsdcWallet } = await addLiquidity(); //create

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
        const transferMessage = transferResponse.actions[0] as SendMsgOutAction;

        const jettonMsg = actionToMessage(amm, contractAddress, transferMessage.message?.body);
        const transferUsdcResult = await ammUsdcWallet.sendInternalMessage(jettonMsg);

        const bobUsdcData = await ammUsdcWallet.getData();
        console.log(
            `bobUsdcData after transfer balance:${bobUsdcData.balance.toString()}  owner: ${sliceToAddress267(
                bobUsdcData.owner
            ).toFriendly()}`
        );

        const transferNotification = transferUsdcResult.actions[2] as SendMsgOutAction;
        const msgTransferUsdcToAmm = actionToMessage(
            amm,
            contractAddress,
            transferNotification.message?.body
        );

        let ammSwapTokenResponse = await masterAMM.sendInternalMessage(msgTransferUsdcToAmm);
        console.log(ammSwapTokenResponse.actions);

        let sendTonAfterSwapMessage = ammSwapTokenResponse.actions[0] as SendMsgOutAction;
        //@ts-ignore
        console.log(
            "sendTonAfterSwapMessage value=",
            sendTonAfterSwapMessage.message.info?.value.coins.toString()
        );

        //@ts-ignore
        expect(sendTonAfterSwapMessage.message.info?.value.coins.toString()).toBe(expectedOutPut);
    });

    it("alice swaps TON to USDC", async () => {
        const expectedOutPut = "332665999";

        const { aliceUSDC, masterAMM, ammUsdcWallet } = await addLiquidity(); //create
    });
});

async function initEnvironment() {
    const masterUSDC = await JettonMinter.create(new BN(0), alice, "https://ipfs.io/ipfs/dasadas");
    const mintResponse = await masterUSDC.mint(alice, alice, new BN(ALICE_INITIAL_BALANCE));
    const mintMessage = mintResponse.actions[0] as SendMsgOutAction;
    //send the transfer message to the contract
    const initTransferMessage = actionToMessage(amm, aliceSubWallet, mintMessage.message?.body);
    // Deploy USDC Sub wallet based on the output action from the mint result,
    // so we take the output message and initiate a contract based on the code data and init state and save reference to it
    let aliceUSDC = await JettonWallet.createFromMessage(
        mintMessage.message?.init?.code as Cell,
        mintMessage.message?.init?.data as Cell,
        initTransferMessage
    );

    const masterAMM = await AmmMinter.create(new BN(0), alice, "https://ipfs.io/ipfs/dasadas");

    return {
        masterUSDC,
        aliceUSDC,
        masterAMM,
    };
}

async function addLiquidity() {
    const { aliceUSDC, masterAMM } = await initEnvironment();

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

    const jettonMsg = actionToMessage(amm, contractAddress, transferMessage.message?.body);
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

    const msgUsdcToAmm = actionToMessage(amm, contractAddress, transferNotification.message?.body);

    let ammRes = await masterAMM.sendInternalMessage(msgUsdcToAmm);
    const ammData = await masterAMM.getData();
    console.log(`ammData 
        tonReservers:${ammData.tonReserves.toString()}
        tokenReserves:${ammData.tokenReserves.toString()}
        totalSupply:${ammData.totalSupply.toString()}
    `);

    let mintLpMessage = ammRes.actions[0] as SendMsgOutAction;

    const lpMsg = actionToMessage(amm, contractAddress, mintLpMessage.message?.body);
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
