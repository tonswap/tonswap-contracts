import {readFile} from "fs/promises";
import {SmartContract, SuccessfulExecutionResult} from "ton-contract-executor";
import {buildDataCell, DexConfig} from "./dex.data";
import {Address, Cell, CellMessage, InternalMessage, Slice, CommonMessageInfo, ExternalMessage} from "ton";
import BN from "bn.js";
import { parseActionsList, sliceToAddress267, toUnixTime, sliceToString } from "./utils";
import {DexActions} from "./dex.actions";

const contractAddress = Address.parse('EQD4FPq-PRDieyQKkizFTRtSDyucUIqrj0v_zXJmqaDp6_0t')

export class DexDebug {
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
        const b = await DexActions.addLiquidity(tokenContract,tokenSender,tonAmount,tokenAmount,slippage);

        let res = await this.contract.sendInternalMessage(new InternalMessage({
            to: contractAddress,
            from: tokenContract,
            value: tonAmount,
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

    async addLiquidityRaw(from: Address, to :Address, tonAmount: BN, trc20Receipt: Cell) {
        console.log('tonAmount',tonAmount)
        let res = await this.contract.sendInternalMessage(new InternalMessage({
            to: to,
            from: from,
            value: tonAmount,
            bounce: false,
            body: new CommonMessageInfo( { body: new CellMessage(trc20Receipt) })
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

    async removeLiquidity(sender: Address, lpAmount: BN) {
        const b = await DexActions.removeLiquidity(lpAmount);
        let res = await this.contract.sendInternalMessage(new InternalMessage({
            to: contractAddress,
            from: sender,
            value: new BN(1),
            bounce: false,
            body: new CommonMessageInfo( { body: new CellMessage(b) })
        }));
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
        const b = await DexActions.swapIn(minAmountOut);

        let res = await this.contract.sendInternalMessage(new InternalMessage({
            to: contractAddress,
            from: sender,
            value: tonToSwap,
            bounce: false,
            body: new CommonMessageInfo( { body: new CellMessage(b) })
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
    async swapOut(sender: Address, tokenContract: Address, tokenAmount: BN, minAmountOut: BN) {
        const b = await DexActions.swapOut(sender ,tokenAmount ,minAmountOut);

        let res = await this.contract.sendInternalMessage(new InternalMessage({
            to: contractAddress,
            from: tokenContract,
            value: new BN(1),
            bounce: false,
            body: new CommonMessageInfo( { body: new CellMessage(b) })
        }))

        let successResult = res as SuccessfulExecutionResult;
        console.log(res);
        return {
            "exit_code": res.exit_code,
            returnValue: res.result[0] as BN,
            logs: res.logs,
            actions: parseActionsList(successResult.action_list_cell)
        }
    }

    async claimRewards(sender: Address) {
        const b = await DexActions.claimRewards();

        let resBalance = await this.contract.sendInternalMessage(new InternalMessage({
            to: contractAddress,
            from: sender, 
            value: new BN(1),
            bounce: false,
            body: new CommonMessageInfo( { body: new CellMessage(b) })
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
        const b = await DexActions.updateAdminData(op, allocPoints);
        let res = await this.contract.sendInternalMessage(new InternalMessage({
            to: contractAddress,
            from: sender, 
            value: new BN(1),
            bounce: false,
            body: new CommonMessageInfo( { body: new CellMessage(b) })
        }))

        return {
            "exit_code": res.exit_code,
            returnValue: res.result[0] as BN,
            logs: res.logs,
        }
    }
    async minAmountOut(amountIn: BN, isTokenSource: boolean) {

        let minAmountOut = await this.contract.invokeGetMethod('get_amount_out_lp', [
            { type: 'int', value: amountIn.toString(10) },
            { type: 'int', value: isTokenSource ? '1': '0' },
        ])
        return (minAmountOut.result[0] as BN);
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
        let source = (await readFile('./src/dex.func')).toString('utf-8')
        let contract = await SmartContract.fromFuncSource(source, buildDataCell(config), { getMethodsMutate: true })
        const contractDebug = new DexDebug(contract);
        contractDebug.setUnixTime(toUnixTime(Date.now()));
        return contractDebug;
    }
}