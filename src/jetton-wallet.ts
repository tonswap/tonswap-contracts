// @ts-ignore
import { SmartContract, SuccessfulExecutionResult, FailedExecutionResult, parseActionsList, OutAction } from "ton-contract-executor";
import { Address, Cell, CellMessage, InternalMessage, Slice, CommonMessageInfo, TonClient, toNano, beginCell } from "ton";
import BN from "bn.js";
import { toUnixTime, parseInternalMessageResponse, filterLogs, sliceToAddress, writeString } from "./utils";
import { OPS } from "./ops";
import { bytesToAddress } from "../utils/deploy-utils";
const ZERO_ADDRESS = Address.parse("EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c");
export declare type ExecutionResult = FailedExecutionResult | SuccessfulExecutionResult;

import { iTvmBusContract, TvmBus } from "ton-tvm-bus";
import { compileFuncToB64 } from "../utils/funcToB64";

type UsdcTransferNextOp = OPS.ADD_LIQUIDITY | OPS.SWAP_TOKEN;

export class JettonWallet implements iTvmBusContract {
    public initMessageResult: { logs?: string; actionsList?: OutAction[] } = {};
    public address = ZERO_ADDRESS;
    public initMessageResultRaw?: ExecutionResult;

    private constructor(public readonly contract: SmartContract) {}

    static getCodeCell(): Cell[] {
        const jettonWalletCodeB64: string = compileFuncToB64(["test/jetton-wallet.fc"]);
        return Cell.fromBoc(jettonWalletCodeB64);
    }

    async getData() {
        let res = await this.contract.invokeGetMethod("get_wallet_data", []);
        const balance = res.result[0] as BN;
        const owner = res.result[1] as Slice;
        const jettonMaster = res.result[2] as Slice;
        const code = res.result[3] as Cell;

        return {
            balance,
            owner,
            jettonMaster: sliceToAddress(jettonMaster),
            code,
        };
    }
    //BUS implementation
    sendInternalMessage(message: InternalMessage) {
        return this.contract.sendInternalMessage(message);
    }

    async sendInternalMessage2(message: InternalMessage) {
        const res = await this.contract.sendInternalMessage(message);
        return parseInternalMessageResponse(res);
    }

    //    transfer#f8a7ea5 query_id:uint64 amount:(VarUInteger 16) destination:MsgAddress
    //    response_destination:MsgAddress custom_payload:(Maybe ^Cell)
    //    forward_ton_amount:(VarUInteger 16) forward_payload:(Either Cell ^Cell)
    //    = InternalMsgBody;

    static TransferOverloaded(
        to: Address,
        jettonAmount: BN,
        responseDestination: Address,
        forwardTonAmount: BN = new BN(0),
        overloadOp: UsdcTransferNextOp,
        overloadValue: BN,
        tonLiquidity?: BN
    ) {
        let messageBody = new Cell();
        messageBody.bits.writeUint(OPS.Transfer, 32); // action
        messageBody.bits.writeUint(1, 64); // query-id
        messageBody.bits.writeCoins(jettonAmount);
        messageBody.bits.writeAddress(to);
        messageBody.bits.writeAddress(responseDestination);
        messageBody.bits.writeBit(false); // null custom_payload
        messageBody.bits.writeCoins(forwardTonAmount);
        messageBody.bits.writeBit(false); // forward_payload in this slice, not separate messageBody
        messageBody.bits.writeUint(new BN(overloadOp), 32);
        if (overloadOp == OPS.ADD_LIQUIDITY && tonLiquidity) {
            messageBody.bits.writeUint(overloadValue, 32); // slippage
            messageBody.bits.writeCoins(tonLiquidity);
        } else if (overloadOp == OPS.SWAP_TOKEN) {
            messageBody.bits.writeCoins(overloadValue); // min amount out
        }
        return messageBody;
    }

    async transfer(
        from: Address,
        to: Address,
        amount: BN,
        responseDestination: Address,
        customPayload: Cell | undefined,
        forwardTonAmount: BN = new BN(0),
        overloadOp: UsdcTransferNextOp,
        overloadValue: BN,
        tonLiquidity?: BN
    ) {
        const messageBody = JettonWallet.TransferOverloaded(
            to,
            amount,
            responseDestination,
            forwardTonAmount,
            overloadOp,
            overloadValue,
            tonLiquidity
        );

        let res = await this.contract.sendInternalMessage(
            new InternalMessage({
                from: from,
                to: to,
                value: forwardTonAmount.add(toNano("0.08")), // TODO
                bounce: false,
                body: new CommonMessageInfo({ body: new CellMessage(messageBody) }),
            })
        );

        let successResult = res as SuccessfulExecutionResult;

        return {
            ...res,
            returnValue: res.result[1] as BN,
            logs: filterLogs(res.logs),
        };
    }

    setUnixTime(time: number) {
        this.contract.setUnixTime(time);
    }

    static async GetData(client: TonClient, jettonWallet: Address) {
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

    static async createFromMessage(code: Cell, data: Cell, initMessage: InternalMessage, tvmBus?: TvmBus): Promise<iTvmBusContract> {
        const jettonWallet = await SmartContract.fromCell(code, data, { getMethodsMutate: true, debug: true });

        const contract = new JettonWallet(jettonWallet);
        contract.setUnixTime(toUnixTime(Date.now()));

        const initRes = await jettonWallet.sendInternalMessage(initMessage);
        let successResult = initRes as SuccessfulExecutionResult;
        const initMessageResponse = {
            ...successResult,
            logs: filterLogs(successResult.logs),
        };
        // @ts-ignore
        contract.initMessageResult = initMessageResponse;
        contract.initMessageResultRaw = initRes;
        contract.address = initMessage.to;
        if (tvmBus) {
            tvmBus.registerContract(contract as iTvmBusContract);
        }

        return contract;
    }
}
