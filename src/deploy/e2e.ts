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
} from "ton";
import { JettonMinter } from "../jetton/jetton-minter";
import BN from "bn.js";

import axios from "axios";
import axiosThrottle from "axios-request-throttle";

import { initDeployKey, sleep } from "./deploy-utils";
import { JettonWallet } from "../jetton/jetton-wallet";
import { AmmMinter } from "../amm/amm-minter";
import { OPS } from "../amm/ops";

axiosThrottle.use(axios, { requestsPerSecond: 0.5 }); // required since toncenter jsonRPC limits to 1 req/sec without API key
const client = new TonClient({
    endpoint: "https://testnet.tonhubapi.com/jsonRPC",
    // endpoint: "https://testnet.toncenter.com/api/v2/jsonRPC",
});

// this a hack, it should be resolved on runtime
const ammMinterAddress = Address.parse("kQA7wgztDEfiM8rDsv2vimGoNzynQ8lwFv6heZQPEB-Hyi5E");

const BLOCK_TIME = 12000;

async function initWallet(client: TonClient, publicKey: Buffer, workchain = 0) {
    const wallet = await WalletContract.create(
        client,
        WalletV3R2Source.create({ publicKey: publicKey, workchain })
    );
    console.log(
        `wallet ${wallet.address.toFriendly()} 
        | balance: ${await client.getBalance(wallet.address)} | seqno: ${await wallet.getSeqNo()}`
    );

    return wallet;
}

async function deployUSDCMinter(
    client: TonClient,
    walletContract: WalletContract,
    owner: Address,
    privateKey: Buffer,
    workchain = 0
) {
    const { codeCell, initDataCell } = await JettonMinter.createDeployData(
        new BN(10000),
        owner,
        "http://tonswap.co/token/usdc2.json"
    );

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
    console.log("seqno", seqno);

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
    console.log(`- Deploy transaction sent successfully to -> ${newContractAddress.toFriendly()}`);

    return {
        address: newContractAddress,
    };
}

async function deployAmmMinter(
    client: TonClient,
    walletContract: WalletContract,
    jettonWalletAddress: Address,
    rewardsWallet: Address,
    rewardsRate: BN,
    protocolRewardsWallet: Address,
    protocolRewardsRate: BN,
    privateKey: Buffer,
    workchain = 0
) {
    const { codeCell, initDataCell } = await AmmMinter.buildDataCell(
        jettonWalletAddress,
        "ipfs://some.data/xxxx",
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
    console.log("seqno", seqno);

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
    console.log(`- Deploy transaction sent successfully to -> ${newContractAddress.toFriendly()}`);

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
    console.log("seqno", seqno);

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
    console.log(`sending transaction ${messageBody.toString()}`);

    return client.sendExternalMessage(walletContract, transfer);
}

var addressBook: { [key: string]: string } = {};

async function main() {
    // initialize deployer wallet
    const walletKey = await initDeployKey();
    let deployWallet = await initWallet(client, walletKey.publicKey);

    // deploy USDC-Minter
    const usdcMinter = await deployUSDCMinter(
        client,
        deployWallet,
        deployWallet.address,
        walletKey.secretKey
    );
    await sleep(BLOCK_TIME);
    let data = await client.callGetMethod(usdcMinter.address, "get_jetton_data", []);
    console.log(`usdcMinter totalSupply: ${new BN(data.stack[0]).toString()}`);

    addressBook["USDC-Minter"] = usdcMinter.address.toFriendly();
    //
    console.log(`minting deployer some usdc's , 100$`);

    await sendTransaction(
        client,
        deployWallet,
        usdcMinter.address,
        toNano(0.025),
        walletKey.secretKey,
        JettonMinter.Mint(deployWallet.address, toNano(100))
    );
    await sleep(BLOCK_TIME);

    console.log();

    // let usdcData = await client.callGetMethod(usdcMinter.address, "get_jetton_data", []);
    // console.log(`USDC-Minter totalSupply: ${new BN(usdcData.stack[0]).toString()}`);

    const deployerUSDCAddress = (await JettonMinter.GetWalletAddress(
        client,
        usdcMinter.address,
        deployWallet.address
    )) as Address;

    addressBook["USDC-Deployer"] = deployerUSDCAddress.toFriendly();
    printAddresses(addressBook);

    let deployerUSDCData = await JettonWallet.GetData(client, deployerUSDCAddress);
    console.log(`deployerUSDC::GetData -> balance: ${deployerUSDCData.balance}`);

    // // needs work (address are messed up)
    // const aliceJettonUSDCData = await JettonWallet.GetData(
    //     client,
    //     Address.parse("EQBR0NIocQxhxo8f8Nbf2XZBnCiDROPLbafhWSVr1Sk1QEEQ")
    // );
    // console.log(`aliceJettonUSDCData`, aliceJettonUSDCData);

    // resolving AMM's Usdc wallet address,

    // const ammUSDCWallet = (await JettonMinter.GetWalletAddress(
    //     client,
    //     usdcMinter.address,
    //     ammMinterAddress
    // )) as Address;

    // hack ( bc getWalletAddress is broken )  QDWKXp_lAc3qfMjKgbMKTjd4WFv_QB1mgWBFJEDrPpsjjxf
    const ammUSDCWallet = Address.parse("QDWKXp_lAc3qfMjKgbMKTjd4WFv_QB1mgWBFJEDrPpsjjxf");

    addressBook["USDC-Amm"] = ammUSDCWallet.toFriendly();

    printAddresses(addressBook);

    // deploy Amm Minter
    const ammMinter = await deployAmmMinter(
        client,
        deployWallet,
        ammUSDCWallet,
        ammUSDCWallet,
        new BN(0),
        ammUSDCWallet,
        new BN(0),
        walletKey.secretKey
    );

    console.log(`- AmmMinter deployed at address :${ammMinter.address.toFriendly()}`);

    const ammData = await AmmMinter.GetJettonData(client, ammMinter.address);
    console.log(`AmmMinter.GetJettonData() -> totalSupply: ${ammData.totalSupply} `);
    console.log(ammData);
    addressBook["AMM-Minter"] = ammMinter.address.toFriendly();

    const addLiquidityMessage = JettonWallet.TransferOverloaded(
        ammMinterAddress,
        toNano(100),
        ammMinterAddress,
        toNano(0.7),
        OPS.ADD_LIQUIDITY,
        new BN(5)
    );

    // let deployerUSDCAddressData = await JettonWallet.GetData(
    //     client,
    //     deployerUSDCAddress as Address
    // );

    console.log(`sending Add Liquditiy message to deployerUSDCAddress`);
    await sendTransaction(
        client,
        deployWallet,
        deployerUSDCAddress as Address,
        toNano(0.8),
        walletKey.secretKey,
        addLiquidityMessage
    );

    await sleep(BLOCK_TIME);

    const ammData2 = await AmmMinter.GetJettonData(client, ammMinter.address);
    console.log(`AmmMinter.GetJettonData() -> totalSupply: ${ammData2} `);
    console.log(ammData2);

    printAddresses(addressBook);
}

function printAddresses(addressBook: { [key: string]: string }) {
    console.log(``); //br
    for (var key in addressBook) {
        console.log(`${key} : https://test.tonwhales.com/explorer/address/${addressBook[key]}`);
    }
}

(async () => {
    await main();
})();
