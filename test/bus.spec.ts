import BN from "bn.js";
import { Address, Cell, CellMessage, CommonMessageInfo, InternalMessage, toNano } from "ton";
import { SendMsgAction } from "ton-contract-executor";
import { AmmMinterMessages, AmmMinterTVM } from "../src/amm-minter";
// import { actionToMessage } from "../src/amm-utils";
import { AmmLpWallet } from "../src/amm-wallet";
import { JettonMinter } from "../src/jetton-minter";
import { JettonWallet } from "../src/jetton-wallet";
import { Wallet } from "../src/wallet";
import { OPS } from "../src/ops";

import { printChain, TvmBus } from "ton-tvm-bus";

const JETTON_LIQUIDITY = toNano(1000);
const TON_LIQUIDITY = toNano(500);
const LP_DEFAULT_AMOUNT = 707106781;
const INITIAL_JETTON_MINT = toNano(2050);

const GAS_FEES = {
    ADD_LIQUIDITY: "0.2",
    SWAP_FEE: "0.04",
};

const alice = Address.parse("EQCLjyIQ9bF5t9h3oczEX3hPVK4tpW2Dqby0eHOH1y5_Nvb7");

describe("Ton Swap Bus Test Suite", () => {
    it("mint USDC", async () => {
        const tvmBus = new TvmBus();
        const { usdcMinter, jettonWallet } = await createBaseContracts(tvmBus);
        const data = await usdcMinter.getData();
        expect((await jettonWallet.getData()).balance.toString()).toBe(data?.totalSupply.toString());
    });

    it("mint USDC twice", async () => {
        const tvmBus = new TvmBus();
        const { usdcMinter, jettonWallet, deployWallet } = await createBaseContracts(tvmBus);

        let mintMessage = await usdcMinter.mintMessage(deployWallet.address, deployWallet.address, toNano(7505));
        let res = await tvmBus.broadcast(mintMessage);

        const data = await usdcMinter.getData();

        expect((await jettonWallet.getData()).balance.toString()).toBe(data?.totalSupply.toString());
    });

    it("add liquidity", async () => {
        //  const { usdcMinter, jettonWallet } = await createBaseContracts(tvmBus);
        await initAMM({});
    });

    it("add liquidity twice and fail the second time, send back funds to sender", async () => {
        const { usdcMinter, tvmBus, deployWallet, ammMinter, deployerJetton } = await initAMM({});

        let mintAmount = INITIAL_JETTON_MINT;
        let mintMessage = await usdcMinter.mintMessage(deployWallet.address, deployWallet.address, mintAmount);
        let result = await tvmBus.broadcast(mintMessage);

        const tonValue = TON_LIQUIDITY.sub(toNano(100));
        const messageBody = JettonWallet.TransferOverloaded(
            ammMinter.address as Address,
            JETTON_LIQUIDITY,
            ammMinter.address as Address,
            tonValue,
            OPS.ADD_LIQUIDITY,
            new BN(5),
            tonValue
        );
        const addLiquidityMessage = messageGenerator({
            from: deployWallet.address,
            to: deployerJetton.address,
            value: tonValue.add(toNano("0.2")),
            body: messageBody,
        });
        const messagesLog = await tvmBus.broadcast(addLiquidityMessage);

        printChain(messagesLog, "add liquidity twice and fail the second time, send back funds to sender");

        expect(messagesLog.length).toBe(8);
    });

    it("remove liquidity", async () => {
        const { deployerLpWallet, tvmBus, deployWallet } = await initAMM({});

        const lpData = await deployerLpWallet.getData();
        console.log(lpData);

        console.log("lpData.balace", lpData.balance.toString());

        let messageBody = AmmLpWallet.RemoveLiquidityMessage(lpData.balance, deployWallet.address);
        const message = messageGenerator({
            from: deployWallet.address,
            to: deployerLpWallet.address as Address,
            value: toNano("0.2"),
            body: messageBody,
        });

        let messagesLog = await tvmBus.broadcast(message);
        console.log(messagesLog);

        let deployerLpWallet2 = messagesLog[0].contractImpl as AmmLpWallet;

        let deployer = messagesLog[0].contractImpl as Wallet;
        let ammMinter = messagesLog[1].contractImpl as AmmMinterTVM;
        let ammJetton = messagesLog[2].contractImpl as JettonWallet;
        let deployerJetton = messagesLog[3].contractImpl as JettonWallet;

        // deployer lp = 0
        const deployerLpWalletData = await deployerLpWallet2.getData();
        expect(deployerLpWalletData.balance.toString()).toBe("0");

        // reserves should be 0 after remove liquidity
        const ammMinterData = await ammMinter.getData();
        expect(ammMinterData.tonReserves.toString()).toBe("0");
        expect(ammMinterData.tokenReserves.toString()).toBe("0");

        // amm's jetton wallet balance should be 0
        const ammJettonData = await ammJetton.getData();
        expect(ammJettonData.balance.toString()).toBe("0");

        const deployerJettonData = await deployerJetton.getData();
        expect(deployerJettonData.balance.toString()).toBe(INITIAL_JETTON_MINT.toString());

        printChain(messagesLog, "remove liquidity");
    });

    it("swap ton to token", async () => {
        let { ammMinter, tvmBus, deployWallet } = await initAMM({});

        const tonSide = toNano(1);
        const preSwapData = await ammMinter.getData();

        const { tonReserves, tokenReserves } = await ammMinter.getData();
        const { minAmountOut } = await ammMinter.getAmountOut(tonSide, tonReserves, tokenReserves);
        const swapTonMessage = AmmMinterMessages.swapTon(toNano(1), minAmountOut);

        const message = messageGenerator({
            from: deployWallet.address,
            to: ammMinter.address as Address,
            value: tonSide.add(toNano("0.2")),
            body: swapTonMessage,
        });
        let messagesLog = await tvmBus.broadcast(message);

        ammMinter = messagesLog[0].contractImpl as AmmMinterTVM;
        const ammMinterData = await ammMinter.getData();
        expect(ammMinterData.tonReserves.toString()).toBe(preSwapData.tonReserves.add(tonSide).toString());
        expect(ammMinterData.tokenReserves.toString()).toBe(preSwapData.tokenReserves.sub(minAmountOut).toString());
        printChain(messagesLog, "swap ton to token");
    });

    it("swap ton to token and revert", async () => {
        let { ammMinter, tvmBus, deployWallet } = await initAMM({});
        const tonSide = toNano(1);
        const preSwapData = await ammMinter.getData();

        const { tonReserves, tokenReserves } = await ammMinter.getData();
        const { minAmountOut } = await ammMinter.getAmountOut(tonSide, tonReserves, tokenReserves);
        const swapTonMessage = AmmMinterMessages.swapTon(toNano(1), minAmountOut.mul(new BN(2))); // using min amount is X2 should fail the transaction

        const message = messageGenerator({
            from: deployWallet.address,
            to: ammMinter.address as Address,
            value: tonSide.add(toNano("0.2")),
            body: swapTonMessage,
        });
        let messagesLog = await tvmBus.broadcast(message);

        ammMinter = messagesLog[0].contractImpl as AmmMinterTVM;
        const ammMinterData = await ammMinter.getData();
        expect(ammMinterData.tonReserves.toString()).toBe(preSwapData.tonReserves.toString());
        expect(ammMinterData.tokenReserves.toString()).toBe(preSwapData.tokenReserves.toString());
        printChain(messagesLog, "swap ton to token and revert");
    });

    it("swap token to ton", async () => {
        let { ammMinter, deployerJetton, tvmBus, deployWallet } = await initAMM({});
        const { tonReserves, tokenReserves } = await ammMinter.getData();
        const jettonSide = toNano(10);
        const preSwapData = await ammMinter.getData();

        const { minAmountOut } = await ammMinter.getAmountOut(jettonSide, tokenReserves, tonReserves);

        const tonLiquidity = toNano(0.2);
        const forwardTon = tonLiquidity.add(toNano(GAS_FEES.ADD_LIQUIDITY));
        const swapTokenMessage = JettonWallet.TransferOverloaded(
            ammMinter.address as Address,
            jettonSide,
            deployWallet.address,
            forwardTon,
            OPS.SWAP_TOKEN,
            minAmountOut,
            tonLiquidity
        );

        const message = messageGenerator({
            from: deployWallet.address,
            to: deployerJetton.address,
            value: forwardTon.add(toNano(GAS_FEES.SWAP_FEE)),
            body: swapTokenMessage,
        });
        let messagesLog = await tvmBus.broadcast(message);
        console.log(messagesLog);

        ammMinter = messagesLog[3].contractImpl as AmmMinterTVM;
        const ammMinterData = await ammMinter.getData();
        expect(ammMinterData.tokenReserves.toString()).toBe(preSwapData.tokenReserves.add(jettonSide).toString());
        expect(ammMinterData.tonReserves.toString()).toBe(preSwapData.tonReserves.sub(minAmountOut).toString());

        printChain(messagesLog, "swap ton to token and revert");
    });

    it("swap token to TON and revert", async () => {
        let { ammMinter, deployerJetton, tvmBus, deployWallet } = await initAMM({});

        const { tonReserves, tokenReserves } = await ammMinter.getData();
        const jettonSide = toNano(10);
        const preSwapData = await ammMinter.getData();
        const initialJettonBalance = await (await deployerJetton.getData()).balance;

        const tonLiquidity = toNano(0.1);
        const forwardTon = tonLiquidity.add(toNano(GAS_FEES.ADD_LIQUIDITY));

        const { minAmountOut } = await ammMinter.getAmountOut(jettonSide, tokenReserves, tonReserves);
        const swapTokenMessage = JettonWallet.TransferOverloaded(
            ammMinter.address as Address,
            jettonSide,
            ammMinter.address as Address,
            forwardTon,
            OPS.SWAP_TOKEN,
            minAmountOut.mul(new BN(2)) // this should fail the swap
        );

        const message = messageGenerator({
            from: deployWallet.address,
            to: deployerJetton.address,
            value: forwardTon.add(toNano(GAS_FEES.SWAP_FEE)),
            body: swapTokenMessage,
        });
        let messagesLog = await tvmBus.broadcast(message);

        expect(messagesLog.length).toBe(7);

        const deployerWallet = messagesLog[5].contractImpl as JettonWallet;

        expect(deployerWallet).toBe(deployerJetton);
        const currentBalance = (await deployerWallet.getData()).balance;
        expect(currentBalance.toString()).toBe(initialJettonBalance.toString());

        const ammMinterData = await ammMinter.getData();
        expect(ammMinterData.tokenReserves.toString()).toBe(preSwapData.tokenReserves.toString());
        expect(ammMinterData.tonReserves.toString()).toBe(preSwapData.tonReserves.toString());

        printChain(messagesLog, "swap ton to token and revert");
    });
});

