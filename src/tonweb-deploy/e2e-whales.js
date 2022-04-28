import { Address, TonClient } from "ton";

const client = new TonClient({
  endpoint: "https://scalable-api.tonwhales.com/jsonRPC",
});

const getAddress = async (tonweb, contractAddress) => {
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