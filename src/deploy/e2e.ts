import {
    Address,
    TonClient,
    Cell,
    WalletContract,
    WalletV3R2Source,
    InternalMessage,
    CommonMessageInfo,
    StateInit,
    contractAddress,
    toNano,
    CellMessage,
    fromNano,
} from "ton";
import { JettonMinter } from "../jetton/jetton-minter";
import BN from "bn.js";

import axios from "axios";
import axiosThrottle from "axios-request-throttle";

import {
    hexFromNano,
    hexToBn,
    initDeployKey,
    initWallet,
    printAddresses,
    printAmmData,
    printDeployerBalances,
    sleep,
} from "./deploy-utils";
import { JettonWallet } from "../jetton/jetton-wallet";
import { AmmMinter } from "../amm/amm-minter";
import { OPS } from "../amm/ops";
import { AmmLpWallet } from "../amm/amm-wallet";

axiosThrottle.use(axios, { requestsPerSecond: 0.5 }); // required since toncenter jsonRPC limits to 1 req/sec without API key
const client = new TonClient({
    endpoint: "https://testnet.tonhubapi.com/jsonRPC",
    //   endpoint: "https://scalable-api.tonwhales.com/jsonRPC",
    // endpoint: "https://testnet.toncenter.com/api/v2/jsonRPC",
});

enum GAS_FEES {
    ADD_LIQUIDITY = 0.15,
    REMOVE_LIQUIDITY = 0.15,
    SWAP_FEE = 0.1,
    SWAP_FORWARD_TON = 0.1,
}

const zeroAddress = Address.parse("EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c");

const BLOCK_TIME = 12000;

async function deployUSDCMinter(client: TonClient, walletContract: WalletContract, owner: Address, privateKey: Buffer, workchain = 0) {
    const { codeCell, initDataCell } = await JettonMinter.createDeployData(new BN(10000), owner, "http://tonswap.co/token/usdc2.json");

    const newContractAddress = await contractAddress({
        workchain,
        initialData: initDataCell,
        initialCode: codeCell[0],
    });

    if (await client.isContractDeployed(newContractAddress)) {
        console.log(`contract: ${newContractAddress.toFriendly()} already Deployed`);

        return {
            address: newContractAddress,
        };
    }
    const seqno = await walletContract.getSeqNo();

    const transfer = await walletContract.createTransfer({
        secretKey: privateKey,
        seqno: seqno,
        sendMode: 1 + 2,
        order: new InternalMessage({
            to: newContractAddress,
            value: toNano(0.05),
            bounce: false,
            body: new CommonMessageInfo({
                stateInit: new StateInit({ data: initDataCell, code: codeCell[0] }),
                body: null,
            }),
        }),
    });
    await client.sendExternalMessage(walletContract, transfer);
    console.log(`- Deploy transaction sent successfully to -> ${newContractAddress.toFriendly()} [seqno:${seqno}]`);

    return {
        address: newContractAddress,
    };
}
async function deployMinter(client: TonClient, deployWallet: WalletContract, privateKey: Buffer) {
    const usdcMinter = await deployUSDCMinter(client, deployWallet, deployWallet.address, privateKey);
    await sleep(BLOCK_TIME);
    let data = await client.callGetMethod(usdcMinter.address, "get_jetton_data", []);
    console.log(`usdcMinter totalSupply: ${new BN(data.stack[0]).toString()}`);
    saveAddress("USDC-Minter", usdcMinter.address);
    return usdcMinter;
}

async function deployAmmMinter(
    client: TonClient,
    walletContract: WalletContract,
    rewardsWallet: Address,
    rewardsRate: BN,
    protocolRewardsWallet: Address,
    protocolRewardsRate: BN,
    privateKey: Buffer,
    workchain = 0
) {
    const { codeCell, initDataCell } = await AmmMinter.buildDataCell(
        "ipfs://tonswap.data/1",
        rewardsWallet,
        rewardsRate,
        protocolRewardsWallet,
        protocolRewardsRate
    );

    const newContractAddress = await contractAddress({
        workchain,
        initialData: initDataCell,
        initialCode: codeCell[0],
    });
    console.log(` - Deploy AmmMinter the contract on-chain.. [${newContractAddress.toFriendly()}]`);

    if (await client.isContractDeployed(newContractAddress)) {
        console.log(`${newContractAddress.toFriendly()} already Deployed`);

        return {
            address: newContractAddress,
        };
    }
    const seqno = await walletContract.getSeqNo();

    const transfer = await walletContract.createTransfer({
        secretKey: privateKey,
        seqno: seqno,
        sendMode: 1 + 2,
        order: new InternalMessage({
            to: newContractAddress,
            value: toNano(0.15),
            bounce: false,
            body: new CommonMessageInfo({
                stateInit: new StateInit({ data: initDataCell, code: codeCell[0] }),
                body: null,
            }),
        }),
    });

    await client.sendExternalMessage(walletContract, transfer);
    console.log(`- Deploy transaction sent successfully to -> ${newContractAddress.toFriendly()}`);
    sleep(BLOCK_TIME);
    return {
        address: newContractAddress,
    };
}