async function initAMM({ jettonLiquidity = JETTON_LIQUIDITY, tonLiquidity = TON_LIQUIDITY, addLiquiditySlippage = new BN(5) }) {
    const tvmBus = new TvmBus();
    tvmBus.registerCode(AmmLpWallet);

    const { jettonWallet, ammMinter, deployWallet, usdcMinter } = await createBaseContracts(tvmBus);

    const forwardTon = tonLiquidity.add(toNano(GAS_FEES.ADD_LIQUIDITY));
    // amm minter spec
    const messageBody = JettonWallet.TransferOverloaded(
        ammMinter.address as Address,
        jettonLiquidity,
        deployWallet.address, // receive excess back
        forwardTon,
        OPS.ADD_LIQUIDITY,
        addLiquiditySlippage,
        tonLiquidity
    );

    const addLiquidityMessage = messageGenerator({
        from: deployWallet.address,
        to: jettonWallet.address,
        value: tonLiquidity.add(toNano("0.3")),
        body: messageBody,
    });

    let messagesLog = await tvmBus.broadcast(addLiquidityMessage);
    // console.log(messagesLog);

    const deployerJettonData = await (messagesLog[0].contractImpl as JettonWallet).getData();
    expect(deployerJettonData.balance.toString()).toBe(INITIAL_JETTON_MINT.sub(jettonLiquidity).toString());

    const ammJettonData = await (messagesLog[1].contractImpl as JettonWallet).getData();
    expect(ammJettonData.balance.toString()).toBe(jettonLiquidity.toString());

    const ammMinterData = await (messagesLog[3].contractImpl as AmmMinterTVM).getData();
    expect(ammMinterData.tonReserves.toString()).toBe(tonLiquidity.toString());

    const deployerLpWalletData = await (messagesLog[4].contractImpl as AmmLpWallet).getData();

    expect(deployerLpWalletData.balance.toString()).toBe(LP_DEFAULT_AMOUNT.toString());

    return {
        tvmBus,
        deployWallet,
        usdcMinter,
        deployerJetton: messagesLog[0].contractImpl as JettonWallet,
        ammJetton: messagesLog[1].contractImpl as JettonWallet,
        ammMinter: messagesLog[3].contractImpl as AmmMinterTVM,
        deployerLpWallet: messagesLog[4].contractImpl as AmmLpWallet,
    };
}

