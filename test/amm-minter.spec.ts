import { Address, beginCell, Cell, CellMessage, CommonMessageInfo, fromNano, InternalMessage, toNano } from "ton";
import { SendMsgAction } from "ton-contract-executor";
import BN from "bn.js";
import { JettonMinter } from "../src/jetton-minter";
import { AmmMinterTVM } from "../src/amm-minter";
import { parseJettonTransfer, sliceToAddress } from "../src/utils";
import { JettonWallet } from "../src/jetton-wallet";
import { AmmLpWallet } from "../src/amm-wallet";
import { actionToMessage } from "../src/amm-utils";
import { ERROR_CODES, OPS } from "../src/ops";

const alice = Address.parse("EQCLjyIQ9bF5t9h3oczEX3hPVK4tpW2Dqby0eHOH1y5_Nvb7");
const bob = Address.parse("EQDrjaLahLkMB-hMCmkzOyBuHJ139ZUYmPHu6RRBKnbdLIYI");
const amm = Address.parse("EQCbPJVt83Noxmg8Qw-Ut8HsZ1lz7lhp4k0v9mBX2BJewhpe");

const ALICE_INITIAL_BALANCE = toNano(3500);
const JETTON_LIQUIDITY = toNano(10);
const TON_LIQUIDITY = toNano(5);
const LP_DEFAULT_AMOUNT = 7071067;

const GAS_FEES = {
    ADD_LIQUIDITY: "0.2",
};

const ZERO_ADDRESS = Address.parse("EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c");

