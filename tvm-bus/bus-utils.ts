import BN from "bn.js";
import { Address, Cell, InternalMessage, Message } from "ton";
import { filterLogs } from "../src/utils";
import { ExecutionResult, iTvmBusContract, ParsedExecutionResult, SuccessfulExecutionResult, ThinInternalMessage } from "./types";

export function parseResponse(
    inMessage: InternalMessage,
    response: ExecutionResult,
    receivingContract: iTvmBusContract,
    isDeployedByAction = false
): ParsedExecutionResult {
    let successResult = response as SuccessfulExecutionResult;

    return {
        time: new Date().toISOString(),
        from: inMessage.from as Address,
        inMessage: stripMessage(inMessage),
        contractImpl: receivingContract,
        contractAddress: receivingContract.address as Address,
        exit_code: response.exit_code,
        returnValue: response.result[1] as BN,
        logs: filterLogs(response.logs),
        actions: successResult.actionList,
        isDeployedByAction,
    };
}

function stripMessage(message: InternalMessage): ThinInternalMessage {
    const bodyStr = messageToString(message.body?.body);
    const stateInitStr = messageToString(message.body?.stateInit);

    return {
        value: message.value,
        body: bodyStr,
        stateInit: stateInitStr,
        mode: -1,
    };
}

function messageToString(message: Message | null) {
    if (!message) {
        return "";
    }
    let cell = new Cell();
    message.writeTo(cell);
    return cell.toString().replace("\n", "");
}
