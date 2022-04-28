const TonWeb = require("tonweb");
const { Contract, Cell, parseAddress, createOffchainUriCell } = require("tonweb");
const Address = TonWeb.utils.Address;
import BN from "bn.js";
import { compileFuncToB64 } from "../funcToB64";

const AMM_WALLET_CODE_HEX = compileFuncToB64([
    "src/amm/stdlib-jetton-wallet.func",
    "src/amm/op-codes.func",
    "src/amm/params.func",
    "src/amm/amm-utils.func",
    "src/amm/amm-wallet.func",
    "src/amm/msg_hex_comment.func",
]);



class AmmMinter extends Contract {
    /**
     * @param provider
     * @param options   {{adminAddress: Address, jettonContentUri: string, jettonWalletCodeHex: string, address?: Address | string, code?: Cell}}
     */
    constructor(provider, options) {
        options.wc = 0;
        options.code = options.code || Cell.oneFromBoc(AMM_WALLET_CODE_HEX);
        super(provider, options);
    }

    /**
     * @override
     * @private
     * @return {Cell} cell contains jetton minter data
     */
    createDataCell() {
        const cell = new Cell();
        cell.bits.writeCoins(0); // total supply
        cell.bits.writeAddress(this.options.adminAddress);
        cell.refs[0] = createOffchainUriCell(this.options.jettonContentUri);
        cell.refs[1] = Cell.oneFromBoc(this.options.jettonWalletCodeHex);
        return cell;
    }

    /**
     * params   {{jettonAmount: BN, destination: Address, amount: BN, queryId?: number}}
     * @return {Cell}
     */
    createMintBody(params) {
        const body = new Cell();
        body.bits.writeUint(21, 32); // OP mint
        body.bits.writeUint(params.queryId || 0, 64); // query_id
        body.bits.writeAddress(params.destination);
        body.bits.writeCoins(params.amount); // in Toncoins

        const transferBody = new Cell(); // internal transfer
        transferBody.bits.writeUint(0x178d4519, 32); // internal_transfer op
        transferBody.bits.writeUint(params.queryId || 0, 64);
        transferBody.bits.writeCoins(params.jettonAmount);
        transferBody.bits.writeAddress(null); // from_address
        transferBody.bits.writeAddress(null); // response_address
        transferBody.bits.writeCoins(new BN(0)); // forward_amount
        transferBody.bits.writeBit(false); // forward_payload in this slice, not separate cell

        body.refs[0] = transferBody;
        return body;
    }

    /**
     * @return {Promise<{ totalSupply: BN, isMutable: boolean, adminAddress: Address|null, jettonContentUri: string, tokenWalletCode: Cell }>}
     */
    async getJettonData() {
        const myAddress = await this.getAddress();
        const result = await this.provider.call2(myAddress.toString(), "get_jetton_data");

        const totalSupply = result[0];
        const isMutable = result[1].toNumber() === -1;
        const adminAddress = parseAddress(result[2]);
        const jettonContentUri = parseOffchainUriCell(result[3]);
        const tokenWalletCode = result[4];

        return { totalSupply, isMutable, adminAddress, jettonContentUri, tokenWalletCode };
    }
}

module.exports = { ammMinter: AmmMinter };
