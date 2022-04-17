import BN from "bn.js";
import { Address, Cell, CellMessage, CommonMessageInfo, InternalMessage } from "ton";
// @ts-ignore
import { SmartContract, ExecutionResult } from "ton-contract-executor";
import { parseActionsList, SendMsgOutAction, parseJettonTransfer, sliceToAddress267 } from "../utils";
import { OPS } from "./ops";



export function actionToInternalMessage(to: Address, from:Address, messageBody: Cell, messageValue = new BN(1000000000), bounce = false) {
    let msg = new CommonMessageInfo( { body: new CellMessage(messageBody) });
    return new InternalMessage({
        to,
        from,
        value: messageValue,
        bounce,
        body: msg
    })
}


export  function parseAmmResp(result: ExecutionResult) {
    // @ts-ignore
    let res = result as SuccessfulExecutionResult;
    //console.log(res);
    return {
        "exit_code": res.exit_code,
        returnValue: res.result[1] as BN,
        logs: res.logs,
        actions: parseActionsList(res.action_list_cell)
    }
}

export  function swapTokenCell(minAmountOut: BN) {
    let extra_data = new Cell();
    extra_data.bits.writeUint(OPS.SWAP_TOKEN ,32);
    extra_data.bits.writeUint(minAmountOut ,32);  // minAmountOut
    return extra_data;
}

export function addLiquidityCell() {
    let extra_data = new Cell();
    extra_data.bits.writeUint(OPS.ADD_LIQUIDITY ,32);
    extra_data.bits.writeUint(new BN(5) ,32);  // slippage
    return extra_data;
}


