// @ts-ignore
import { SmartContract, SuccessfulExecutionResult } from "ton-contract-executor";
import { parseInternalMessageResponse } from "../utils";

import { Address, Cell, CellMessage, InternalMessage, Slice, CommonMessageInfo } from "ton";
import BN from "bn.js";
import { parseActionsList, toUnixTime, toDecimals, OutAction } from "../utils";
import { OPS } from "../amm/ops";

type UsdcTransferNextOp = OPS.ADD_LIQUIDITY | OPS.SWAP_TOKEN;

export class JettonWallet {
    public initMessageResult: { logs?: string; actions?: OutAction[] } = {};

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
            jettonMaster,
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
        if (overloadOp == OPS.ADD_LIQUIDITY) {
            messageBody.bits.writeUint(overloadOp, 32); // slippage
        } else if (overloadOp == OPS.SWAP_TOKEN) {
            messageBody.bits.writeCoins(overloadValue); // min amount out
        }

        let res = await this.contract.sendInternalMessage(
            new InternalMessage({
                from: from,
                to: to,
                value: toDecimals(1),
                bounce: false,
                body: new CommonMessageInfo({ body: new CellMessage(messageBody) }),
            })
        );

        let successResult = res as SuccessfulExecutionResult;

        return {
            exit_code: res.exit_code,
            returnValue: res.result[1] as BN,
            logs: res.logs,
            actions: parseActionsList(successResult.action_list_cell),
        };
    }

    setUnixTime(time: number) {
        this.contract.setUnixTime(time);
    }

    // static async create(totalSupply: BN, tokenAdmin: Address, content: string) {
    //     let msgHexComment = (await readFile('./src-distributed/msg_hex_comment.func')).toString('utf-8');
    //     let jettonMinter = (await readFile('./src-distributed/jetton-minter.func')).toString('utf-8');
    //     let utils = (await readFile('./src-distributed/jetton-utils.func')).toString('utf-8');
    //     let opcodes = (await readFile('./src-distributed/op-codes.func')).toString('utf-8');
    //     let params = (await readFile('./src-distributed/params.func')).toString('utf-8');
    //     // this code is taken from tonWEB
    //     const code = Cell.fromBoc("B5EE9C7241021101000319000114FF00F4A413F4BCF2C80B0102016202030202CC0405001BA0F605DA89A1F401F481F481A8610201D40607020148080900BB0831C02497C138007434C0C05C6C2544D7C0FC02F83E903E900C7E800C5C75C87E800C7E800C00B4C7E08403E29FA954882EA54C4D167C0238208405E3514654882EA58C4CD00CFC02780D60841657C1EF2EA4D67C02B817C12103FCBC2000113E910C1C2EBCB853600201200A0B0201200F1001F500F4CFFE803E90087C007B51343E803E903E90350C144DA8548AB1C17CB8B04A30BFFCB8B0950D109C150804D50500F214013E809633C58073C5B33248B232C044BD003D0032C032483E401C1D3232C0B281F2FFF274013E903D010C7E801DE0063232C1540233C59C3E8085F2DAC4F3208405E351467232C7C6600C02F13B51343E803E903E90350C01F4CFFE80145468017E903E9014D6B1C1551CDB1C150804D50500F214013E809633C58073C5B33248B232C044BD003D0032C0327E401C1D3232C0B281F2FFF274140331C146EC7CB8B0C27E8020822625A020822625A02806A8486544124E17C138C34975C2C070C00930802C200D0E008ECB3F5007FA0222CF165006CF1625FA025003CF16C95005CC07AA0013A08208989680AA008208989680A0A014BCF2E2C504C98040FB001023C85004FA0258CF1601CF16CCC9ED54006C5219A018A182107362D09CC8CB1F5240CB3F5003FA0201CF165007CF16C9718018C8CB0525CF165007FA0216CB6A15CCC971FB00103400828E2A820898968072FB028210D53276DB708010C8CB055008CF165005FA0216CB6A13CB1F13CB3FC972FB0058926C33E25502C85004FA0258CF1601CF16CCC9ED5400DB3B51343E803E903E90350C01F4CFFE803E900C145468549271C17CB8B049F0BFFCB8B0A0822625A02A8005A805AF3CB8B0E0841EF765F7B232C7C572CFD400FE8088B3C58073C5B25C60043232C14933C59C3E80B2DAB33260103EC01004F214013E809633C58073C5B3327B55200083200835C87B51343E803E903E90350C0134C7E08405E3514654882EA0841EF765F784EE84AC7CB8B174CFCC7E800C04E81408F214013E809633C58073C5B3327B55204F664B79");

    //     const data = await createStateInit(totalSupply, tokenAdmin, content, code[0]);

    //     const combinedCode = jettonMinter + utils + opcodes + params + msgHexComment;
    //     let contract = await SmartContract.fromFuncSource(combinedCode, data, { getMethodsMutate: true })
    //     const instance = new JettonWallet(contract);
    //     instance.setUnixTime(toUnixTime(Date.now()));
    //     return instance;
    // }

    static async createFromMessage(code: Cell, data: Cell, initMessage: InternalMessage) {
        const jettonWallet = await SmartContract.fromCell(code, data, { getMethodsMutate: true });
        const contract = new JettonWallet(jettonWallet);
        contract.setUnixTime(toUnixTime(Date.now()));

        const initRes = await jettonWallet.sendInternalMessage(initMessage);
        let successResult = initRes as SuccessfulExecutionResult;
        const initMessageResponse = {
            logs: successResult.logs,
            actions: parseActionsList(successResult.action_list_cell),
        };

        contract.initMessageResult = initMessageResponse;
        return contract;
    }
}

//   ds~load_coins(), ;; total_supply
//   ds~load_msg_addr(), ;; admin_address
//   ds~load_ref(), ;; content
//   ds~load_ref()  ;; jetton_wallet_code
async function createStateInit(totalSupply: BN, admin: Address, content: string, tokenCode: Cell) {
    const contentCell = new Cell();
    contentCell.bits.writeString(content);

    let dataCell = new Cell();
    dataCell.bits.writeCoins(totalSupply);
    dataCell.bits.writeAddress(admin);
    dataCell.refs.push(contentCell);
    dataCell.refs.push(tokenCode);
    return dataCell;
}
