import {
    Address,
    TonClient,
    Cell,
    WalletContract,
    InternalMessage,
    CommonMessageInfo,
    StateInit,
    contractAddress,
    toNano,
    CellMessage,
    fromNano,
} from "ton";
import { JettonMinter } from "../src/jetton-minter";
import BN from "bn.js";

import axios from "axios";
import axiosThrottle from "axios-request-throttle";

import { initDeployKey, initWallet, printBalances, printDeployerBalances, sleep, waitForSeqno } from "../utils/deploy-utils";
import { AmmMinterRPC } from "../src/amm-minter";
import { OPS } from "../src/ops";
import { JettonWallet } from "../src/jetton-wallet";

axiosThrottle.use(axios, { requestsPerSecond: 0.5 }); // required since toncenter jsonRPC limits to 1 req/sec without API key

enum GAS_FEES {
    ADD_LIQUIDITY = 0.2,
    REMOVE_LIQUIDITY = 0.25,
    SWAP_FEE = 0.2,
    SWAP_FORWARD_TON = 0.2,
    MINT = 0.2,
}

enum NETWORK {
    SANDBOX = "sandbox.",
    TESTNET = "test.",
    MAINNET = "",
}

const TON_LIQUIDITY = 4;
const TOKEN_TO_SWAP = 25;
const TOKEN_LIQUIDITY = toNano(100);
const TON_TO_SWAP = 2;
const MINT_SIZE = 100;
//const JETTON_URI = "https://api.jsonbin.io/b/629ffffffff";

const zeroAddress = Address.parse("EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c");

export const BLOCK_TIME = 30000;

async function _deployJettonMinter(
    client: TonClient,
    walletContract: WalletContract,
    owner: Address,
    privateKey: Buffer,
    jettonUri: string,
    workchain = 0
) {
    const { codeCell, initDataCell } = await JettonMinter.createDeployData(new BN(10000), owner, jettonUri);

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
            value: toNano(0.25),
            bounce: false,
            body: new CommonMessageInfo({
                stateInit: new StateInit({ data: initDataCell, code: codeCell[0] }),
                body: null,
            }),
        }),
    });
    await client.sendExternalMessage(walletContract, transfer);
    waitForSeqno(walletContract, seqno);
    console.log(`- Deploy transaction sent successfully to -> ${newContractAddress.toFriendly()} [seqno:${seqno}]`);
    await sleep(BLOCK_TIME);
    return {
        address: newContractAddress,
    };
}
export async function deployJettonMinter(client: TonClient, deployWallet: WalletContract, privateKey: Buffer, jettonUri: string) {
    const usdcMinter = await _deployJettonMinter(client, deployWallet, deployWallet.address, privateKey, jettonUri);
    let data = await client.callGetMethod(usdcMinter.address, "get_jetton_data", []);
    console.log(`usdcMinter totalSupply: ${data.stack[0][1]}`);
    saveAddress("USDC-Minter", usdcMinter.address);
    return usdcMinter;
}

export async function deployAmmMinter(
    client: TonClient,
    walletContract: WalletContract,
    privateKey: Buffer,
    ammDataUri = "https://api.jsonbin.io/b/628f1df905f31f77b3a7c5d0",
    workchain = 0
) {
    const ammMinterRPC = new AmmMinterRPC({ rpcClient: client });
    const { codeCell, initDataCell } = await ammMinterRPC.buildDataCell(ammDataUri);

    const newContractAddress = await contractAddress({
        workchain,
        initialData: initDataCell,
        initialCode: codeCell[0],
    });

    saveAddress("AMM-Minter", newContractAddress);
    console.log(` - Deploy AmmMinter the contract on-chain.. [${newContractAddress.toFriendly()}]`);

    if (await client.isContractDeployed(newContractAddress)) {
        console.log(`${newContractAddress.toFriendly()} already Deployed`);
        return new AmmMinterRPC({
            address: newContractAddress,
            rpcClient: client,
        });
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
    waitForSeqno(walletContract, seqno);
    // new contracts takes time
    await sleep(BLOCK_TIME);

    ammMinterRPC.setAddress(newContractAddress);

    return ammMinterRPC;
}

const BOC_MAX_LENGTH = 48;

export async function sendTransaction(
    client: TonClient,
    walletContract: WalletContract,
    receivingContract: Address,
    value: BN,
    privateKey: Buffer,
    messageBody: Cell,
    sendMode = 3
) {
    const seqno = await walletContract.getSeqNo();
    const bocStr = await messageBody.toString();
    const boc = bocStr.substring(0, bocStr.length < BOC_MAX_LENGTH ? bocStr.length : BOC_MAX_LENGTH).toString();
    console.log(`🧱 send Transaction to ${receivingContract.toFriendly()} value:${fromNano(value)}💎 [boc:${boc}]`);

    const transfer = await walletContract.createTransfer({
        secretKey: privateKey,
        seqno: seqno,
        sendMode: sendMode,
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

    client.sendExternalMessage(walletContract, transfer);

    await waitForSeqno(walletContract, seqno);
}

var addressToName: { [key: string]: string } = {};

export function saveAddress(name: string, addr: Address) {
    addressToName[addr.toFriendly()] = name;
}

export async function mintJetton(
    client: TonClient,
    usdcMinter: Address,
    deployWallet: WalletContract,
    privateKey: Buffer,
    mintSize = MINT_SIZE
) {
    console.log(`
🎬 minting deployer some usdc's , 100$
`);
    await sendTransaction(
        client,
        deployWallet,
        usdcMinter,
        toNano(GAS_FEES.MINT),
        privateKey,
        JettonMinter.Mint(deployWallet.address, toNano(mintSize).add(toNano(TOKEN_TO_SWAP)))
    );
}

export async function addLiquidity(
    client: TonClient,
    ammMinter: AmmMinterRPC,
    deployWallet: WalletContract,
    deployerUSDCAddress: Address,
    privateKey: Buffer
) {
    console.log(`
🎬 sending Add Liquidity message | ${TON_LIQUIDITY} 💎 : ${fromNano(TOKEN_LIQUIDITY)}💲
`);
    const addLiquidityMessage = JettonWallet.TransferOverloaded(
        ammMinter.address,
        TOKEN_LIQUIDITY, // jetton-amount
        ammMinter.address,
        toNano(TON_LIQUIDITY),
        OPS.ADD_LIQUIDITY,
        new BN(5), // Slippage
        toNano(TON_LIQUIDITY)
    );

    await sendTransaction(
        client,
        deployWallet,
        deployerUSDCAddress as Address,
        toNano(TON_LIQUIDITY + GAS_FEES.ADD_LIQUIDITY),
        privateKey,
        addLiquidityMessage
    );

    printBalances(client, ammMinter, deployWallet.address, deployerUSDCAddress);
}
