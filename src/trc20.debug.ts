import {readFile} from "fs/promises";
import {SmartContract, SuccessfulExecutionResult} from "ton-contract-executor";

import {
    Address,
    Cell,
    CellMessage,
    InternalMessage,
    Slice,
    CommonMessageInfo,
    ExternalMessage,
    serializeDict
} from "ton";
import BN from "bn.js";
import {parseActionsList, sliceToAddress267, toUnixTime, sliceToString, addressToSlice264} from "./utils";


const contractAddress = Address.parse('EQD4FPq-PRDieyQKkizFTRtSDyucUIqrj0v_zXJmqaDp6_0t')
const addressA = Address.parseFriendly('kQCLjyIQ9bF5t9h3oczEX3hPVK4tpW2Dqby0eHOH1y5_Nk1x').address;
const addressB = Address.parseFriendly('EQCbPJVt83Noxmg8Qw-Ut8HsZ1lz7lhp4k0v9mBX2BJewhpe').address;


const TRC20_TRANSFER = 1;
const SWAP_OUT_SUB_OP = 8;

export class Trc20Debug {
    private constructor(public readonly contract: SmartContract) {}

    async getData() {
        let res = await this.contract.invokeGetMethod('get_token_data', []);
        const name = sliceToString(res.result[0] as Slice);
        const symbol = sliceToString(res.result[1] as Slice );
        const decimals = res.result[2] as BN;
        const totalSupply = res.result[3] as BN;
        const tokenReserves = res.result[4] as BN;
        const tonReserves = res.result[5] as BN;
        const tokenAddress = sliceToAddress267(res.result[6] as Slice);
        const initialized = res.result[7] as BN;

        return  {
            name,
            symbol,
            decimals,
            totalSupply,
            tokenReserves,
            tonReserves,
            tokenAddress,
            initialized
        }
    }


    async init(fakeAddress: Address) {
        let messageBody = new Cell();
        messageBody.bits.writeUint(1, 1);
        let msg = new CommonMessageInfo( { body: new CellMessage(messageBody) });

        let res = await this.contract.sendExternalMessage(new ExternalMessage({
            to: fakeAddress,
            body: msg
        }));
        return res;
    }

    async transfer(to: Address, amount: BN) {

        let messageBody = new Cell();
        messageBody.bits.writeUint(TRC20_TRANSFER, 32) // action
        messageBody.bits.writeUint(1, 64) // query-id
        const to264 = addressToSlice264(to);
        messageBody.bits.writeUint(to264, 264);
        messageBody.bits.writeCoins(amount); // sent amount
    //    messageBody.bits.writeUint(ADD_LIQUIDITY_SUB_OP, 8); // sub-op
    //    messageBody.bits.writeUint(slippage, 64) // slippage
        return messageBody;

        let res = await this.contract.sendInternalMessage(new InternalMessage({
            to: contractAddress,
            value: new BN(10000),
            bounce: false,
            body: new CommonMessageInfo( { body: new CellMessage(b) })
        }))

        let successResult = res as SuccessfulExecutionResult;

        return {
            "exit_code": res.exit_code,
            returnValue: res.result[1] as BN,
            logs: res.logs,
            actions: parseActionsList(successResult.action_list_cell)
        }
    }

    async mint(sender: Address) {
        let messageBody = new Cell();
        messageBody.bits.writeUint(5, 32) // action

        let res = await this.contract.sendInternalMessage(new InternalMessage({
            from: sender,
            to: contractAddress,
            value: new BN(10000),
            bounce: false,
            body: new CommonMessageInfo( { body: new CellMessage(messageBody) })
        }))

        let successResult = res as SuccessfulExecutionResult;
        console.log(res);
        return {
            "exit_code": res.exit_code,
            returnValue: res.result[1] as BN,
            logs: res.logs,
            actions: parseActionsList(successResult.action_list_cell)
        }
    }

    async transferOverloaded(from: Address,to: Address, amount: BN, subOp: BN, slippage: BN, tonCoins: BN) {

        let messageBody = new Cell();
        messageBody.bits.writeUint(TRC20_TRANSFER, 32) // action
        messageBody.bits.writeUint(1, 64) // query-id
        const to264 = addressToSlice264(to);
        messageBody.bits.writeUint(to264, 264);
        messageBody.bits.writeCoins(amount); // sent amount
        messageBody.bits.writeUint(subOp, SWAP_OUT_SUB_OP); // sub-op
        messageBody.bits.writeUint(slippage, 64) // slippage


        let res = await this.contract.sendInternalMessage(new InternalMessage({
            from: from,
            to: contractAddress,
            value: new BN(10000),
            bounce: false,
            body: new CommonMessageInfo( { body: new CellMessage(messageBody) })
        }))

        let successResult = res as SuccessfulExecutionResult;
        console.log(res);
        return {
            "exit_code": res.exit_code,
            returnValue: res.result[1] as BN,
            logs: res.logs,
            actions: parseActionsList(successResult.action_list_cell)
        }
    }

    async balanceOf(owner: Address) {
        let wc = owner.workChain;
        let address = new BN(owner.hash)

        let balanceResult = await this.contract.invokeGetMethod('ibalance_of', [
            { type: 'int', value: wc.toString(10) },
            { type: 'int', value: address.toString(10) },
        ])
        console.log(balanceResult)
        return (balanceResult.result[0] as BN);
    }

    setUnixTime( time: number) {
        this.contract.setUnixTime(time);
    }

    static async create() {
        let msgHexComment = (await readFile('src/msg_hex_comment.func')).toString('utf-8');
        let source = (await readFile('./src/trc20-mint.func')).toString('utf-8')
        const data = await buildDataCell('trc20', 'trc', contractAddress, new BN(10000000000));
        let contract = await SmartContract.fromFuncSource(msgHexComment+source, data, { getMethodsMutate: true })

        const contractDebug = new Trc20Debug(contract);
        contractDebug.setUnixTime(toUnixTime(Date.now()));
        return contractDebug;
    }
}



async function buildDataCell(name: string, symbol: string, owner: Address, totalSupply: BN) {
    const balanceTable = new Map([
        [new BN(owner.hash).toString(10), totalSupply],
    ]);
    const balances = serializeDict(balanceTable, 264, (value, cell) => {
        cell.bits.writeCoins(value)
    })
    console.log('ts dictionary');
    console.log(balances)

    let dataCell = new Cell()
    dataCell.bits.writeUint(name.length, 8)          // name.length
    dataCell.bits.writeString(name)                           // name
    dataCell.bits.writeUint(symbol.length, 8)       // symbol.length
    dataCell.bits.writeString(symbol)                        // symbol
    dataCell.bits.writeUint(9, 8)             // decimals
    dataCell.bits.writeCoins(totalSupply)             // totalSupply
    dataCell.bits.writeUint(0,1)              // balances
    dataCell.bits.writeUint(0,1)             // allowance
    dataCell.bits.writeUint(0,1)             // inited
    return dataCell
}