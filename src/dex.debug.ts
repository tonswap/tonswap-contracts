import {readFile} from "fs/promises";
import {SmartContract, SuccessfulExecutionResult} from "ton-contract-executor";
import {buildDataCell, DexConfig} from "./dex.data";
import {Address, Cell, CellMessage, InternalMessage, Slice, CommonMessageInfo} from "ton";
import BN from "bn.js";
import { parseActionsList } from "./utils";

function sliceToString(s: Slice) {
    let data = s.readRemaining()
    return data.buffer.slice(0, Math.ceil(data.cursor / 8)).toString()
}

const contractAddress = Address.parse('EQD4FPq-PRDieyQKkizFTRtSDyucUIqrj0v_zXJmqaDp6_0t')
const TRC20_TRANSFER_RECIPT = 2147483649;
const CLAIM_REWARDS = 4;
const UPDATE_TOKEN_DATA = '9';
const UPDATE_PROTOCOL_DATA = '10';

type UPDATE_ACTIONS = UPDATE_TOKEN_DATA | UPDATE_PROTOCOL_DATA;

export class DexDebug {
    private constructor(public readonly contract: SmartContract) {

    }


    async getData() {
        let res = await this.contract.invokeGetMethod('get_token_data', []);
        const name = sliceToString(res.result[0] as Slice);
        const symbol = sliceToString(res.result[1] as Slice );
        const decimals = res.result[2] as BN;
        const totalSupply = res.result[3] as BN;
        const tokenReserves = res.result[4] as BN;
        const tonReserves = res.result[5] as BN;

        return  {
            name,
            symbol,
            decimals,
            totalSupply,
            tokenReserves,
            tonReserves
        }
    }
    
    async getAdminData() {
        
        const res = await this.contract.invokeGetMethod('get_admin_data', []);

        let [adminWc, adminAddress, adminPoints , protocolWc ,protocolAddress, protocolPoints] = res.result as [BN, BN, BN ,BN, BN, BN]
        const admin = new Address(adminWc.toNumber(), adminAddress.toBuffer());
        const protocol = new Address(protocolWc.toNumber(), protocolAddress.toBuffer());
        
        return {
            admin,
            adminPoints,
            protocol,
            protocolPoints
        }
    }
   
    async initTestData(sender: Address) {
        let messageBody = new Cell();
        messageBody.bits.writeUint(101, 32) // op
        messageBody.bits.writeUint(1, 64) // query_id
        let msg = new CommonMessageInfo( { body: new CellMessage(messageBody) });
        

        let res = await this.contract.sendInternalMessage(new InternalMessage({
            to: contractAddress,
            from: sender,
            value: new BN(1),
            bounce: false,
            body: msg
        }))
        return res;
    }

    async addLiquidity(tokenContract: Address, tokenSender: Address, tonAmount: BN, tokenAmount: BN, slippage: number) {

        let messageBody = new Cell();
        messageBody.bits.writeUint(TRC20_TRANSFER_RECIPT, 32) // action
        messageBody.bits.writeUint(1, 64) // query-id
        messageBody.bits.writeAddress(tokenSender) // token contract is sender (recv_internal)
        messageBody.bits.writeCoins(tokenAmount); // sent amount
        messageBody.bits.writeUint(2, 8); // sub-op  
        messageBody.bits.writeUint(slippage, 64) // slippage
        
        let b = new CommonMessageInfo( { body: new CellMessage(messageBody) });

        let res = await this.contract.sendInternalMessage(new InternalMessage({
            to: contractAddress,
            from: tokenContract,
            value: tonAmount,
            bounce: false,
            body: b
        }))

        return {
            "exit_code": res.exit_code,
            returnValue: res.result[1] as BN
        }
    }

    async removeLiquidity(sender: Address, lpAmount: BN) {
        let messageBody = new Cell();
        messageBody.bits.writeUint(6, 32) // op
        messageBody.bits.writeUint(1, 64) // query_id
        messageBody.bits.writeCoins(lpAmount);
        
        let b = new CommonMessageInfo( { body: new CellMessage(messageBody) });

        let res = await this.contract.sendInternalMessage(new InternalMessage({
            to: contractAddress,
            from: sender,
            value: new BN(1),
            bounce: false,
            body: b
        }))

        let successResult = res as SuccessfulExecutionResult;

        return {
            "exit_code": res.exit_code,
            returnValue: res.result[0] as BN,
            logs: res.logs,
            actions: parseActionsList(successResult.action_list_cell)
        }
    }