function messageGenerator(opts: { to: Address; from: Address; body: Cell; value: BN; bounce?: boolean }) {
    return new InternalMessage({
        from: opts.from,
        to: opts.to,
        value: opts.value,
        bounce: opts.bounce || false,
        body: new CommonMessageInfo({
            body: new CellMessage(opts.body),
        }),
    });
}

async function createBaseContracts(tvmBus: TvmBus) {
    const deployWallet = await Wallet.Create(tvmBus, toNano(10), new BN(101), 0); // address EQCG-Qj2cpnPsGR-nkRokEgHdzblUlug1MH2twgpRJf5DUOI
    const deployerAddress = deployWallet.address;

    const usdcMinter = await JettonMinter.Create(new BN(0), deployerAddress, "https://ipfs.io/ipfs/dasadas", tvmBus, toNano("0.2"));
    const data = await usdcMinter.getData();
    expect(data?.totalSupply.toString()).toBe("0");
    tvmBus.registerCode(JettonWallet);

    let mintAmount = INITIAL_JETTON_MINT;
    let mintMessage = await usdcMinter.mintMessage(deployerAddress, deployerAddress, mintAmount);

    let messageList = await tvmBus.broadcast(mintMessage);

    const data2 = await usdcMinter.getData();
    expect(data2?.totalSupply.toString()).toBe(mintAmount.toString());

    const jettonWallet = messageList[1].contractImpl as JettonWallet;

    expect((await jettonWallet.getData()).balance.toString()).toBe(mintAmount.toString());

    const ammMinter = new AmmMinterTVM("https://ipfs.io/ipfs/dasadas", alice, tvmBus, toNano(0.2));

    return {
        usdcMinter,
        jettonWallet,
        ammMinter,
        deployWallet,
    };
}
