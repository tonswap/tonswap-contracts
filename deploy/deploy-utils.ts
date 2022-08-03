import fs from "fs";
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
    WalletV3R2Source,
} from "ton";
import { mnemonicNew, mnemonicToWalletKey } from "ton-crypto";
import { JettonMinter } from "../src/jetton-minter";
import BN from "bn.js";
import axios from "axios";
import axiosThrottle from "axios-request-throttle";
import { AmmMinterRPC } from "../src/amm-minter";
import { OPS } from "../src/ops";
import { JettonWallet } from "../src/jetton-wallet";
import { AmmLpWallet } from "../src/amm-wallet";

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

const TON_LIQUIDITY = 1;
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
    console.log(`usdcMinter totalSupply: ${fromNano(data.stack[0][1]).toString()}`);
    saveAddress("USDC-Minter", usdcMinter.address);
    return usdcMinter;
}

export async function deployAmmMinter(
    client: TonClient,
    walletContract: WalletContract,
    privateKey: Buffer,
    ammDataUri = "https://api.jsonbin.io/b/7628f1df905f31f77b3a7c5d0",
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
    mintSize = MINT_SIZE,
    recipient = deployWallet.address
) {
    console.log(`
🎬 minting deployer some usdc's , 100$ (recipient=${recipient.toFriendly()})
`);
    await sendTransaction(
        client,
        deployWallet,
        usdcMinter,
        toNano(GAS_FEES.MINT),
        privateKey,
        JettonMinter.Mint(recipient, toNano(mintSize).add(toNano(TOKEN_TO_SWAP)))
    );
}

export async function addLiquidity(
    client: TonClient,
    ammMinter: AmmMinterRPC,
    deployWallet: WalletContract,
    deployerUSDCAddress: Address,
    privateKey: Buffer,
    tonLiquidity = TON_LIQUIDITY,
    tokenLiquidity = TOKEN_LIQUIDITY
) {
    console.log(`
🎬 sending Add Liquidity message | ${tonLiquidity} 💎 : ${fromNano(tokenLiquidity)}💲
`);
    const addLiquidityMessage = JettonWallet.TransferOverloaded(
        ammMinter.address,
        tokenLiquidity, // jetton-amount
        ammMinter.address,
        toNano(tonLiquidity),
        OPS.ADD_LIQUIDITY,
        new BN(5), // Slippage
        toNano(tonLiquidity)
    );

    await sendTransaction(
        client,
        deployWallet,
        deployerUSDCAddress as Address,
        toNano(tonLiquidity + GAS_FEES.ADD_LIQUIDITY),
        privateKey,
        addLiquidityMessage
    );

    printBalances(client, ammMinter, deployWallet.address, deployerUSDCAddress);
}

export async function removeLiquidity(
    client: TonClient,
    ammMinter: AmmMinterRPC,
    deployWallet: WalletContract,
    privateKey: Buffer,
    sendMode = 3
) {
    //   await printBalances(client, ammMinter, deployWallet.address);

    const lpAddress = (await ammMinter.getWalletAddress(deployWallet.address)) as Address;
    const lpData = await AmmLpWallet.GetWalletData(client, lpAddress);
    saveAddress("LP-Wallet", lpAddress);

    console.log(`
🎬  Remove Liquidity of ${fromNano(lpData.balance.toString())} LP's
`);

    const removeLiqMessage = AmmLpWallet.RemoveLiquidityMessage(new BN(lpData.balance.toString()), deployWallet.address);

    await sendTransaction(client, deployWallet, lpAddress, toNano(GAS_FEES.REMOVE_LIQUIDITY), privateKey, removeLiqMessage, sendMode);

    sleep(BLOCK_TIME);
    // await printBalances(client, ammMinter, deployWallet.address, deployerUSDCAddress);
}

export async function initDeployKey() {
    const deployConfigJson = `./build/deploy.config.json`;
    const deployerWalletType = "org.ton.wallets.v3.r2";
    let deployerMnemonic;
    if (!fs.existsSync(deployConfigJson)) {
        console.log(`\n* Config file '${deployConfigJson}' not found, creating a new wallet for deploy..`);
        deployerMnemonic = (await mnemonicNew(24)).join(" ");
        const deployWalletJsonContent = {
            created: new Date().toISOString(),
            deployerWalletType,
            deployerMnemonic,
        };
        fs.writeFileSync(deployConfigJson, JSON.stringify(deployWalletJsonContent, null, 2));
        console.log(` - Created new wallet in '${deployConfigJson}' - keep this file secret!`);
    } else {
        console.log(`\n* Config file '${deployConfigJson}' found and will be used for deployment!`);
        const deployConfigJsonContentRaw = fs.readFileSync(deployConfigJson, "utf-8");
        const deployConfigJsonContent = JSON.parse(deployConfigJsonContentRaw);
        if (!deployConfigJsonContent.deployerMnemonic) {
            console.log(` - ERROR: '${deployConfigJson}' does not have the key 'deployerMnemonic'`);
            process.exit(1);
        }
        deployerMnemonic = deployConfigJsonContent.deployerMnemonic;
    }
    return mnemonicToWalletKey(deployerMnemonic.split(" "));
}

