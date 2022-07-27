import { SmartContract } from "ton-contract-executor";
import { Address, Cell, CellMessage, InternalMessage, Slice, CommonMessageInfo, ExternalMessage, TonClient, toNano } from "ton";
import BN from "bn.js";
import { toUnixTime, toDecimals, parseInternalMessageResponse } from "./utils";
import { OPS } from "./ops";
import { compileFuncToB64 } from "../utils/funcToB64";
import { bytesToAddress } from "../utils/deploy-utils";
const ZERO_ADDRESS = Address.parse("EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c");
type UsdcTransferNextOp = OPS.REMOVE_LIQUIDITY;

export class AmmLpWallet {
    private initTime: number = Date.now();
    public address: Address = ZERO_ADDRESS;
    private constructor(public readonly contract: SmartContract) {}

    async getData() {
        let res = await this.contract.invokeGetMethod("get_wallet_data", []);
        const balance = res.result[0] as BN;
        const owner = res.result[1] as Slice;
        const jettonMaster = res.result[2] as Slice;
        const code = res.result[3] as Cell;
        const stakeStart = res.result[4] as BN;

        return {
            balance,
            owner,
            jettonMaster,
            code,
            stakeStart,
        };
    }

    async sendInternalMessage(message: InternalMessage) {
        const res = await this.contract.sendInternalMessage(message);
        return parseInternalMessageResponse(res);
    }

    async init(fakeAddress: Address) {
        let messageBody = new Cell();
        messageBody.bits.writeUint(1, 1);
        let msg = new CommonMessageInfo({ body: new CellMessage(messageBody) });

        let res = await this.contract.sendExternalMessage(
            new ExternalMessage({
                to: fakeAddress,
                body: msg,
            })
        );
        return res;
    }

    async removeLiquidity(amount: BN, responseAddress: Address, from: Address, to: Address, value = new BN(100000000)) {
        let messageBody = AmmLpWallet.RemoveLiquidityMessage(amount, responseAddress);
        let res = await this.contract.sendInternalMessage(
            new InternalMessage({
                from: from,
                to: to,
                value,
                bounce: false,
                body: new CommonMessageInfo({ body: new CellMessage(messageBody) }),
            })
        );

        return parseInternalMessageResponse(res);
    }
    static async GetWalletAddress(client: TonClient, minterAddress: Address, walletAddress: Address) {
        try {
            let cell = new Cell();
            cell.bits.writeAddress(walletAddress);
            let b64dataBuffer = (await cell.toBoc({ idx: false })).toString("base64");
            let res = await client.callGetMethod(minterAddress, "get_wallet_address", [["tvm.Slice", b64dataBuffer]]);

            return bytesToAddress(res.stack[0][1].bytes);
        } catch (e) {
            console.log("exception", e);
        }
    }
    static async GetWalletData(client: TonClient, jettonWallet: Address) {
        let res = await client.callGetMethod(jettonWallet, "get_wallet_data", []);

        const balance = BigInt(res.stack[0][1]);
        const owner = bytesToAddress(res.stack[1][1].bytes);
        const jettonMaster = bytesToAddress(res.stack[2][1].bytes);

        return {
            balance,
            owner,
            jettonMaster,
        };
    }

    static RemoveLiquidityMessage(amount: BN, responseAddress: Address) {
        let messageBody = new Cell();
        messageBody.bits.writeUint(OPS.Burn, 32); // action
        messageBody.bits.writeUint(1, 64); // query-id
        messageBody.bits.writeCoins(amount);
        messageBody.bits.writeAddress(responseAddress);
        return messageBody;
    }

    //    transfer#f8a7ea5 query_id:uint64 amount:(VarUInteger 16) destination:MsgAddress
    //    response_destination:MsgAddress custom_payload:(Maybe ^Cell)
    //    forward_ton_amount:(VarUInteger 16) forward_payload:(Either Cell ^Cell)
    //    = InternalMsgBody;