async function sendTransaction(
    client: TonClient,
    walletContract: WalletContract,
    receivingContract: Address,
    value: BN,
    privateKey: Buffer,
    messageBody: Cell
) {
    const seqno = await walletContract.getSeqNo();
    console.log(
        `send Transaction to ${receivingContract.toFriendly()} value:${fromNano(value)}💎 boc:${(await messageBody.toString()).toString()} `
    );

    const transfer = await walletContract.createTransfer({
        secretKey: privateKey,
        seqno: seqno,
        sendMode: 1 + 2,
        order: new InternalMessage({
            to: receivingContract,
            value: value,
            bounce: false,
            body: new CommonMessageInfo({
                body: new CellMessage(messageBody),
            }),
        }),
    });
    console.log(`🚀 sending transaction to ${addressToName[receivingContract.toFriendly()]} contract [seqno:${seqno}]`);

    return client.sendExternalMessage(walletContract, transfer);
}

var addressToName: { [key: string]: string } = {};

function saveAddress(name: string, addr: Address) {
    addressToName[addr.toFriendly()] = name;
}

const TON_LIQUIDITY = 2;
const TOKEN_LIQUIDITY = toNano(100);

async function mintUSDC(usdcMinter: Address, deployWallet: WalletContract, privateKey: Buffer) {
    console.log(`🎬 minting deployer some usdc's , 10,0007$`);
    await sendTransaction(
        client,
        deployWallet,
        usdcMinter,
        toNano(0.025),
        privateKey,
        JettonMinter.Mint(deployWallet.address, toNano(100007))
    );
    await sleep(BLOCK_TIME);
}

async function addLiquidity(ammMinter: Address, deployWallet: WalletContract, deployerUSDCAddress: Address, privateKey: Buffer) {
    console.log(`🎬 sending Add Liquidity message | ${TON_LIQUIDITY} 💎 : ${fromNano(TOKEN_LIQUIDITY)}💲`);
    const addLiquidityMessage = JettonWallet.TransferOverloaded(
        ammMinter,
        TOKEN_LIQUIDITY, // jetton-amount
        ammMinter,
        toNano(TON_LIQUIDITY),
        OPS.ADD_LIQUIDITY,
        new BN(5) // Slippage
    );

    await sendTransaction(
        client,
        deployWallet,
        deployerUSDCAddress as Address,
        toNano(TON_LIQUIDITY + GAS_FEES.ADD_LIQUIDITY),
        privateKey,
        addLiquidityMessage
    );
    await sleep(BLOCK_TIME);

    const ammData2 = await AmmMinter.GetJettonData(client, ammMinter);
    printAmmData(client, ammMinter);
}

async function swapUsdcToTon(
    ammMinter: Address,
    deployWallet: WalletContract,
    deployerUSDCAddress: Address,
    privateKey: Buffer,
    portion = new BN("4")
) {
    const ammData2 = await AmmMinter.GetJettonData(client, ammMinter);
    printAmmData(client, ammMinter);
    // portion is used to take all available liquidity by factor
    const tokenSwapAmount = TOKEN_LIQUIDITY.div(portion);
    const amountOut = await AmmMinter.GetAmountOut(
        client,
        ammMinter,
        tokenSwapAmount,
        hexToBn(ammData2.tokenReserves),
        hexToBn(ammData2.tonReserves)
    );

    await printDeployerBalances(client, deployerUSDCAddress);
    console.log(
        `🦄  Swap ${fromNano(tokenSwapAmount).toString()}$ USDC to 💎Ton (expecting for ${fromNano(
            amountOut.minAmountOut.toString()
        )} 💎Ton )`
    );
    const swapTokenMessage = JettonWallet.TransferOverloaded(
        ammMinter,
        tokenSwapAmount,
        ammMinter,
        toNano(GAS_FEES.SWAP_FORWARD_TON),
        OPS.SWAP_TOKEN,
        new BN(amountOut.minAmountOut.toString()) // Min Amount out (TON)
    );
    await sendTransaction(
        client,
        deployWallet,
        deployerUSDCAddress as Address,
        toNano(GAS_FEES.SWAP_FORWARD_TON + GAS_FEES.SWAP_FEE),
        privateKey,
        swapTokenMessage
    );
    await sleep(BLOCK_TIME);
    await printAmmData(client, ammMinter);
    await printDeployerBalances(client, deployerUSDCAddress);
}

