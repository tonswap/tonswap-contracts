import BN from "bn.js";
import {
    Address,
    beginCell,
    Cell,
    CellMessage,
    CommonMessageInfo,
    contractAddress,
    InternalMessage,
    StateInit,
    toNano,
    TonClient,
    WalletContract,
} from "ton";
import { JettonMinter } from "../src/jetton-minter";
import { JettonWallet } from "../src/jetton-wallet";
import { writeString } from "../src/utils";
import { initDeployKey, initWallet, sleep, waitForSeqno } from "../utils/deploy-utils";
const BLOCK_TIME = 30000;

const JETTON_MINTER_CODE_HEX = `b5ee9c72c1020b010001ed000000000d00120018002a006b007000bc01390152016c0114ff00f4a413f4bcf2c80b01020162050202037a600403001faf16f6a2687d007d206a6a183faa9040007dadbcf6a2687d007d206a6a183618fc1400b82a1009aa0a01e428027d012c678b00e78b666491646580897a007a00658064fc80383a6465816503e5ffe4e8400202cc07060093b3f0508806e0a84026a8280790a009f404b19e2c039e2d99924591960225e801e80196019241f200e0e9919605940f97ff93a0ef003191960ab19e2ca009f4042796d625999992e3f60103efd9910e38048adf068698180b8d848adf07d201800e98fe99ff6a2687d007d206a6a18400aa9385d47181a9aa8aae382f9702480fd207d006a18106840306b90fd001812881a28217804d02a906428027d012c678b666664f6aa7041083deecbef29385d71811a92e001f1811802600271812f82c207f97840a0908002e5143c705f2e049d43001c85004fa0258cf16ccccc9ed5400303515c705f2e049fa403059c85004fa0258cf16ccccc9ed5400fe3603fa00fa40f82854120870542013541403c85004fa0258cf1601cf16ccc922c8cb0112f400f400cb00c9f9007074c8cb02ca07cbffc9d05008c705f2e04a12a1035024c85004fa0258cf16ccccc9ed5401fa403020d70b01c3008e1f8210d53276db708010c8cb055003cf1622fa0212cb6acb1fcb3fc98042fb00915be2cc665c46`;
const JETTON_WALLET_CODE_HEX = `b5ee9c72c102110100031f000000000d001200220027002c00700075007a00e8016801a801e2025e02af02b402bf0114ff00f4a413f4bcf2c80b010201620302001ba0f605da89a1f401f481f481a8610202cc0e0402012006050083d40106b90f6a2687d007d207d206a1802698fc1080bc6a28ca9105d41083deecbef09dd0958f97162e99f98fd001809d02811e428027d012c678b00e78b6664f6aa40201200c07020120090800d73b51343e803e903e90350c01f4cffe803e900c145468549271c17cb8b049f0bffcb8b08160824c4b402805af3cb8b0e0841ef765f7b232c7c572cfd400fe8088b3c58073c5b25c60063232c14933c59c3e80b2dab33260103ec01004f214013e809633c58073c5b3327b552002f73b51343e803e903e90350c0234cffe80145468017e903e9014d6f1c1551cdb5c150804d50500f214013e809633c58073c5b33248b232c044bd003d0032c0327e401c1d3232c0b281f2fff274140371c1472c7cb8b0c2be80146a2860822625a019ad822860822625a028062849e5c412440e0dd7c138c34975c2c0600b0a007cc30023c200b08e218210d53276db708010c8cb055008cf165004fa0216cb6a12cb1f12cb3fc972fb0093356c21e203c85004fa0258cf1601cf16ccc9ed5400705279a018a182107362d09cc8cb1f5230cb3f58fa025007cf165007cf16c9718010c8cb0524cf165006fa0215cb6a14ccc971fb001024102301f1503d33ffa00fa4021f001ed44d0fa00fa40fa40d4305136a1522ac705f2e2c128c2fff2e2c254344270542013541403c85004fa0258cf1601cf16ccc922c8cb0112f400f400cb00c920f9007074c8cb02ca07cbffc9d004fa40f40431fa0020d749c200f2e2c4778018c8cb055008cf1670fa0217cb6b13cc80d009e8210178d4519c8cb1f19cb3f5007fa0222cf165006cf1625fa025003cf16c95005cc2391729171e25008a813a08209c9c380a014bcf2e2c504c98040fb001023c85004fa0258cf1601cf16ccc9ed540201d4100f00113e910c1c2ebcb8536000bb0831c02497c138007434c0c05c6c2544d7c0fc03383e903e900c7e800c5c75c87e800c7e800c00b4c7e08403e29fa954882ea54c4d167c0278208405e3514654882ea58c511100fc02b80d60841657c1ef2ea4d67c02f817c12103fcbc20c4bff3d6`;

