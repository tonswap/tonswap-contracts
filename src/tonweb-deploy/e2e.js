const TonWeb = require('tonweb');
const ammWallet = require("./amm-wallet")
const {buildAddLiquidityCell, buildSwapJettonCell} = require("./amm-actions");
const { Cell, Address } = require('ton');
 

const { JettonMinter, JettonWallet } = TonWeb.token.jetton;

const S1 = "vt58J2v6FaSuXFGcyGtqT5elpVxcZ+I1zgu/GUfA5uY=";
const S2 = "vt58J2v6FaSuXFGcyGtqT5elpVxcZ+I1zgu/GUfA5uY=";


const init = async () => {
    const tonweb = new TonWeb(
        new TonWeb.HttpProvider("https://testnet.toncenter.com/api/v2/jsonRPC", { apiKey: "f20ff0043ded8c132d0b4b870e678b4bbab3940788cbb8c8762491935cf3a460" } )
    );
    const AMM_ADDRESS = "EQB6-6po0yspb68p7RRetC-hONAz-JwxG9514IEOKw_llXd5";
    const seed = TonWeb.utils.base64ToBytes(S1);
    const seed2 = TonWeb.utils.base64ToBytes(S2);
    const keyPair = TonWeb.utils.nacl.sign.keyPair.fromSeed(seed);
    let walletAddress;

    const initWallet = async (tonweb) => {
        
        const WalletClass = tonweb.wallet.all["v3R1"];
        const wallet = new WalletClass(tonweb.provider, {
            publicKey: keyPair.publicKey,
            wc: 0,
        });
        walletAddress = await wallet.getAddress();
        console.log("wallet address=", walletAddress.toString(true, true, true));
        return wallet;
    }

    const initUSDCMinter = async (tonweb) => {
        
        const minter = new JettonMinter(tonweb.provider, {
            adminAddress: walletAddress,
            jettonContentUri: "http://tonswap.co/token/usdc2.json",
            jettonWalletCodeHex: JettonWallet.codeHex,
        });
        return minter;
    }


    const deployUSDCMinter = async (minter, wallet) => {
        const seqno = (await wallet.methods.seqno().call()) || 0;
        console.log('deployUSDCMinter', { seqno });
        const minterAddress = await minter.getAddress();
        console.log(
            await wallet.methods
                .transfer({
                    secretKey: keyPair.secretKey,
                    toAddress: minterAddress.toString(true, true, true),
                    amount: TonWeb.utils.toNano(0.5),
                    seqno: seqno,
                    payload: null, // body
                    sendMode: 3,
                    stateInit: (await minter.createStateInit()).stateInit,
                })
                .send()
        );
    };

    const getMinterInfo = async (minter) => {
        const data = await minter.getJettonData();
        data.totalSupply = data.totalSupply.toString();
        data.adminAddress = data.adminAddress.toString(true, true, true);
        console.log(data);
    };

    const mintUSDC = async (minter, amount) => {
        const seqno = (await wallet.methods.seqno().call()) || 0;
        console.log('mintin USDC seqno:',{ seqno });
        const minterAddress = await minter.getAddress();

        console.log(
            await wallet.methods
                .transfer({
                    secretKey: keyPair.secretKey,
                    toAddress: minterAddress.toString(true, true, true),
                    amount: TonWeb.utils.toNano("0.05"),
                    seqno: seqno,
                    payload: await minter.createMintBody({
                        jettonAmount: TonWeb.utils.toNano(amount),
                        destination: walletAddress,
                        amount: TonWeb.utils.toNano("0.04"),
                    }),
                    sendMode: 3,
                })
                .send()
        );
    };

    const getJettonWalletInfo = async () => {
        const data = await jettonWallet.getData();
        data.balance = data.balance.toString();
        data.ownerAddress = data.ownerAddress.toString(true, true, true);
        data.jettonMinterAddress = data.jettonMinterAddress.toString(true, true, true);
        console.log(data);
    };

    const transfer = async (wallet, to ) => {
        const seqno = (await wallet.methods.seqno().call()) || 0;
        console.log({ seqno });

        console.log(
            await wallet.methods
                .transfer({
                    secretKey: keyPair.secretKey,
                    toAddress: JETTON_WALLET_ADDRESS,
                    amount: TonWeb.utils.toNano(0.4),
                    seqno: seqno,
                    payload: await jettonWallet.createTransferBody({
                        jettonAmount: TonWeb.utils.toNano("500"),
                        toAddress: new TonWeb.utils.Address(to),
                        forwardAmount: TonWeb.utils.toNano(0.1),
                        forwardPayload: new TextEncoder().encode("gift"),
                        responseAddress: walletAddress,
                    }),
                    sendMode: 3,
                })
                .send()
        );
    };

    const addLiquidity = async (wallet, jettonWalletAddress , ammAddress) => {
        const seqno = (await wallet.methods.seqno().call()) || 0;
        console.log({ seqno });

        console.log(
            await wallet.methods
                .transfer({
                    secretKey: keyPair.secretKey,
                    toAddress: jettonWalletAddress,
                    amount: TonWeb.utils.toNano(0.4),
                    seqno: seqno,
                    payload: await buildAddLiquidityCell({
                        jettonAmount: TonWeb.utils.toNano("500"),
                        toAddress: new TonWeb.utils.Address(ammAddress),
                        forwardAmount: TonWeb.utils.toNano(0.1),
                        forwardPayload: new TextEncoder().encode("gift"),
                        responseAddress: walletAddress,
                    }),
                    sendMode: 3,
                })
                .send()
        );
    };

    const burn = async (wallet) => {
        const seqno = (await wallet.methods.seqno().call()) || 0;
        console.log({ seqno });

        console.log(
            await wallet.methods
                .transfer({
                    secretKey: keyPair.secretKey,
                    toAddress: JETTON_WALLET_ADDRESS,
                    amount: TonWeb.utils.toNano(0.4),
                    seqno: seqno,
                    payload: await jettonWallet.createBurnBody({
                        jettonAmount: TonWeb.utils.toNano("400"),
                        responseAddress: walletAddress,
                    }),
                    sendMode: 3,
                })
                .send()
        );
    };

    const getJettonWalletAddress = async (tonweb, contractAddress) => {
        console.log('1',contractAddress);
        try {
            let cell = new Cell();
            cell.bits.writeAddress(Address.parse("EQD4FPq-PRDieyQKkizFTRtSDyucUIqrj0v_zXJmqaDp6_0t"))
            let boc = await cell.toString();
            let addressBoc = stripBoc(boc);
            let res = await tonweb.call(contractAddress, "get_wallet_address", [["cell", addressBoc]]);
            console.log('ok',res);
        } catch (e) {
            console.log('excption',e);
        }
    }



    let wallet = await initWallet(tonweb);
    let usdcMinter = await initUSDCMinter(tonweb, wallet);
    await deployUSDCMinter(usdcMinter, wallet);

    const minterAddress = await usdcMinter.getAddress();
    const alice = minterAddress.toString(true, true, true);
    console.log("alice ", alice);
    console.log(minterAddress);

    console.log( await getJettonWalletAddress(tonweb, minterAddress));

    // await sleepBlock();
    // console.log(await getMinterInfo(usdcMinter));
    // await sleepBlock();
    // await mintUSDC(usdcMinter, 555);
    // await sleepBlock();
    // console.log(await getMinterInfo(usdcMinter));

    // await addLiquidity(wallet, JETTON_WALLET_ADDRESS, AMM_ADDRESS)







    // await transfer(wallet);
    // await burn(wallet);


    // await deployMinter();
    // await getMinterInfo();
    // await mint();
    // await getJettonWalletInfo();
    // await transfer();
    // await burn();
};

init();


function stripBoc(bocStr) {
    //console.log(`parsing boc ${bocStr}`);
    return bocStr.substr(2, bocStr.length - 4);
}



async function sleepBlock() {
    const block = 10000;
    console.log('sleep for ',block);
    return new Promise((resolve) => {
        setTimeout(resolve, block);
    })
}