describe("Ton Swap Test Suite", () => {
    it("mint USDC", async () => {
        const { masterUSDC } = await createBaseContracts();
        let mintAmount = toNano(2505);
        await masterUSDC.mint(alice, alice, mintAmount);
        const data = await masterUSDC.getData();
        expect(data.totalSupply.toString()).toBe(mintAmount.add(ALICE_INITIAL_BALANCE).toString());
    });

    it("mint USDC", async () => {
        const { masterUSDC, aliceUSDC } = await createBaseContracts();
        const jettonAmount = new BN(2505);
        const mintResponse = await masterUSDC.mint(alice, alice, jettonAmount);
        const mintTransferNotification = actionToMessage(masterUSDC.address, mintResponse.actionList[0]);
        const mintMessageResponse2 = await aliceUSDC.sendInternalMessage(mintTransferNotification);
        expect(mintMessageResponse2.exit_code).toBe(0);
        const data2 = await aliceUSDC.getData();
        expect(data2.balance.toString()).toBe(ALICE_INITIAL_BALANCE.add(jettonAmount).toString());
    });

    it("send bob USDC", async () => {
        const { aliceUSDC } = await createBaseContracts();

        const jettonAmount = new BN(502);
        const transferResponse = await aliceUSDC.transfer(
            alice,
            amm,
            jettonAmount,
            amm,
            undefined,
            new BN(100000000),
            OPS.ADD_LIQUIDITY,
            new BN(5)
        );

        const transferMessage = transferResponse.actionList[0] as SendMsgAction;

        const msg = actionToMessage(aliceUSDC.address, transferResponse.actionList[0]);
        const bobUSDC = await JettonWallet.createFromMessage(
            transferMessage.message?.init?.code as Cell,
            transferMessage.message?.init?.data as Cell,
            msg
        );

        const bobUsdcData = await bobUSDC.getData();
        expect(bobUsdcData.balance.toString()).toBe(jettonAmount.toString());
    });

    it("add Liquidity - jetton wallet should be initialized", async () => {
        const { masterAMM, ammUsdcWallet } = await initAMM({});
        const { tokenWalletAddress } = await masterAMM.getData();
        expect(tokenWalletAddress).toBe(ammUsdcWallet.address?.toFriendly());
    });

    it("removes liquidity", async () => {
        const { aliceUSDC, masterAMM, ammUsdcWallet, lpWallet } = await initAMM({}); //create

        const { balance: lpBalance } = await lpWallet.getData();
        expect(lpBalance.toString()).toBe(LP_DEFAULT_AMOUNT.toString());
        const removeLiquidityResponse = await lpWallet.removeLiquidity(lpBalance, alice, alice, amm);

        const removeLiquidityNotification = actionToMessage(lpWallet.address as Address, removeLiquidityResponse.actionList[0]);
        expect(removeLiquidityResponse.exit_code).toBe(0);

        const ammResponse = await masterAMM.sendInternalMessage(removeLiquidityNotification);
        expect(ammResponse.exit_code).toBe(0);

        let sendTonAfterRemoveLiquidity = ammResponse.actionList[0] as SendMsgAction;

        const transferTokenMessage = actionToMessage(amm, ammResponse.actionList[1], toNano(0.1), true);
        const usdcResponseAfterRemoveLiquidity = await ammUsdcWallet.sendInternalMessage(transferTokenMessage);
        await aliceUSDC.sendInternalMessage(actionToMessage(ammUsdcWallet.address, usdcResponseAfterRemoveLiquidity.actionList[0]));

        const aliceUsdcData2 = await aliceUSDC.getData();
        expect(aliceUsdcData2.balance.toString()).toBe(ALICE_INITIAL_BALANCE.toString());
    });

    // it("removes liquidity - should bounce in case ", async () => {
    //     const { lpWallet } = await initAMM({}); //create

    //     const { balance: lpBalance } = await lpWallet.getData();
    //     expect(lpBalance.toString()).toBe(LP_DEFAULT_AMOUNT.toString());
    //     const removeLiquidityResponse = await lpWallet.removeLiquidity(lpBalance, alice, alice, amm, false);

    //     expect(removeLiquidityResponse.exit_code).toBe(710);
    // });

    it("swap usdc to TON", async () => {
        const jettonToSwap = toNano(51);
        const { aliceUSDC, masterAMM, ammUsdcWallet } = await initAMM({}); //create
        const { tonReserves, tokenReserves } = await masterAMM.getData();
        const { minAmountOut } = await masterAMM.getAmountOut(jettonToSwap, tokenReserves, tonReserves);

        const transferResponse = await aliceUSDC.transfer(
            alice,
            amm,
            jettonToSwap,
            amm,
            undefined,
            new BN(101),
            OPS.SWAP_TOKEN,
            minAmountOut
        );

        const internalTransferMessage = actionToMessage(aliceUSDC.address, transferResponse.actionList[0]);

        const transferUsdcResult = await ammUsdcWallet.sendInternalMessage(internalTransferMessage);

        const transferNotificationMessage = actionToMessage(ammUsdcWallet.address as Address, transferUsdcResult.actionList[0]);

        let ammSwapTokenResponse = await masterAMM.sendInternalMessage(transferNotificationMessage);

        expect(ammSwapTokenResponse.exit_code).toBe(0);
        let sendTonAfterSwapMessage = ammSwapTokenResponse.actionList[0] as SendMsgAction;

        //@ts-ignore
        expect(sendTonAfterSwapMessage.message.info?.value.coins.toString()).toBe(minAmountOut.toString());
    });

    it("swap usdc to TON and revert", async () => {
        const expectedOutPut = "3266599999999";
        const minAmountOut = new BN(expectedOutPut);
        const { aliceUSDC, masterAMM, ammUsdcWallet } = await initAMM({}); //create

        const jettonAmount = new BN(251);
        const transferResponse = await aliceUSDC.transfer(
            alice,
            amm,
            jettonAmount,
            amm,
            undefined,
            new BN(101),
            OPS.SWAP_TOKEN,
            minAmountOut
        );

        const jettonMsg = actionToMessage(aliceUSDC.address as Address, transferResponse.actionList[0]);
        const transferUsdcResult = await ammUsdcWallet.sendInternalMessage(jettonMsg);

        const msgTransferUsdcToAmm = actionToMessage(ammUsdcWallet.address as Address, transferUsdcResult.actionList[0]);

        const ammSwapTokenResponse = await masterAMM.sendInternalMessage(msgTransferUsdcToAmm);
        expect(ammSwapTokenResponse.exit_code).toBe(0); // expect to fail
        const sendTonAfterSwapMessage = ammSwapTokenResponse.actionList[0] as SendMsgAction;

        const { amount } = parseJettonTransfer(sendTonAfterSwapMessage.message.body);

        //@ts-ignore
        expect(amount.toString()).toBe(jettonAmount.toString());
    });

    it("swap TON to USDC", async () => {
        const { aliceUSDC, masterAMM, ammUsdcWallet } = await initAMM({}); //create

        let tonSide = toNano(+1);

        const { tonReserves, tokenReserves } = await masterAMM.getData();
        const { minAmountOut } = await masterAMM.getAmountOut(tonSide, tonReserves, tokenReserves);

        const swapTonResp = await masterAMM.swapTonTVM(alice, tonSide, minAmountOut);
        const transferTokenMessage = actionToMessage(amm, swapTonResp.actionList[0], toNano("0.1"), true);
        const ammUsdcResponseAfterSwap = await ammUsdcWallet.sendInternalMessage(transferTokenMessage);
        expect(ammUsdcResponseAfterSwap.exit_code).toBe(0);

        const aliceUsdcData1 = await aliceUSDC.getData();
        const aliceUsdcTransferResponse = await aliceUSDC.sendInternalMessage(
            actionToMessage(ammUsdcWallet.address, ammUsdcResponseAfterSwap.actionList[0])
        );
        expect(aliceUsdcTransferResponse.exit_code).toBe(0);
        const aliceUsdcData2 = await aliceUSDC.getData();

        expect(aliceUsdcData2.balance.toString()).toBe(aliceUsdcData1.balance.add(minAmountOut).toString());
    });

    it("swap TON to USDC min amount out should fail, expecting the funds to be sent back", async () => {
        const { masterAMM } = await initAMM({}); //create

        let tonSide = toNano(1);
        const ammData = await masterAMM.getData();
        const { minAmountOut } = await masterAMM.getAmountOut(tonSide, ammData.tonReserves, ammData.tokenReserves);
        // exceeded the minAmount out by one
        const swapTonResp = await masterAMM.swapTonTVM(alice, tonSide, minAmountOut.add(new BN(1)));

        const sendTonBackMessage = swapTonResp.actionList[0] as SendMsgAction;
        // @ts-ignore
        // expecting funds to be sent back
        expect(sendTonBackMessage.message.info?.value.coins.toString()).toBe(tonSide.toString());
        // expecting destination to be alice ( sender is receiving the funds)
        // @ts-ignore
        expect(sendTonBackMessage.message.info?.dest.toFriendly()).toBe(alice.toFriendly());
    });

    it("add liquidity twice", async () => {
        const lpSize = LP_DEFAULT_AMOUNT;
        const { masterAMM, lpWallet, aliceUSDC, ammUsdcWallet } = await initAMM({}); //create
        const lpWalletData1 = await lpWallet.getData();
        expect(lpWalletData1.balance.toString()).toBe(`${lpSize}`);
        let ratio = new BN(10);
        let alRes = await addLiquidity(
            aliceUSDC,
            ammUsdcWallet,
            masterAMM,
            lpWallet,
            `${lpSize * 2}`,
            JETTON_LIQUIDITY.div(ratio),
            TON_LIQUIDITY.div(ratio)
        );
        expect(alRes.addLiquidityMessage.exit_code).toBe(0);

        const lpWalletData2 = await lpWallet.getData();
        const ammData2 = await masterAMM.getData();
        expect(lpWalletData2.balance.toString()).toBe(ammData2.totalSupply.toString());
        expect(lpWalletData2.balance.toString()).toBe(`${Math.floor(lpSize * 1.1)}`);
    });

    it("add liquidity twice and fail the second time, send back funds to sender", async () => {
        const lpSize = LP_DEFAULT_AMOUNT;
        const jettonLiquidity = JETTON_LIQUIDITY;
        const tonLiquidity = TON_LIQUIDITY;

        const { masterAMM, lpWallet, aliceUSDC, ammUsdcWallet } = await initAMM({
            jettonLiquidity: jettonLiquidity,
            tonLiquidity: tonLiquidity,
        });

        let amm0 = await masterAMM.getData();
        printAmmData(amm0);

        let alRes = await addLiquidity(aliceUSDC, ammUsdcWallet, masterAMM, lpWallet, `${lpSize * 2}`);

        let amm1 = await masterAMM.getData();
        printAmmData(amm1);
        expect(alRes.addLiquidityMessage.exit_code).toBe(0);

        const tenPercent = JETTON_LIQUIDITY.mul(new BN(900)).div(new BN(1000));
        const jettonLiquidity2 = JETTON_LIQUIDITY.sub(tenPercent);

        const { addLiquidityMessage } = await addLiquidity(
            aliceUSDC,
            ammUsdcWallet,
            masterAMM,
            lpWallet,
            `${lpSize * 3}`,
            jettonLiquidity2,
            tonLiquidity,
            new BN(6)
        );

        // @ts-ignore
        const sendGramsMessage = addLiquidityMessage.actionList[0].message.info.value.coins.toString();
        expect(sendGramsMessage).toBe(TON_LIQUIDITY.toString());

        // @ts-ignore
        const jettonMessage = parseJettonTransfer(addLiquidityMessage.actionList[1]?.message.body);

        expect(jettonMessage.amount.toString()).toBe(jettonLiquidity2.toString());
    });

    it("add liquidity from a bad source wallet", async () => {
        const { masterAMM, lpWallet, aliceUSDC, ammUsdcWallet } = await initAMM({
            jettonLiquidity: JETTON_LIQUIDITY,
            tonLiquidity: TON_LIQUIDITY,
        });

        let amm0 = await masterAMM.getData();
        printAmmData(amm0);

        await addLiquidity(
            aliceUSDC,
            ammUsdcWallet,
            masterAMM,
            lpWallet,
            `${LP_DEFAULT_AMOUNT * 2}`,
            JETTON_LIQUIDITY,
            TON_LIQUIDITY,
            new BN(5),
            ERROR_CODES.ADD_LIQUIDITY_WRONG_JETTON_SENDER,
            bob
        );
    });

    it("add liquidity in sufficient gas money", async () => {
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
            bob
        );
    });

    it("swap TON to USDC not enough value should fail, expecting message to bounced", async () => {
        const { masterAMM } = await initAMM({}); //create

        let tonSide = toNano(1);
        const ammData = await masterAMM.getData();
        const { minAmountOut } = await masterAMM.getAmountOut(tonSide, ammData.tonReserves, ammData.tokenReserves);
        // exceeded the minAmount out by one
        const swapTonResp = await masterAMM.swapTonTVM(alice, tonSide, minAmountOut.add(new BN(1)), tonSide.div(new BN(2)));

        expect(swapTonResp.exit_code).toBe(603);
    });

    // it("should upgrade", async () => {
    //     const { masterAMM } = await initAMM({
    //         jettonLiquidity: JETTON_LIQUIDITY,
    //         tonLiquidity: TON_LIQUIDITY,
    //     });

    //     const upgradeMessage = beginCell().storeUint(OPS.UPGRADE, 32).storeUint(1, 64).storeRef(masterAMM.getCodeUpgrade()[0]).endCell();

    //     let msg = new InternalMessage({
    //         from: alice,
    //         to: amm,
    //         value: new BN(100),
    //         bounce: false,
    //         body: new CommonMessageInfo({
    //             body: new CellMessage(upgradeMessage),
    //         }),
    //     });
    //     let res = await masterAMM.sendInternalMessage(msg);
    //     expect(res.exit_code).toBe(0);

    //     let data = await masterAMM.getHowOld(); // new method after upgrade
    //     expect(data.result.toString()).toBe("36");
    // });

    // it("should upgrade - should throw exception wrong admin", async () => {
    //     const { masterAMM } = await initAMM({
    //         jettonLiquidity: JETTON_LIQUIDITY,
    //         tonLiquidity: TON_LIQUIDITY,
    //     });

    //     const upgradeMessage = beginCell().storeUint(OPS.UPGRADE, 32).storeUint(1, 64).storeRef(masterAMM.getCodeUpgrade()[0]).endCell();

    //     let msg = new InternalMessage({
    //         from: bob,
    //         to: amm,
    //         value: new BN(100),
    //         bounce: false,
    //         body: new CommonMessageInfo({
    //             body: new CellMessage(upgradeMessage),
    //         }),
    //     });
    //     let res = await masterAMM.sendInternalMessage(msg);

    //     expect(res.exit_code).toBe(0xffff);
    // });
});