const JETTON_WALLET_CODE = Cell.fromBoc(JETTON_WALLET_CODE_HEX)[0];
const JETTON_MINTER_CODE = Cell.fromBoc(JETTON_MINTER_CODE_HEX)[0];
const OFFCHAIN_CONTENT_PREFIX = 0x01;

const client = new TonClient({
    // endpoint: "https://sandbox.tonhubapi.com/jsonRPC",
    //endpoint: "https://testnet.tonhubapi.com/jsonRPC",
    endpoint: "https://scalable-api.tonwhales.com/jsonRPC",
    // endpoint: "https://testnet.toncenter.com/api/v2/jsonRPC",
});

function buildStateInit(owner: Address, totalSupply: BN, contentUri: string) {
    let contentCell = beginCell().storeInt(OFFCHAIN_CONTENT_PREFIX, 8).storeBuffer(Buffer.from(contentUri, "ascii")).endCell();
    return beginCell().storeCoins(totalSupply).storeAddress(owner).storeRef(contentCell).storeRef(JETTON_WALLET_CODE).endCell();
}

async function deployJetton(
    client: TonClient,
    walletContract: WalletContract,
    owner: Address,
    privateKey: Buffer,
    jettonUri: string,
    totalSupply: BN,
    workchain = 0
) {
    //const { codeCell, initDataCell } = await JettonMinter.createDeployData(new BN(totalSupply), owner, jettonUri);

    let initDataCell = buildStateInit(owner, new BN(totalSupply), jettonUri);

    const newContractAddress = await contractAddress({
        workchain,
        initialData: initDataCell,
        initialCode: JETTON_MINTER_CODE,
    });

    if (await client.isContractDeployed(newContractAddress)) {
        console.log(`contract: ${newContractAddress.toFriendly()} already Deployed`);

        return {
            address: newContractAddress,
        };
    }

    let cll = new Cell();
    new StateInit({ data: initDataCell, code: JETTON_MINTER_CODE }).writeTo(cll);
    const seqno = await walletContract.getSeqNo();

    const transfer = await walletContract.createTransfer({
        secretKey: privateKey,
        seqno: seqno,
        sendMode: 1 + 2,
        order: new InternalMessage({
            to: newContractAddress,
            value: toNano(0.1),
            bounce: false,
            body: new CommonMessageInfo({
                stateInit: new StateInit({ data: initDataCell, code: JETTON_MINTER_CODE }),
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

async function getMetaData(addr: Address) {
    let res = await client.callGetMethod(addr, "get_jetton_data");
    console.log(res);

    let cell = Cell.fromBoc(Buffer.from(res.stack[3][1].bytes, "base64"))[0];

    let metadata;
    try {
        let uri = cellToString(cell);
        //uri = "https://api.npoint.io/402e32572b294e845cde"
        if (uri.length == 2) {
            throw "onchain data";
        }
        console.log({ uri });

        let metadataRes = await fetch(uri);
        metadata = await metadataRes.json();
        console.log(metadata);
    } catch (e) {
        throw "couldnt read url";
    }
}

function cellToString(s: Cell) {
    let data = s.beginParse().readRemaining();
    return data.buffer.slice(0, Math.ceil(data.cursor / 8)).toString();
}

async function updateMetaData(wallet: WalletContract, privateKey: Buffer, jettonMinter: Address, ipfsUri: string) {
    let body = new Cell();
    body.bits.writeUint(4, 32);
    let contentCell = new Cell();
    contentCell.bits.writeUint(1, 1); // off-chain indication
    writeString(contentCell, ipfsUri);
    body.refs.push(contentCell);

    const seqno = await wallet.getSeqNo();

    const transfer = await wallet.createTransfer({
        secretKey: privateKey,
        seqno: seqno,
        sendMode: 1 + 2,
        order: new InternalMessage({
            to: jettonMinter,
            value: toNano(0.25),
            bounce: false,
            body: new CommonMessageInfo({
                body: new CellMessage(body),
            }),
        }),
    });
    await client.sendExternalMessage(wallet, transfer);
    waitForSeqno(wallet, seqno);
}

// async function swapUsdcToTon(
//     client: TonClient,
//     deployWallet: WalletContract,
//     deployerUSDCAddress: Address,
//     privateKey: Buffer,
//     portion = new BN("4")
// ) {

//     const swapTokenMessage = JettonWallet.TransferOverloaded(
//         to,
//         jettonAmount,
//         ammMinter.address,
//         toNano(GAS_FEES.SWAP_FORWARD_TON),
//         OPS.SWAP_TOKEN,
//         new BN(amountOut.minAmountOut.toString()) // Min Amount out (TON)
//     );
//     await sendTransaction(
//         client,
//         deployWallet,
//         deployerUSDCAddress as Address,
//         toNano(GAS_FEES.SWAP_FORWARD_TON + GAS_FEES.SWAP_FEE),
//         privateKey,
//         swapTokenMessage
//     );

//     //await printBalances(client, ammMinter, deployWallet.address, deployerUSDCAddress);
// }

async function main() {
    const walletKey = await initDeployKey();
    let { wallet: deployWallet } = await initWallet(client, walletKey.publicKey);

    //    DINO [EQCNSrY1Br5wcUXIhm_dBzOP5xKx-oUQl2YCy2qggFaL1bWm]
    // deployJetton(
    //     client,
    //     deployWallet,
    //     deployWallet.address,
    //     walletKey.secretKey,
    //     "https://ipfs.io/ipfs/QmQkuihhfEeuAHTqr1orQEg2eFHDbdURz2dG1BLYjhinXY",
    //     new BN(250000000).mul(new BN(1e9))
    // );

    // Kitty EQA_MjgZKgYFokx1IRyfEiDrvYYhtrOPfZcvL_1X0K-4av_Z
    // deployJetton(
    //     client,
    //     deployWallet,
    //     deployWallet.address,
    //     walletKey.secretKey,
    //     "https://ipfs.io/ipfs/QmZMcqfybxkYKx7zBSDNv3GDnzAPpyTcyofwXsNYaN94Nd",
    //     new BN(5000000000).mul(new BN(1e9))
    // );

    deployJetton(
        client,
        deployWallet,
        deployWallet.address,
        walletKey.secretKey,
        "https://ipfs.io/ipfs/QmZMcqfybxkYKx7zBSDNv3GDnzAPpyTcyofwXsNYaN94Nd",
        new BN(15).mul(new BN(1e9))
    );

    //await getMetaData(Address.parse("EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y")) //TGR
    //  await getMetaData(Address.parse("EQDsJY4wjfcCf0HvGhjHqkKG75TMTjMcUGSLMFU9CdJ2zF0X")) // MY Kitty

    // updateMetaData(
    //     deployWallet,
    //     walletKey.secretKey,
    //     Address.parse("EQCDEwcaliIbTcV13eLMfvZ3QAXaIGv9v4mxZbFKYCPRmh8B"), // shib
    //     "ipfs://QmUZbANfeTzKsZPHkBh81oS1WeacjQf8phWbFSyWxd31Sj" // my ipfs
    // );
}

(async () => {
    main();
})();

/// curl -F 'text={"name":"Inu","symbol":"ino","image":"https://coinmarketcap.com/currencies/apecoin-ape/"}'    http://3.16.42.100:9094/add\?meta-jetton\=ape

//  curl -F file=@launch/dinocorn-500x500.png "http://3.16.42.100:9094/add?meta-type=jetton"

// curl -F 'text={"name":"Inu","symbol":"ino","image":"https://coinmarketcap.com/currencies/apecoin-ape/"}'    http://3.16.42.100:9094/add\?meta-jetton\=ape
