import { compileFuncToB64 } from "../utils/funcToB64";
import { writeFileSync } from "fs";

function main() {
    const ammMinterCodeB64: string = compileFuncToB64(["contracts/amm-minter.fc"]);
    writeFileSync(`./build/minter.build.json`, `{ "hex":"${ammMinterCodeB64}"}`);
    const ammWalletCode: string = compileFuncToB64(["contracts/amm-wallet.fc"]);
    writeFileSync(`./build/wallet.build.json`, `{ "hex":"${ammWalletCode}"}`);
}

main();
