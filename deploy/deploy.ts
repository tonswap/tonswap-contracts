import { TonClient, Address } from "ton";
import { JettonMinter } from "../src/jetton-minter";
import { initDeployKey, initWallet, printBalances, printDeployerBalances, sleep } from "../utils/deploy-utils";
import { addLiquidity, BLOCK_TIME, deployAmmMinter, deployJettonMinter, mintJetton, saveAddress } from "./deploy-utils";

const client = new TonClient({
    endpoint: "https://sandbox.tonhubapi.com/jsonRPC",
    // endpoint: "https://testnet.tonhubapi.com/jsonRPC",
    // endpoint: "https://scalable-api.tonwhales.com/jsonRPC",
    // endpoint: "https://testnet.toncenter.com/api/v2/jsonRPC",
});

async function deployPool(ammContentUri: string) {
    const walletKey = await initDeployKey();
    let { wallet: deployWallet } = await initWallet(client, walletKey.publicKey);
    saveAddress("Deployer", deployWallet.address);
    const ammMinter = await deployAmmMinter(client, deployWallet, walletKey.secretKey, ammContentUri);
}

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

    await addLiquidity(client, ammMinter, deployWallet, deployerUSDCAddress as Address, walletKey.secretKey);
    await sleep(BLOCK_TIME * 2);

    await printBalances(client, ammMinter, deployWallet.address, deployerUSDCAddress);
}

(async () => {
    if (process.env.npm_lifecycle_event == "deploy") {
        await deployPool(process.env.POOL_CONTENT_URI || "https://api.jsonbin.io/b/62a0436b05f31f68b3b97ac4");
        return;
    }

    // await deployJettonAmmLiquidity(
    //     "https://api.jsonbin.io/b/628f1df905f31f77b3a7c5d0",
    //     "https://api.jsonbin.io/b/628f1df905f31f77b3a7c5d1"
    // );
})();