    async transferOverloaded(
        from: Address,
        to: Address,
        amount: BN,
        responseDestination: Address,
        customPayload: Cell | undefined,
        forwardTonAmount: BN = new BN(0),
        overloadOp: UsdcTransferNextOp,
        overloadValue: BN
    ) {
        let messageBody = new Cell();
        messageBody.bits.writeUint(OPS.Transfer, 32); // action
        messageBody.bits.writeUint(1, 64); // query-id
        messageBody.bits.writeCoins(amount);
        messageBody.bits.writeAddress(to);
        messageBody.bits.writeAddress(responseDestination);
        messageBody.bits.writeBit(false); // null custom_payload
        messageBody.bits.writeCoins(forwardTonAmount);
        messageBody.bits.writeBit(false); // forward_payload in this slice, not separate messageBody
        messageBody.bits.writeUint(new BN(overloadOp), 32);
        // if (overloadOp == OPS.ADD_LIQUIDITY){
        //     messageBody.bits.writeUint(overloadOp ,32);  // slippage
        // } else if (overloadOp == OPS.SWAP_TOKEN) {
        //     messageBody.bits.writeCoins(overloadValue);  // min amount out
        // }

        let res = await this.contract.sendInternalMessage(
            new InternalMessage({
                from: from,
                to: to,
                value: toNano(1),
                bounce: false,
                body: new CommonMessageInfo({ body: new CellMessage(messageBody) }),
            })
        );
        return parseInternalMessageResponse(res);
    }

    async transfer(from: Address, to: Address, amount: BN, responseDestination: Address, forwardTonAmount: BN = new BN(0)) {
        let messageBody = new Cell();
        messageBody.bits.writeUint(OPS.Transfer, 32); // action
        messageBody.bits.writeUint(1, 64); // query-id
        messageBody.bits.writeCoins(amount);
        messageBody.bits.writeAddress(to);
        messageBody.bits.writeAddress(responseDestination);
        messageBody.bits.writeBit(false); // null custom_payload
        messageBody.bits.writeCoins(forwardTonAmount);
        messageBody.bits.writeBit(false); // forward_payload in this slice, not separate messageBody

        let res = await this.contract.sendInternalMessage(
            new InternalMessage({
                from: from,
                to: to,
                value: toNano(1),
                bounce: false,
                body: new CommonMessageInfo({ body: new CellMessage(messageBody) }),
            })
        );
        return parseInternalMessageResponse(res);
    }

    setUnixTime(time: number) {
        this.initTime = time;
        this.contract.setUnixTime(time);
    }

    forwardTime(time: number, contractCurrentTime?: number) {
        let newTime = contractCurrentTime || this.initTime + time;
        this.contract.setUnixTime(newTime);
        return newTime;
    }

    static compileWallet() {
        const ammWalletCodeB64: string = compileFuncToB64(["contracts/amm-wallet.fc"]);
        return Cell.fromBoc(ammWalletCodeB64);
    }

    static async createFromMessage(code: Cell, data: Cell, initMessage: InternalMessage) {
        const ammWallet = await SmartContract.fromCell(code, data, { getMethodsMutate: true });
        const instance = new AmmLpWallet(ammWallet);
        instance.setUnixTime(toUnixTime(Date.now()));
        const initMessageResponse = await ammWallet.sendInternalMessage(initMessage);
        //console.log('amm-wallet -> initMessageResponse', initMessageResponse);
        instance.address = initMessage.to;

        instance.contract.setC7Config({
            myself: initMessage.to,
        });
        return instance;
    }
}

// async function buildDataCell(totalSupply: BN, admin: Address, content: string, tokenCode: Cell) {

//     // ds~load_coins(), ;; total_supply
//     //   ds~load_msg_addr(), ;; admin_address
//     //   ds~load_ref(), ;; content
//     //   ds~load_ref()  ;; jetton_wallet_code

//     const contentCell = new Cell();
//     contentCell.bits.writeString(content);

//     let dataCell = new Cell()
//     dataCell.bits.writeCoins(totalSupply);
//     dataCell.bits.writeAddress(admin)                           // name
//     dataCell.refs.push(contentCell);
//     dataCell.refs.push(tokenCode);
//     return dataCell
// }
