import BN from "bn.js";
import { Address, Cell, contractAddress, InternalMessage } from "ton";
import { SendMsgAction } from "ton-contract-executor";
import { actionToMessage } from "../src/amm-utils";
import { ParsedExecutionResult, ExecutionResult, iTvmBusContract, iDeployableContract, SuccessfulExecutionResult } from "./types";
import { parseResponse } from "./bus-utils";

export class TvmBus {
    counters = {
        messagesSent: 0,
        contractDeployed: 0,
    };
    pool = new Map<string, iTvmBusContract>();
    codeToContractPool = new Map<string, iDeployableContract>();
    results = Array<ParsedExecutionResult>();

    getContractByAddress(address: Address) {
        console.log(`getContractByAddress [${address.toFriendly()}] = ${this.pool.has(address.toFriendly())}`);

        return this.pool.get(address.toFriendly()) as iTvmBusContract;
    }

    registerCode(contract: iDeployableContract) {
        const codeCell = contract.getCodeCell()[0];
        this.codeToContractPool.set(codeCell.hash().toString("hex"), contract);
    }

    findContractByCode(codeCell: Cell) {
        return this.codeToContractPool.get(codeCell.hash().toString("hex"));
    }

    registerContract(contract: iTvmBusContract) {
        const address = contract.address as Address;
        this.pool.set(address.toFriendly(), contract);
    }

    async broadcast(msg: InternalMessage) {
        // empty results queue
        this.results = Array<ParsedExecutionResult>();

        let { taskQueue } = await this._broadcast(msg, Array<Function>());
        return await this.iterateTasks(taskQueue);
    }

    async iterateTasks(queue: Array<Function>) {
        if (queue.length == 0) {
            console.log(this.results);
        }

        const task = queue.pop() as Function;
        if (!task) {
            throw "xxx";
        }

        let { taskQueue } = await task();
        if (taskQueue.length == 0) {
            return this.results;
        }
        await this.iterateTasks(taskQueue);
        return this.results;
    }

    private async _broadcast(msg: InternalMessage, taskQueue: Array<Function>) {
        console.log(msg, msg.body.body);

        console.log(`broadcastCounter: ${this.counters.messagesSent} msg.body `, msg.body, `dest ${msg.to.toFriendly()}`);

        let receiver = this.getContractByAddress(msg.to);

        // in case receiver is not registered and the code is registered we can initialize the contract by the message
        if (!receiver) {
            console.log(`receiver not found: ${msg.to.toFriendly()} msg.body:${msg.body}`);
            //throw "no registered receiver";
            return { taskQueue };
        }
        // process one message on each recursion
        const response = await receiver.sendInternalMessage(msg);
        this.results.push(parseResponse(msg, response, receiver));

        this.counters.messagesSent++;

        // queue all other message actions
        for (let it of response.actionList) {
            if (it.type != "send_msg") {
                console.log(it.type);
                continue;
            }

            let itMsg = actionToMessage(msg.to, it);
            taskQueue.push(async () => {
                it = it as SendMsgAction;
                console.log(`task -> to:${itMsg.to.toFriendly()} body: ${itMsg.body.body}`);

                // In case message has StateInit, and contract address is not registered
                if (it.message.init && !this.getContractByAddress(itMsg.to)) {
                    const deployedContract = (await this.deployContractFromMessage(
                        it.message?.init?.code as Cell,
                        it.message?.init?.data as Cell,
                        itMsg
                    )) as iTvmBusContract;

                    this.counters.contractDeployed++;
                    const parsedResult = parseResponse(
                        itMsg,
                        deployedContract.initMessageResultRaw as ExecutionResult,
                        deployedContract,
                        true
                    );
                    for (let action of parsedResult.actions) {
                        if (action.type != "send_msg") {
                            console.log(action.type);
                            continue;
                        }
                        taskQueue.push(async () => {
                            return await this._broadcast(actionToMessage(deployedContract.address as Address, action), taskQueue);
                        });
                    }
                    return {
                        results: this.results.push(parsedResult),
                        taskQueue,
                    };
                } else {
                    return this._broadcast(itMsg, taskQueue);
                }
            });
        }
        return {
            results: this.results,
            taskQueue,
        };
    }

    async deployContractFromMessage(codeCell: Cell, storage: Cell, message: InternalMessage) {
        const address = await contractAddress({ workchain: 0, initialCode: codeCell, initialData: storage });
        if (this.pool.has(address.toFriendly())) {
            return;
        }
        let impl = this.findContractByCode(codeCell);
        if (!impl) {
            console.table(this.codeToContractPool);
            console.log(codeCell.hash());

            throw "Please register contracts";
        }

        let contract = await impl.createFromMessage(codeCell, storage, message, this);
        this.registerContract(contract);
        console.log(`deployContractFromMessage::register ${address.toFriendly()}`);
        return contract;
    }
}
