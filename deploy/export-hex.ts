import { compileFuncToB64 } from "../utils/funcToB64";
import { writeFileSync } from "fs";
import {execSync} from "child_process"

function main() {
    let getCommitHash = execSync(`git log --format="%H" -n 1`).toString().trim()
    const ammMinterCodeB64: string = compileFuncToB64(["contracts/amm-minter.fc"]);
    writeFileSync(`./build/minter.build.json`, `{ "hex":"${ammMinterCodeB64}", "commitHash":"${getCommitHash}" }`);
    const ammWalletCode: string = compileFuncToB64(["contracts/amm-wallet.fc"]);
    writeFileSync(`./build/wallet.build.json`, `{ "hex":"${ammWalletCode}", "commitHash":"${getCommitHash}" }`);
}

main();
