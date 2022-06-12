import BN from "bn.js";
import { TonClient, Address, toNano } from "ton";
import { JettonMinter } from "../src/jetton-minter";

import {
    initDeployKey,
    initWallet,
    printBalances,
    printDeployerBalances,
    sleep,
    addLiquidity,
    BLOCK_TIME,
    deployAmmMinter,
    deployJettonMinter,
    mintJetton,
    saveAddress,
    removeLiquidity,
} from "./deploy-utils";

const client = new TonClient({
    // endpoint: "https://sandbox.tonhubapi.com/jsonRPC",
    // endpoint: "https://testnet.tonhubapi.com/jsonRPC",
     endpoint: "https://scalable-api.tonwhales.com/jsonRPC",
    // endpoint: "https://testnet.toncenter.com/api/v2/jsonRPC",
});

async function deployPool(ammContentUri: string) {
    const walletKey = await initDeployKey();
    let { wallet: deployWallet } = await initWallet(client, walletKey.publicKey);
    saveAddress("Deployer", deployWallet.address);
    const ammMinter = await deployAmmMinter(client, deployWallet, walletKey.secretKey, ammContentUri);
}
/**
 * this procedure
 * deploy's a jetton contract
 * mint some jetton's on behalf of the deployer
 * deploys an amm contract
 * adds liquidity to the amm
 */
async function deployJettonAmmLiquidity(jettonContentUri: string, ammContentUri: string) {
    const walletKey = await initDeployKey();
    let { wallet: deployWallet } = await initWallet(client, walletKey.publicKey);
    saveAddress("Deployer", deployWallet.address);

    const jettonMinter = await deployJettonMinter(client, deployWallet, walletKey.secretKey, jettonContentUri);
    await mintJetton(client, jettonMinter.address, deployWallet, walletKey.secretKey);

    const deployerUSDCAddress = (await JettonMinter.GetWalletAddress(client, jettonMinter.address, deployWallet.address)) as Address;
    saveAddress("DeployerUSDC", deployerUSDCAddress);
    printDeployerBalances(client, deployWallet.address, deployerUSDCAddress);

    const ammMinter = await deployAmmMinter(client, deployWallet, walletKey.secretKey, ammContentUri);

    console.log(`
        Jetton Minter address :${jettonMinter.address.toFriendly()}
        Amm Minter address :${ammMinter.address.toFriendly()}
    `);

    await addLiquidity(client, ammMinter, deployWallet, deployerUSDCAddress as Address, walletKey.secretKey, 1, toNano(10));
    await sleep(BLOCK_TIME * 2);

    await printBalances(client, ammMinter, deployWallet.address, deployerUSDCAddress);
}


async function mintJettons(jettonContentUri: string, mintAmount = 100, recipient?: Address) {
    const walletKey = await initDeployKey();
    let { wallet: deployWallet } = await initWallet(client, walletKey.publicKey);
    saveAddress("Deployer", deployWallet.address);

    const jettonMinter = await deployJettonMinter(client, deployWallet, walletKey.secretKey, jettonContentUri);
    await mintJetton(client, jettonMinter.address, deployWallet, walletKey.secretKey, mintAmount, recipient || deployWallet.address);
}


async function deployerRemoveLiquidity(jettonContentUri: string, ammContentUri: string) {
    const walletKey = await initDeployKey();
    let { wallet: deployWallet } = await initWallet(client, walletKey.publicKey);
    saveAddress("Deployer", deployWallet.address);

    const ammMinter = await deployAmmMinter(client, deployWallet, walletKey.secretKey, ammContentUri);

    await removeLiquidity(client, ammMinter, deployWallet, walletKey.secretKey, 64);
}

(async () => {
    if (process.env.npm_lifecycle_event == "deploy") {
        await deployPool(process.env.POOL_CONTENT_URI || "https://api.jsonbin.io/xxx/62a0436b05f31f68b3b97ac4");
        return;
    }

    //  await deployJettonAmmLiquidity(
    //      "https://api.jsonbin.io/b/x628f1df905f31f77b3a7c5d0-usdt",
    //      "https://api.jsonbin.io/b/x628f1df905f31f77b3a7c5d1-usdt"
    //  );

    // await mintJettons("https://api.jsonbin.io/b/x628f1df905f31f77b3a7c5d0-shib", 50, Address.parse("EQDjhy1Ig-S0vKCWwd3XZRKODGx0RJyhqW37ZDMl-pgv8iBr"));

    // await deployerRemoveLiquidity(
    //     "https://api.jsonbin.io/b/x628f1df905f31f77b3a7c5d0",
    //     "https://api.jsonbin.io/b/x628f1df905f31f77b3a7c5d1"
    // );
})();



// await deployJettonAmmLiquidity(
//     "https://api.jsonbin.io/b/x628f1df905f31f77b3a7c5d0-shib",
//     "https://api.jsonbin.io/b/x628f1df905f31f77b3a7c5d1-shib"
// );