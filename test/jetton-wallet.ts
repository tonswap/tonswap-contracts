// @ts-ignore
import { SmartContract, SuccessfulExecutionResult } from "ton-contract-executor";
import { Address, Cell, CellMessage, InternalMessage, Slice, CommonMessageInfo, TonClient, toNano } from "ton";
import BN from "bn.js";
import { parseActionsList, toUnixTime, OutAction, parseInternalMessageResponse, filterLogs, sliceToAddress } from "./utils";
import { OPS } from "./ops";
import { bytesToAddress } from "../utils/deploy-utils";
import { writeString } from "./messageUtils";

type UsdcTransferNextOp = OPS.ADD_LIQUIDITY | OPS.SWAP_TOKEN;

export class JettonWallet {
    public initMessageResult: { logs?: string; actions?: OutAction[] } = {};
    public address?: Address;

    private constructor(public readonly contract: SmartContract) {}

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

    async sendInternalMessage(message: InternalMessage) {
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

    async transferOverloaded(
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
        const addLiquidityGas = "0.15";
        let res = await this.contract.sendInternalMessage(
            new InternalMessage({
                from: from,
                to: to,
                value: forwardTonAmount.add(toNano(addLiquidityGas)),
                bounce: false,
                body: new CommonMessageInfo({ body: new CellMessage(messageBody) }),
            })
        );

        let successResult = res as SuccessfulExecutionResult;

        return {
            exit_code: res.exit_code,
            returnValue: res.result[1] as BN,
            logs: filterLogs(res.logs),
            actions: parseActionsList(successResult.action_list_cell),
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

    static async createFromMessage(code: Cell, data: Cell, initMessage: InternalMessage) {
        const jettonWallet = await SmartContract.fromCell(code, data, { getMethodsMutate: true, debug: true });

        const contract = new JettonWallet(jettonWallet);
        contract.setUnixTime(toUnixTime(Date.now()));

        const initRes = await jettonWallet.sendInternalMessage(initMessage);
        let successResult = initRes as SuccessfulExecutionResult;
        const initMessageResponse = {
            logs: filterLogs(successResult.logs),
            actions: parseActionsList(successResult.action_list_cell),
        };
        // @ts-ignore
        contract.initMessageResult = initMessageResponse;
        contract.address = initMessage.to;
        return contract;
    }
}

//   ds~load_coins(), ;; total_supply
//   ds~load_msg_addr(), ;; admin_address
//   ds~load_ref(), ;; content
//   ds~load_ref()  ;; jetton_wallet_code
async function createStateInit(totalSupply: BN, admin: Address, content: string, tokenCode: Cell) {
    const contentCell = new Cell();
    writeString(contentCell, content);

    let dataCell = new Cell();
    dataCell.bits.writeCoins(totalSupply);
    dataCell.bits.writeAddress(admin);
    dataCell.refs.push(contentCell);
    dataCell.refs.push(tokenCode);
    return dataCell;
}
