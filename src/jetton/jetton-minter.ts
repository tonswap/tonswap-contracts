import {readFile} from "fs/promises";
//@ts-ignore
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
import {parseActionsList, sliceToAddress267, toUnixTime, sliceToString, addressToSlice264, sliceToAddress} from "../utils";
import { compileFuncToB64 } from "../funcToB64";


const contractAddress = Address.parse('EQD4FPq-PRDieyQKkizFTRtSDyucUIqrj0v_zXJmqaDp6_0t')
const addressA = Address.parseFriendly('kQCLjyIQ9bF5t9h3oczEX3hPVK4tpW2Dqby0eHOH1y5_Nk1x').address;
const addressB = Address.parseFriendly('EQCbPJVt83Noxmg8Qw-Ut8HsZ1lz7lhp4k0v9mBX2BJewhpe').address;



const TRC20_TRANSFER = 0xf8a7ea5;
const SWAP_OUT_SUB_OP = 8;

const OP_MINT = 21;
const BURN_NOTIFICATION = 0x7bdd97de;
const INTERNAL_TRANSFER = 0x178d4519;

export class JettonMinter {
    private constructor(public readonly contract: SmartContract) {}

    async getData() {
        let res = await this.contract.invokeGetMethod('get_wallet_data', []);
        //@ts-ignore
        const totalSupply = sliceToString(res.result[0] as BN);
        const wc = res.result[1] as BN;
        const jettonMaster = res.result[2] as Slice;
        const content = res.result[2] as Cell;
        const code = res.result[3] as Cell;

        return  {
            totalSupply,
            wc,
            content,
            jettonMaster,
            code
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

    // const body = new Cell();
    // body.bits.writeUint(21, 32); // OP mint
    // body.bits.writeUint(params.queryId || 0, 64); // query_id
    // body.bits.writeAddress(params.destination);
    // body.bits.writeCoins(params.amount); // in Toncoins

    // const transferBody = new Cell(); // internal transfer
    // transferBody.bits.writeUint(0x178d4519, 32); // internal_transfer op
    // transferBody.bits.writeUint(params.queryId || 0, 64);
    // transferBody.bits.writeCoins(params.jettonAmount);
    // transferBody.bits.writeAddress(null); // from_address
    // transferBody.bits.writeAddress(null); // response_address
    // transferBody.bits.writeCoins(new BN(0)); // forward_amount
    // transferBody.bits.writeBit(false); // forward_payload in this slice, not separate cell


    
    async mint(sender: Address, receiver: Address, jettonAmount: BN) {
        let messageBody = new Cell();
        messageBody.bits.writeUint(OP_MINT, 32) // action;
        messageBody.bits.writeUint(1, 64) // query;
        messageBody.bits.writeAddress(receiver);
        messageBody.bits.writeCoins(jettonAmount);

        const masterMessage = new Cell();
        masterMessage.bits.writeUint(0x178d4519, 32) // action;
        masterMessage.bits.writeUint(0, 64) // query;
        masterMessage.bits.writeCoins(jettonAmount)
        masterMessage.bits.writeAddress(null) // from_address
        masterMessage.bits.writeAddress(null) // response_address
        masterMessage.bits.writeCoins(new BN(0)); // forward_amount
        masterMessage.bits.writeBit(false); // forward_payload in this slice, not separate cell
        
        messageBody.refs.push(masterMessage)

        let res = await this.contract.sendInternalMessage(new InternalMessage({
            from: sender,
            to: contractAddress,
            value: new BN(10000),
            bounce: false,
            body: new CommonMessageInfo( { body: new CellMessage(messageBody) })
        }))

        let successResult = res as SuccessfulExecutionResult;

        return {
            "exit_code": res.exit_code,
            returnValue: res.result[1] as BN,
            logs: res.logs,
            actions: parseActionsList(successResult.action_list_cell)
        }
    }


    // burn#595f07bc query_id:uint64 amount:(VarUInteger 16) 
    //           response_destination:MsgAddress custom_payload:(Maybe ^Cell)
    //           = InternalMsgBody;
    async receiveBurn(subwalletOwner: Address, sourceWallet: Address, amount: BN) {

        let messageBody = new Cell();
        messageBody.bits.writeUint(BURN_NOTIFICATION, 32) // action
        messageBody.bits.writeUint(1, 64) // query-id
        messageBody.bits.writeCoins(amount) // jetton amount received 
        messageBody.bits.writeAddress(sourceWallet);
        
        
        const removeLiquidityAmount = 300000;
        let customPayload = new Cell();
        customPayload.bits.writeUint(2, 32); // sub op for removing liquidty 
        customPayload.bits.writeCoins(removeLiquidityAmount); // sub op for removing liquidty 

        messageBody.refs.push(customPayload);

        let res = await this.contract.sendInternalMessage(new InternalMessage({
            from: subwalletOwner,
            to: contractAddress,
            value: new BN(10000),
            bounce: false,
            body: new CommonMessageInfo( { body: new CellMessage(messageBody) })
        }))

        let successResult = res as SuccessfulExecutionResult;
        //console.log(res);
        return {
            "exit_code": res.exit_code,
            returnValue: res.result[1] as BN,
            logs: res.logs,
            actions: parseActionsList(successResult.action_list_cell)
        }
    }

    async balanceOf(owner: Address) {
        // let wc = owner.workChain;
        // let address = new BN(owner.hash)

        // let balanceResult = await this.contract.invokeGetMethod('ibalance_of', [
        //     { type: 'int', value: wc.toString(10) },
        //     { type: 'int', value: address.toString(10) },
        // ])
        // //console.log(balanceResult)
        // return (balanceResult.result[0] as BN);
    }

    async getJettonData() {
         let data = await this.contract.invokeGetMethod('get_jetton_data', []);
         const rawAddress = data.result[2] as Slice;

        // const admin = new Address(0, new BN(rawAddress).toBuffer() );
         return {
            totalSupply : data.result[0] as BN,
            mintable : data.result[1] as BN,
            adminAddress: sliceToAddress(rawAddress, true),
            content: data.result[3],
            jettonWalletCode : data.result[4]
         }
    }

    setUnixTime( time: number) {
        this.contract.setUnixTime(time);
    }

    static async create(totalSupply: BN, tokenAdmin: Address, content: string) {

        const jettonWalletCode = await serializeWalletCodeToCell()
        const stateInit = await buildStateInit(totalSupply, tokenAdmin, content, jettonWalletCode[0]);
        const minterSources = await concatMinterSources();
        let contract = await SmartContract.fromFuncSource(minterSources, stateInit, { getMethodsMutate: true })
        const instance = new JettonMinter(contract);

        instance.setUnixTime(toUnixTime(Date.now()));
        return instance;
    }
}

// custom solution, using func to compile, and fift to serialize the code into a string
async function serializeWalletCodeToCell() {
    const jettonWalletCodeB64 : string = compileFuncToB64([
        'src/jetton/stdlib.fc', 
        'src/jetton/params.fc',
        'src/jetton/op-codes.fc',
        'src/jetton/jetton-utils.fc',
        'src/jetton/jetton-wallet.fc'
    ]);
    return Cell.fromBoc(jettonWalletCodeB64);
}

async function concatMinterSources() {
    let jettonMinter = (await readFile('./src/jetton/jetton-minter.fc')).toString('utf-8');
    let utils = (await readFile('./src/jetton/jetton-utils.fc')).toString('utf-8');
    let opcodes = (await readFile('./src/jetton/op-codes.fc')).toString('utf-8');
    let params = (await readFile('./src/jetton/params.fc')).toString('utf-8');
    let stdlib = (await readFile('./src/jetton/stdlib-tvm.fc')).toString('utf-8');
    return [ stdlib, opcodes, params, utils, jettonMinter].join('\n');
}


//   ds~load_coins(), ;; total_supply
//   ds~load_msg_addr(), ;; token_wallet_address
//   ds~load_coins(), ;; ton_reserves
//   ds~load_coins(), ;; token_reserves
//   ds~load_ref(), ;; content
//   ds~load_ref()  ;; jetton_wallet_code

async function buildStateInit(totalSupply: BN, token_wallet_address: Address, content: string, tokenCode: Cell) {
    const contentCell = new Cell();
    contentCell.bits.writeString(content);

    let dataCell = new Cell()
    dataCell.bits.writeCoins(totalSupply);
    dataCell.bits.writeAddress(token_wallet_address);
    dataCell.bits.writeCoins(0);
    dataCell.bits.writeCoins(0);
    dataCell.refs.push(contentCell);
    dataCell.refs.push(tokenCode);
    return dataCell
}