async function createBaseContracts() {
    const masterUSDC = await JettonMinter.Create(new BN(0), alice, "https://ipfs.io/ipfs/dasadas");
    const mintResponse = await masterUSDC.mint(alice, alice, new BN(ALICE_INITIAL_BALANCE));
    if (!mintResponse) {
        throw "bad mint response";
    }
    const mintMessage = mintResponse.actionList[0] as SendMsgAction;
    //send the transfer message to the contract
    const mintTransferNotification = actionToMessage(masterUSDC.address as Address, mintResponse.actionList[0]);

    // Deploy USDC Sub wallet based on the output action from the mint result,
    // so we take the output message and initiate a contract based on the code data and init state and save reference to it
    let aliceUSDC = await JettonWallet.createFromMessage(
        mintMessage.message?.init?.code as Cell,
        mintMessage.message?.init?.data as Cell,
        mintTransferNotification
    );

    return {
        masterUSDC,
        aliceUSDC,
    };
}

async function initAMM({ jettonLiquidity = JETTON_LIQUIDITY, tonLiquidity = TON_LIQUIDITY, addLiquiditySlippage = new BN(5) }) {
    const { aliceUSDC } = await createBaseContracts();

    const forwardTon = tonLiquidity.add(toNano(GAS_FEES.ADD_LIQUIDITY));
    const transferWithAddLiquidityResponse = await aliceUSDC.transfer(
        alice,
        amm,
        jettonLiquidity,
        amm,
        undefined,
        forwardTon,
        OPS.ADD_LIQUIDITY,
        addLiquiditySlippage, // slippage
        tonLiquidity
    );

    expect(transferWithAddLiquidityResponse.exit_code).toBe(0);

    const jettonTransferToAmmWallet = transferWithAddLiquidityResponse.actionList[0] as SendMsgAction;
    const jettonInternalTransferMessage = actionToMessage(aliceUSDC.address, transferWithAddLiquidityResponse.actionList[0]);

    const ammUsdcWallet = await JettonWallet.createFromMessage(
        jettonTransferToAmmWallet.message?.init?.code as Cell,
        jettonTransferToAmmWallet.message?.init?.data as Cell,
        jettonInternalTransferMessage
    );

    const masterAMM = new AmmMinterTVM("https://ipfs.io/ipfs/dasadas", alice);
    await masterAMM.ready;

    const { tokenWalletAddress } = await masterAMM.getData();
    expect(tokenWalletAddress).toBe(ZERO_ADDRESS.toFriendly());

    const usdcToAmmTransferNotification = actionToMessage(
        ammUsdcWallet.address as Address,
        ammUsdcWallet.initMessageResult.actionList[0],
        forwardTon
    );

    let ammRes = await masterAMM.sendInternalMessage(usdcToAmmTransferNotification);
    expect(ammRes.exit_code).toBe(0);

    let mintLpMessage = ammRes.actionList[0] as SendMsgAction;

    const lpMsg = actionToMessage(masterAMM.address as Address, ammRes.actionList[0]);
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
    masterAMM: AmmMinterTVM,
    lpWallet: AmmLpWallet,
    expectedLP: string,
    jettonLiquidity = JETTON_LIQUIDITY,
    tonLiquidity = TON_LIQUIDITY,
    slippage = new BN(5),
    addLiquidityExitCode = 0,
    jettonSenderOverride?: Address
) {
    const forwardTon = tonLiquidity.add(toNano(GAS_FEES.ADD_LIQUIDITY));

    const transferResponse = await aliceUSDC.transfer(
        alice,
        amm,
        jettonLiquidity,
        amm,
        undefined,
        forwardTon,
        OPS.ADD_LIQUIDITY,
        slippage,
        tonLiquidity
    );

    expect(transferResponse.exit_code).toBe(0);

    const internalTransferMessage = actionToMessage(aliceUSDC.address, transferResponse.actionList[0], forwardTon);
    const ammUsdcWalletResponse = await ammUsdcWallet.sendInternalMessage(internalTransferMessage);

    expect(ammUsdcWalletResponse.exit_code).toBe(0);
    const usdcToAmmTransferNotification = actionToMessage(
        jettonSenderOverride || (ammUsdcWallet.address as Address),
        ammUsdcWalletResponse.actionList[0],
        forwardTon
    );
    let transferNotificationRes = await masterAMM.sendInternalMessage(usdcToAmmTransferNotification);

    expect(transferNotificationRes.exit_code).toBe(addLiquidityExitCode);
    if (addLiquidityExitCode > 0) {
        return {
            addLiquidityMessage: transferNotificationRes,
        };
    }

    const lpMsg = actionToMessage(masterAMM.address as Address, transferNotificationRes.actionList[0]);
    const lpWalletResponse = await lpWallet.sendInternalMessage(lpMsg);

    return {
        lpWalletResponse,
        addLiquidityMessage: transferNotificationRes,
    };
}

function printAmmData(data: { tonReserves: BN; tokenReserves: BN; totalSupply: BN }) {
    //     tonReservers:${fromNano(data.tonReserves).toString()}
    //     tokenReserves:${fromNano(data.tokenReserves).toString()}
    //     totalSupply:${fromNano(data.totalSupply).toString()}
    // `);
}