export function bytesToAddress(bufferB64: string) {
    const buff = Buffer.from(bufferB64, "base64");
    let c2 = Cell.fromBoc(buff);
    return c2[0].beginParse().readAddress() as Address;
}

export function sleep(time: number) {
    return new Promise((resolve) => {
        console.log(`💤 ${time / 1000}s ...`);

        setTimeout(resolve, time);
    });
}
export async function printDeployerBalances(client: TonClient, deployer: Address, deployerUSDCAddress: Address) {
    const usdcData = await JettonWallet.GetData(client, deployerUSDCAddress);
    const ton = await client.getBalance(deployer);
    console.log(``);
    console.log(`⛏  Deployer Balance: ${fromNano(ton)}💎 | ${fromNano(usdcData.balance.toString())}$ USDC `);
    console.log(``);
}

export async function printBalances(client: TonClient, ammMinter: AmmMinterRPC, deployer: Address, deployerUSDCAddress: Address) {
    const data = await ammMinter.getJettonData();
    const balance = await client.getBalance(ammMinter.address);
    console.log(`-----==== AmmMinter ====-----  `);
    console.log(`[${ammMinter.address.toFriendly()}]
💎 balance      : ${fromNano(balance)} | ${balance.sub(hexToBn(data.tonReserves)).toString()}  
💰 totalSupply  : ${hexToBn(data.totalSupply)} (${bnFmt(hexToBn(data.totalSupply))})
💰 tonReserves  : ${hexToBn(data.tonReserves)} (${bnFmt(hexToBn(data.tonReserves))})
💰 tokenReserves: ${hexToBn(data.tokenReserves)} (${bnFmt(hexToBn(data.tokenReserves))})
📪 JettonWallet : ${data.jettonWalletAddress.toFriendly()}


`);
    await printDeployerBalances(client, deployer, deployerUSDCAddress);
    console.log(`-----==== ***** ====-----
`);
}

export function hexToBn(num: string) {
    return new BN(BigInt(num).toString());
}

export function bnFmt(num: BN | BigInt) {
    let str = num.toString();
    return `${BigInt(str) / BigInt(1e9)}.${BigInt(str) % BigInt(1e9)} `;
}

export function hexFromNano(num: string) {
    const res = BigInt(num) / BigInt(100000000);
    return res.toString();
}

export function printAddresses(addressBook: { [key: string]: string }, network: "sandbox." | "test." | "" = "") {
    console.log(``); //br
    let lsSnippet = ``;
    for (var key in addressBook) {
        const address = key;
        console.log(`${addressBook[key]} : https://${network}tonwhales.com/explorer/address/${key}`);
        const ellipsisAddress = `${address.substring(0, 6)}...${address.substring(address.length - 7, address.length - 1)}`;
        lsSnippet += `localStorage["${key}"]="${addressBook[key]}";`;
        lsSnippet += `localStorage["${ellipsisAddress}"]="${addressBook[key]}";`;
    }
    console.log(``);
    console.log(lsSnippet);
    console.log(``);
}

export async function initWallet(client: TonClient, publicKey: Buffer, workchain = 0) {
    const wallet = await WalletContract.create(client, WalletV3R2Source.create({ publicKey: publicKey, workchain }));
    const walletBalance = await client.getBalance(wallet.address);
    if (parseFloat(fromNano(walletBalance)) < 1) {
        throw `Insufficient Deployer [${wallet.address.toFriendly()}] funds ${fromNano(walletBalance)}`;
    }
    console.log(
        `Init wallet ${wallet.address.toFriendly()} | 
balance: ${fromNano(await client.getBalance(wallet.address))} | seqno: ${await wallet.getSeqNo()}
`
    );

    return { wallet, walletBalance };
}

export async function waitForSeqno(walletContract: WalletContract, seqno: number) {
    const seqnoStepInterval = 3000;
    console.log(`⏳ waiting for seqno to update (${seqno})`);
    for (var attempt = 0; attempt < 10; attempt++) {
        await sleep(seqnoStepInterval);
        const seqnoAfter = await walletContract.getSeqNo();
        if (seqnoAfter > seqno) break;
    }
    console.log(`⌛️ seqno update after ${((attempt + 1) * seqnoStepInterval) / 1000}s`);
}