    // Swap TON->TRC20
    async swapIn(sender: Address, tonToSwap: BN, minAmountOut: BN) {

        let messageBody = new Cell();
        messageBody.bits.writeUint(7, 32) // action
        messageBody.bits.writeUint(1, 64) // query-id
        messageBody.bits.writeCoins(minAmountOut); // min amount out 
        let b = new CommonMessageInfo( { body: new CellMessage(messageBody) });
        let res = await this.contract.sendInternalMessage(new InternalMessage({
            to: contractAddress,
            from: sender,
            value: tonToSwap,
            bounce: false,
            body: b
        }))

        let successResult = res as SuccessfulExecutionResult;

        return {
            "exit_code": res.exit_code,
            returnValue: res.result[0] as BN,
            logs: res.logs,
            actions: parseActionsList(successResult.action_list_cell)
        }
    }

    // Swap TON->TRC20
    async swapOut(sender: Address,tokenSender: Address, tokenAmount: BN, minAmountOut: BN) {

        let messageBody = new Cell();
        messageBody.bits.writeUint(TRC20_TRANSFER_RECIPT, 32) // action
        messageBody.bits.writeUint(1, 64) // query-id
        messageBody.bits.writeAddress(sender) // token contract is sender (recv_internal)
        messageBody.bits.writeCoins(tokenAmount); // sent amount
        messageBody.bits.writeUint(8, 8); // sub-op 
        messageBody.bits.writeCoins(minAmountOut); // min amount out, Slippage
    
        let b = new CommonMessageInfo( { body: new CellMessage(messageBody) });
        let res = await this.contract.sendInternalMessage(new InternalMessage({
            to: contractAddress,
            from: tokenSender, 
            value: new BN(1),
            bounce: false,
            body: b
        }))

        let successResult = res as SuccessfulExecutionResult;

        return {
            "exit_code": res.exit_code,
            returnValue: res.result[0] as BN,
            logs: res.logs,
            actions: parseActionsList(successResult.action_list_cell)
        }
    }

    async claimRewards(sender: Address) {
        let messageBody = new Cell();
        messageBody.bits.writeUint(CLAIM_REWARDS, 32) // action
        messageBody.bits.writeUint(1, 64) // query-id
    
        let b = new CommonMessageInfo( { body: new CellMessage(messageBody) });
        let resBalance = await this.contract.sendInternalMessage(new InternalMessage({
            to: contractAddress,
            from: sender, 
            value: new BN(1),
            bounce: false,
            body: b
        }))
        
        let successResult = resBalance as SuccessfulExecutionResult;
        const rewards = resBalance.result[1] as BN;
        

        return {
            "exit_code": resBalance.exit_code,
            returnValue: resBalance.result[1] as BN,
            logs: resBalance.logs,
            actions: parseActionsList(successResult.action_list_cell),
            rewards : rewards
        }
    }

    async updateAdminData(sender: Address, op: UPDATE_ACTIONS, allocPoints: BN) {
        let messageBody = new Cell();
        messageBody.bits.writeUint( new BN(op), 32) // action
        messageBody.bits.writeUint(1, 64) // query-id
        messageBody.bits.writeCoins(allocPoints);
    
        let b = new CommonMessageInfo( { body: new CellMessage(messageBody) });
        let res = await this.contract.sendInternalMessage(new InternalMessage({
            to: contractAddress,
            from: sender, 
            value: new BN(1),
            bounce: false,
            body: b
        }))

        return {
            "exit_code": res.exit_code,
            returnValue: res.result[0] as BN,
            logs: res.logs,
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

    async getRewards(user: Address) {
        let wc = user.workChain;
        let address = new BN(user.hash);

        let liquidityResult = await this.contract.invokeGetMethod('get_rewards_of', [
            { type: 'int', value: wc.toString(10) },
            { type: 'int', value: address.toString(10) },
        ])

        return (liquidityResult.result[0] as BN);
    }

    setUnixTime( time: number) {
        this.contract.setUnixTime(time);
    }

    static async create(config: DexConfig) {
        let source = (await readFile('./src/dex.fc')).toString('utf-8')
        let contract = await SmartContract.fromFuncSource(source, buildDataCell(config), { getMethodsMutate: true })

        return new DexDebug(contract)
    }
}