import BN from "bn.js";
import { Address, Cell, InternalMessage, Slice } from "ton";
import { OutAction, SmartContract } from "ton-contract-executor";
import { TvmBus } from "./tvm-bus";

declare type NormalizedStackEntry = null | Cell | Slice | BN | NormalizedStackEntry[];

export declare type FailedExecutionResult = {
    type: "failed";
    exit_code: number;
    gas_consumed: number;
    result: NormalizedStackEntry[];
    actionList: OutAction[];
    action_list_cell?: Cell;
    logs: string;
};

export declare type SuccessfulExecutionResult = {
    type: "success";
    exit_code: number;
    gas_consumed: number;
    result: NormalizedStackEntry[];
    actionList: OutAction[];
    action_list_cell?: Cell;
    logs: string;
};

export declare type ExecutionResult = FailedExecutionResult | SuccessfulExecutionResult;

export interface DeployMessageResult {
    logs: string[];
    actions: OutAction[];
}
// iMessageBusNative
export interface iTvmBusContract {
    contract?: SmartContract;
    address?: Address;
    initMessageResultRaw?: ExecutionResult;
    sendInternalMessage(message: InternalMessage): Promise<ExecutionResult>;
}
// a contract that implements this interface can automatically be registered to the message bus
export interface iDeployableContract {
    getCodeCell(): Cell[];
    createFromMessage(code: Cell, data: Cell, initMessage: InternalMessage, tvmBus: TvmBus): Promise<iTvmBusContract>;
}

export type ThinInternalMessage = {
    value: BN;
    body: string;
    stateInit: string;
    mode: Number;
};

export type ParsedExecutionResult = {
    from: Address;
    inMessage?: ThinInternalMessage;
    contractImpl: iTvmBusContract;
    contractAddress: Address;
    exit_code: number;
    returnValue: BN;
    logs: string[];
    actions: OutAction[];
    isDeployedByAction: boolean;
};

export interface InternalMessageResponse {
    exit_code: number;
    returnValue: BN;
    logs: string[];
    actions: OutAction[];
}
