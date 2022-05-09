import { mnemonicNew, mnemonicToWalletKey } from "ton-crypto";
import * as fs from "fs";
import { Address, Cell } from "ton";

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
        console.log(`sleeping for  ${time} Zzzzz....`);

        setTimeout(resolve, time);
    });
}
