import {readFile} from "fs/promises";
import {SmartContract} from "ton-contract-executor";
import {buildDataCell, stringToCell, DexConfig} from "./dex.data";
import {Address, Cell, CellMessage, InternalMessage, Slice, CommonMessageInfo, StateInit} from "ton";
import BN from "bn.js";

function sliceToString(s: Slice) {
    let data = s.readRemaining()
    return data.buffer.slice(0, Math.ceil(data.cursor / 8)).toString()
}

const contractAddress = Address.parse('EQD4FPq-PRDieyQKkizFTRtSDyucUIqrj0v_zXJmqaDp6_0t')


export class DexDebug {
    private constructor(public readonly contract: SmartContract) {

    }


    async getData() {
        let res = await this.contract.invokeGetMethod('get_token_data', []);
        let name = sliceToString(res.result[0] as Slice);
        let symbol = sliceToString(res.result[1] as Slice );
        let decimals = res.result[2] as BN;
        let totalSupply = res.result[3] as BN;
        let totalLpSupply =  res.result[4] as BN;
        let tokenReserves = res.result[5] as BN;
        let tonReserves = res.result[6] as BN;

        return  {
            name,
            symbol,
            decimals,
            totalSupply,
            totalLpSupply,
            tokenReserves,
            tonReserves
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

    async addLiquidity(sender: Address, tonValue: BN, tokenValue: BN, slippage: number) {

        let messageBody = new Cell();
        messageBody.bits.writeUint(5, 32) // op
        messageBody.bits.writeUint(1, 64) // query_id
        messageBody.bits.writeCoins(tokenValue);
        messageBody.bits.writeUint(slippage, 64) // slippage
        
        let b = new CommonMessageInfo( { body: new CellMessage(messageBody) });

        let res = await this.contract.sendInternalMessage(new InternalMessage({
            to: contractAddress,
            from: sender,
            value: tonValue,
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
        return {
            "exit_code": res.exit_code,
            returnValue: res.result[0] as BN
        }
    }

    async balanceOf(owner: Address) {
        let wc = owner.workChain;
        let address = new BN(owner.hash)
        

        let balanceResult = await this.contract.invokeGetMethod('ibalance_of', [
            { type: 'int', value: wc.toString(10) },
            { type: 'int', value: address.toString(10) },
        ])
        
        return (balanceResult.result[0] as BN);
    }

    async liquidityOf(owner: Address) {
        let wc = owner.workChain;
        let address = new BN(owner.hash)

        let liquidityResult = await this.contract.invokeGetMethod('liquidity_of', [
            { type: 'int', value: wc.toString(10) },
            { type: 'int', value: address.toString(10) },
        ])
        
        return (liquidityResult.result[0] as BN)
    }

    static async create(config: DexConfig) {
        let source = (await readFile('./src/dex.fc')).toString('utf-8')
        let contract = await SmartContract.fromFuncSource(source, buildDataCell(config), { getMethodsMutate: true })

        return new DexDebug(contract)
    }
}