import BN from "bn.js";
import { Address, Cell, CellMessage, CommonMessageInfo, fromNano, InternalMessage } from "ton";
import { OutAction } from "ton-contract-executor";
import { ExecutionResult } from "../tvm-bus/types";
import { OPS } from "./ops";

export function actionToMessage(
    from: Address,
    action: OutAction | undefined,
    inMessage: InternalMessage,
    response: ExecutionResult,
    bounce = true
) {
    //@ts-ignore
    const sendMessageAction = action as SendMsgOutAction;

    let messageValue = sendMessageAction.message?.info?.value.coins;
    if (sendMessageAction.mode == 64) {
        messageValue = inMessage.value;
        //console.log(`message.coins`, sendMessageAction.mode, fromNano(messageValue));
    }

    //  if (sendMessageAction.message?.info?.value.coins.toString() == "0") {
    // console.log(sendMessageAction, sendMessageAction.message, fromNano(sendMessageAction.message?.info?.value.coins));
    //  }
    let msg = new CommonMessageInfo({
        body: new CellMessage(sendMessageAction.message?.body),
    });

    return new InternalMessage({
        to: sendMessageAction.message?.info.dest,
        from,
        value: messageValue,
        bounce,
        body: msg,
    });
}

export function swapTokenCell(minAmountOut: BN) {
    let extra_data = new Cell();
    extra_data.bits.writeUint(OPS.SWAP_TOKEN, 32);
    extra_data.bits.writeUint(minAmountOut, 32); // minAmountOut
    return extra_data;
}

export function addLiquidityCell() {
    let extra_data = new Cell();
    extra_data.bits.writeUint(OPS.ADD_LIQUIDITY, 32);
    extra_data.bits.writeUint(new BN(5), 32); // slippage
    return extra_data;
}