async function swapTonToUsdc(ammMinter: Address, deployWallet: WalletContract, deployerUSDCAddress: Address, privateKey: Buffer) {
    const ammData3 = await AmmMinter.GetJettonData(client, ammMinter);
    const tonSwapAmount = toNano(0.3);

    const tonAmountOut = await AmmMinter.GetAmountOut(
        client,
        ammMinter,
        tonSwapAmount,
        hexToBn(ammData3.tonReserves),
        hexToBn(ammData3.tokenReserves)
    );

    console.log(
        `🦄  Swap ${fromNano(tonSwapAmount).toString()}💎Ton to  $ (expecting for ${fromNano(tonAmountOut.minAmountOut.toString())} $ )`
    );
    const swapTonMessage = AmmMinter.SwapTon(tonSwapAmount, new BN(tonAmountOut.minAmountOut.toString()));
    await sendTransaction(client, deployWallet, ammMinter, tonSwapAmount.add(toNano(GAS_FEES.SWAP_FEE)), privateKey, swapTonMessage);

    await sleep(BLOCK_TIME);
    await sleep(BLOCK_TIME);
    await printAmmData(client, ammMinter);
    await printDeployerBalances(client, deployerUSDCAddress);
}

async function removeLiquidity(ammMinter: Address, deployWallet: WalletContract, deployerUSDCAddress: Address, privateKey: Buffer) {
    await printAmmData(client, ammMinter);

    const lpAddress = (await AmmMinter.GetWalletAddress(client, ammMinter, deployWallet.address)) as Address;
    const lpData = await AmmLpWallet.GetWalletData(client, lpAddress);

    console.log(`🆇 Remove Liquidity of ${lpData.balance.toString()} )`);

    const removeLiqMessage = AmmLpWallet.RemoveLiquidityMessage(new BN(lpData.balance.toString()), deployWallet.address);

    await sendTransaction(client, deployWallet, lpAddress, toNano(GAS_FEES.REMOVE_LIQUIDITY), privateKey, removeLiqMessage);

    await sleep(BLOCK_TIME);
    await sleep(BLOCK_TIME);
    await printAmmData(client, ammMinter);
    await printDeployerBalances(client, deployerUSDCAddress);
}

async function main() {
    // initialize deployer wallet
    const walletKey = await initDeployKey();
    let deployWallet = await initWallet(client, walletKey.publicKey);
    saveAddress("Deployer", deployWallet.address);

    const usdcMinter = await deployMinter(client, deployWallet, walletKey.secretKey);

    // await mintUSDC(usdcMinter.address, deployWallet, walletKey.secretKey);

    const deployerUSDCAddress = (await JettonMinter.GetWalletAddress(client, usdcMinter.address, deployWallet.address)) as Address;

    let deployerUSDCData = await JettonWallet.GetData(client, deployerUSDCAddress);
    console.log(`deployerUSDC::GetData -> balance: ${deployerUSDCData.balance}`);

    const ammMinter = await deployAmmMinter(client, deployWallet, zeroAddress, new BN(0), zeroAddress, new BN(0), walletKey.secretKey);

    printAmmData(client, ammMinter.address);
    saveAddress("AMM-Minter", ammMinter.address);

    // ======== add-liquidity 2 ton + 100 tokens
    //await addLiquidity(ammMinter.address, deployWallet, deployerUSDCAddress as Address, walletKey.secretKey);

    sleep(BLOCK_TIME * 2);
    // ======== Swap Usdc -> TON
    await swapUsdcToTon(ammMinter.address, deployWallet, deployerUSDCAddress as Address, walletKey.secretKey);

    // ======== Swap Ton -> USDC
    //await swapTonToUsdc(ammMinter.address, deployWallet, deployerUSDCAddress as Address, walletKey.secretKey);

    // ======= Remove Liquidity
    // await removeLiquidity(ammMinter.address, deployWallet, deployerUSDCAddress as Address, walletKey.secretKey);

    printAddresses(addressToName);
}

(async () => {
    await main();
    // await printAmmData(client, Address.parse("EQDOdeLGx2BxcFATwRVyBwqyATz8awoRgoYT1G2NHPUXUw2S"));
    //await testJettonAddressCalc();
})();

// async function testJettonAddressCalc() {
//     const ammUSDCWallet = (await JettonMinter.GetWalletAddress(
//         client,
//         Address.parse("kQDF1uSarM0trnmYTFh5tW1ud7yHXUBiG7VCjtS2rIiU2hSW"), //amm-minter
//         Address.parse("kQBdPuDE6-9QE6c7dZZWbfhsE2jS--EfcwfEvGaWjKeW8kxE") //Deployer-X
//     )) as Address;

//     console.log(`ammUSDCWallet https://test.tonwhales.com/explorer/address/${ammUSDCWallet.toFriendly()}`);
// }

// // needs work (address are messed up)
// const aliceJettonUSDCData = await JettonWallet.GetData(
//     client,
//     Address.parse("EQBR0NIocQxhxo8f8Nbf2XZBnCiDROPLbafhWSVr1Sk1QEEQ")
// );
// console.log(`aliceJettonUSDCData`, aliceJettonUSDCData);

// deploy Amm Minter
