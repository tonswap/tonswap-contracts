import { mnemonicNew, mnemonicToWalletKey } from "ton-crypto";
import * as fs from "fs";
import { Address, Cell, fromNano, TonClient, WalletContract, WalletV3R2Source } from "ton";
import { AmmMinter } from "../amm/amm-minter";
import { JettonWallet } from "../jetton/jetton-wallet";
import BN from "bn.js";

export async function initDeployKey() {
    const deployConfigJson = `./build/deploy.config.json`;
    const deployerWalletType = "org.ton.wallets.v3.r2";
    let deployerMnemonic;
    if (!fs.existsSync(deployConfigJson)) {
        console.log(
            `\n* Config file '${deployConfigJson}' not found, creating a new wallet for deploy..`
        );
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
        console.log(`
        💤 ${time / 1000}s ...
        `);

        setTimeout(resolve, time);
    });
}
export async function printDeployerBalances(client: TonClient, deployerUSDCAddress: Address) {
    const usdcData = await JettonWallet.GetData(client, deployerUSDCAddress);
    console.log(``);
    console.log(`⛏ Deployer has ${bnFmt(usdcData.balance)}$ USDC `);
}

export async function printAmmData(client: TonClient, ammMinterAddress: Address) {
    const data = await AmmMinter.GetJettonData(client, ammMinterAddress);
    console.log(`-----==== AmmMinter ====-----
    💰 totalSupply: ${hexToBn(data.totalSupply)} (${bnFmt(hexToBn(data.totalSupply))})
    💰 tonReserves: ${hexToBn(data.tonReserves)} (${bnFmt(hexToBn(data.tonReserves))})
    💰 tokenReserves: ${hexToBn(data.tokenReserves)} (${bnFmt(hexToBn(data.tokenReserves))})
    `);
}

export function hexToBn(num: string) {
    return new BN(BigInt(num).toString());
}

export function bnFmt(num: BN | BigInt) {
    let str = num.toString();
    if (str.length < 10) {
        let iNum = parseInt(num.toString());
        let float = iNum * 0.000000001;
        return float.toFixed(10 - str.length);
    }
    let formatNum =
        str.substring(0, str.length - 9) + "." + str.substring(str.length - 9, str.length - 1);
    return formatNum;
}

export function hexFromNano(num: string) {
    const res = BigInt(num) / BigInt(100000000);
    return res.toString();
}

export function printAddresses(addressBook: { [key: string]: string }) {
    console.log(``); //br
    for (var key in addressBook) {
        console.log(`${addressBook[key]} : https://test.tonwhales.com/explorer/address/${key}`);
    }
    console.log(``);
}

export async function initWallet(client: TonClient, publicKey: Buffer, workchain = 0) {
    const wallet = await WalletContract.create(
        client,
        WalletV3R2Source.create({ publicKey: publicKey, workchain })
    );
    console.log(
        `Init wallet ${wallet.address.toFriendly()} | balance: ${fromNano(
            await client.getBalance(wallet.address)
        )} 
| seqno: ${await wallet.getSeqNo()}`
    );

    return wallet;
}
