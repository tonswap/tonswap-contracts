import { Address, beginCell, Cell, toNano, TonClient } from "ton";
import { AmmMinterBase } from "../src/amm-minter";
import { initDeployKey, initWallet, sendTransaction, sleep, waitForSeqno } from "../utils/deploy-utils";

const client = new TonClient({
    endpoint: "https://scalable-api.tonwhales.com/jsonRPC",
});

const OP_CODE_UPGRADE = 26;

async function setWallet() {
    const walletKey = await initDeployKey();
    let { wallet } = await initWallet(client, walletKey.publicKey);
    return {
        wallet,
        walletKey
    }
}

async function getUpgradeMessage() {
    
    const ammMinterRPC = new AmmMinterBase();
    const codeB64 = ammMinterRPC.compileCodeToCell();
    const upgradeMessage = beginCell().storeUint(OP_CODE_UPGRADE, 32).storeUint(1, 64).storeRef(codeB64[0]).endCell();
    return upgradeMessage;
}

async function getCodeHash(address: Address, client: TonClient) {
    const state = await client.getContractState(address);
    let code = Cell.fromBoc(state.code!)[0]
    return code.hash().toString("base64")
}


async function upgradeAmm(address: Address) {
    console.log(`> Starting Upgraded Flow for ${address.toFriendly()} code hash: ${(await getCodeHash(address, client))}`);
    
    const { wallet , walletKey } = await setWallet()
    const upgradeMessage = await getUpgradeMessage();
    await sendTransaction(client, wallet, address, toNano(0.1), walletKey.secretKey, upgradeMessage, true, 3)
    await sleep(20 * 1000);
    console.log(`> Finnish Upgraded Flow for ${address.toFriendly()} code hash: ${(await getCodeHash(address, client))}`);
}

async function main() {
    upgradeAmm(Address.parse("EQAG57v8WL4U188JmkFJZd5VIbqoFfwx3trefJbfJ5pD1JAP"))
}

(async ()=> {
    await main()
})()