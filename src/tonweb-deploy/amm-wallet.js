const TonWeb = require("tonweb");
const { Contract, Cell, parseAddress } = require("tonweb");
const Address = TonWeb.utils.Address;
const BN = require("bn.js");
const { compileFuncToB64 } = require("../funcToB64");

const AMM_WALLET_CODE_HEX = compileFuncToB64([
    "src/amm/stdlib-jetton-wallet.func",
    "src/amm/op-codes.func",
    "src/amm/params.func",
    "src/amm/amm-utils.func",
    "src/amm/amm-wallet.func",
    "src/amm/msg_hex_comment.func",
]);

/**
 * ATTENTION: this is DRAFT, there will be changes
 */
class AmmWallet extends Contract {
    /**
     * @param provider
     * @param options   {{address?: Address | string, code?: Cell}}
     */
    constructor(provider, options) {
        options.wc = 0;
        options.code = options.code || Cell.oneFromBoc(AMM_WALLET_CODE_HEX);
        super(provider, options);
    }

    /**
     * @param params    {{queryId?: number, jettonAmount: BN, toAddress: Address, responseAddress: Address, forwardAmount: BN, forwardPayload: Uint8Array}}
     */
    async createTransferBody(params) {
        const cell = new Cell();
        cell.bits.writeUint(0xf8a7ea5, 32); // request_transfer op
        cell.bits.writeUint(params.queryId || 0, 64);
        cell.bits.writeCoins(params.jettonAmount);
        cell.bits.writeAddress(params.toAddress);
        cell.bits.writeAddress(params.responseAddress);
        cell.bits.writeBit(false); // null custom_payload
        cell.bits.writeCoins(params.forwardAmount || new BN(0));
        cell.bits.writeBit(false); // forward_payload in this slice, not separate cell
        if (params.forwardPayload) {
            cell.bits.writeBytes(params.forwardPayload);
        }
        return cell;
    }

    /**
     * @param params    {{queryId?: number, jettonAmount: BN, responseAddress: Address}}
     */
    async createRemoveLiqudity(params) {
        const cell = new Cell();
        cell.bits.writeUint(0x595f07bc, 32); // burn op
        cell.bits.writeUint(params.queryId || 0, 64);
        cell.bits.writeCoins(params.jettonAmount);
        cell.bits.writeAddress(params.responseAddress);
        return cell;
    }

    async getData() {
        const myAddress = await this.getAddress();
        const result = await this.provider.call2(myAddress.toString(), "get_wallet_data");

        const balance = result[0];
        const ownerAddress = parseAddress(result[1]);
        const jettonMinterAddress = parseAddress(result[2]);
        const jettonWalletCode = result[3];

        return { balance, ownerAddress, jettonMinterAddress, jettonWalletCode };
    }
}

AmmWallet.codeHex = AMM_WALLET_CODE_HEX;

module.exports = { AmmWallet };
