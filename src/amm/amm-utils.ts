import BN from "bn.js";
import { Address, Cell, CellMessage, CommonMessageInfo, InternalMessage } from "ton";
import { OutAction } from "../utils";
import { OPS } from "./ops";

export function actionToInternalMessage(to: Address, from: Address, messageBody: Cell, messageValue = new BN(1000000000), bounce = false) {
    let msg = new CommonMessageInfo({ body: new CellMessage(messageBody) });
    return new InternalMessage({
        to,
        from,
        value: messageValue,
        bounce,
        body: msg,
    });
}

export function actionToMessage(
    to: Address,
    from: Address,
    action: OutAction | undefined,
    messageValue = new BN(1000000000),
    bounce = false,
    messageIsRef = false
) {
    //@ts-ignore
    const sendMessageAction = action as SendMsgOutAction;

    const messageBody = messageIsRef ? sendMessageAction.message?.body.refs[0] : sendMessageAction.message?.body;

    let msg = new CommonMessageInfo({ body: new CellMessage(messageBody) });
    return new InternalMessage({
        to,
        from,
        value: messageValue,
        bounce,
        body: msg,
    });
}

export function actionToMessage2(from: Address, action: OutAction | undefined, messageValue = new BN(1000000000), bounce = false) {
    //@ts-ignore
    const sendMessageAction = action as SendMsgOutAction;

    let msg = new CommonMessageInfo({ body: new CellMessage(sendMessageAction.message?.body) });
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
