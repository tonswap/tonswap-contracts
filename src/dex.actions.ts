import {Address, Cell} from "ton";
import BN from "bn.js";
import {addressToSlice264, stripBoc, toDecimals} from "./utils";
const TRC20_TRANSFER = 1;
const TRC20_TRANSFER_RECIPT = 536870913;
const CLAIM_REWARDS = 4;
const REMOVE_LIQUIDITY = 6;
const SWAP_IN = 7;
const SWAP_OUT_SUB_OP = 8;
const ADD_LIQUIDITY_SUB_OP = 2;
type UPDATE_ACTIONS = '9' | '10';  //UPDATE_TOKEN OR UPDATE_PROTOCOL

const bobAddress = Address.parseFriendly('EQD4FPq-PRDieyQKkizFTRtSDyucUIqrj0v_zXJmqaDp6_0t').address;


export class DexActions {

    static async initData() {
        let messageBody = new Cell();
        messageBody.bits.writeUint(101, 32) // op
        messageBody.bits.writeUint(1, 64) // query_id
        return messageBody;
    }

    static async transferAndAddLiquidity(to: Address, tokenAmount: BN, slippage: number) {
        let messageBody = new Cell();
        messageBody.bits.writeUint(TRC20_TRANSFER, 32) // action
        messageBody.bits.writeUint(0, 64) // query-id
        const to264 = addressToSlice264(to);
        messageBody.bits.writeUint(to264, 264);
        messageBody.bits.writeCoins(tokenAmount); // sent amount
        messageBody.bits.writeUint(ADD_LIQUIDITY_SUB_OP, 8); // sub-op
        messageBody.bits.writeUint(slippage, 64) // slippage


        return messageBody;
    }

    static async transfer(to: Address, tokenAmount: BN) {
        let messageBody = new Cell();
        messageBody.bits.writeUint(TRC20_TRANSFER, 32) // action
        messageBody.bits.writeUint(0, 64) // query-id
        const to264 = addressToSlice264(to);
        messageBody.bits.writeUint(to264, 264);

        messageBody.bits.writeCoins(tokenAmount); // sent amount
        return messageBody;
    }

    // static async transferLong(to: Address, tokenAmount: BN) {
    //     let messageBody = new Cell();
    //     messageBody.bits.writeUint(TRC20_TRANSFER, 32) // action
    //     messageBody.bits.writeUint(0, 64) // query-id
    //     messageBody.bits.writeAddress(to);
    //     messageBody.bits.writeCoins(tokenAmount); // sent amount
    //     return messageBody;
    // }


    static async addLiquidity(tokenContract: Address, tokenSender: Address, tonAmount: BN, tokenAmount: BN, slippage: number) {
        let messageBody = new Cell();
        messageBody.bits.writeUint(TRC20_TRANSFER_RECIPT, 32) // action
        messageBody.bits.writeUint(1, 64) // query-id
        const to264 = addressToSlice264(tokenSender);
        messageBody.bits.writeUint(to264, 264);
        messageBody.bits.writeCoins(tokenAmount); // sent amount
        messageBody.bits.writeUint(ADD_LIQUIDITY_SUB_OP, 8); // sub-op
        messageBody.bits.writeUint(slippage, 64) // slippage
        return messageBody;
    }



    static async removeLiquidity(lpAmount: BN) {
        let messageBody = new Cell();
        messageBody.bits.writeUint(REMOVE_LIQUIDITY, 32) // op
        messageBody.bits.writeUint(1, 64) // query_id
        messageBody.bits.writeCoins(lpAmount);
       return messageBody;
    }

    // Swap TON->TRC20
    static async swapIn(minAmountOut: BN) {

        let messageBody = new Cell();
        messageBody.bits.writeUint(SWAP_IN, 32) // action
        messageBody.bits.writeUint(1, 64) // query-id
        messageBody.bits.writeCoins(minAmountOut); // min amount out
        return messageBody;
    }

    // Swap Out TRC20 -> TON
    static async swapOut(trcSender: Address, tokenAmount: BN, minAmountOut: BN) {
        let messageBody = new Cell();
        messageBody.bits.writeUint(TRC20_TRANSFER_RECIPT, 32) // action
        messageBody.bits.writeUint(1, 64) // query-id
        const to264 = addressToSlice264(trcSender);
        messageBody.bits.writeUint(to264, 264);
        messageBody.bits.writeCoins(tokenAmount); // sent amount
        messageBody.bits.writeUint(SWAP_OUT_SUB_OP, 8); // sub-op
        messageBody.bits.writeCoins(minAmountOut); // min amount out
        return messageBody;
    }
    // Swap Out TRC20 -> TON
    static async transferAndSwapOut(to :Address, tokenAmount: BN, slippage: BN) {
        let messageBody = new Cell();
        messageBody.bits.writeUint(TRC20_TRANSFER, 32) // action
        messageBody.bits.writeUint(0, 64) // query-id
        const to264 = addressToSlice264(to);
        messageBody.bits.writeUint(to264, 264);
        messageBody.bits.writeCoins(tokenAmount); // sent amount
        messageBody.bits.writeUint(ADD_LIQUIDITY_SUB_OP, 8); // sub-op
        messageBody.bits.writeUint(slippage, 64) // slippage
        return messageBody;

    }

    static async claimRewards() {
        let messageBody = new Cell();
        messageBody.bits.writeUint(CLAIM_REWARDS, 32) // action
        messageBody.bits.writeUint(1, 64) // query-id
        return  messageBody;
    }

    static async updateAdminData(op: UPDATE_ACTIONS, allocPoints: BN) {
        let messageBody = new Cell();
        messageBody.bits.writeUint( new BN(op), 32) // action
        messageBody.bits.writeUint(1, 64) // query-id
        messageBody.bits.writeCoins(allocPoints);
        return messageBody;
    }

    static async mx() {
        let messageBody = new Cell();
        messageBody.bits.writeUint( new BN(5), 32) // action
        messageBody.bits.writeUint( new BN(0), 64) // query_id
        return messageBody;
    }
}



async function init(amm: string, token ='EQAycqbigAAkekkGG1A_3LSVGS1RfvJb4YavqUcbUg0pYK0u') {



    const lpAddress = Address.parseFriendly(amm).address;
    // let x = await DexActions.addLiquidity(KILO_TOKEN, bobAddress,  toDecimals(10), toDecimals(100), 2);
    // console.log(x);

    // let mint = await DexActions.mx();
    // const mintData = mint.toString();
    // const boc = stripBoc(mintData);
    // const deeplink =  `ton://transfer/${TOKEN}?amount=100000000&text=${boc}`;
    // console.log('mint TOKEN',deeplink);


    let transfer = await DexActions.transfer(lpAddress, new BN(1))
    const transferStr = transfer.toString();
    const bocT = stripBoc(transferStr);
    const deeplinkTransfer =  `ton://transfer/${token}?amount=100000000&text=${bocT}`;
    console.log(`simple TOKEN transfer`, deeplinkTransfer)

    // let transferLong = await DexActions.transferLong(lpAddress, new BN(1))
    // const transferStr2 = transferLong.toString();
    // const bocT2 = stripBoc(transferStr2);
    // const deeplinkTransfer2 =  `ton://transfer/${TOKEN}?amount=100000000&text=${bocT2}`;
    // console.log(`simple TOKEN transfer Long Address`, deeplinkTransfer2)


    let initData = await DexActions.initData()
    const initDataStr = initData.toString();
    const bocI = stripBoc(initDataStr);
    const initTransfer =  `ton://transfer/${amm}?amount=100000000&text=${bocI}`;
    console.log(`
    LP init data ${initTransfer}`)

    const transferAndLiq = await DexActions.transferAndAddLiquidity(lpAddress, toDecimals(10), 10 )
    const boc2 = stripBoc(transferAndLiq.toString());
    const deeplink2 =  `ton://transfer/${token}?amount=250000000&text=${boc2}`;
    console.log(`*** ADD-LIQUIDITY *** 
    transfer-erc20 -> add-liquditiy-> 
    ${deeplink2}`);


    const swAction = await DexActions.transferAndSwapOut(lpAddress, toDecimals(1), new BN(10) )
    const boc3 = stripBoc(swAction.toString());
    const deeplink3 =  `ton://transfer/${token}?amount=250000000&text=${boc3}`;
    console.log(`*** swap token to TON *** 
    transfer-erc20 -> swap out->
    ${deeplink3}`);

    // ton://transfer/EQA2aQA7gHRQmR0qNnLwPA0LtHOltHbE6YFBj9bk2aQ1Dpeh?amount=100000000&text=000000050000000000000000
}

(async ()=> {
    const AMM = 'EQDbhtPZi05FKB4ajx6twLoA3wo8j_6RAgBHybJChoW9nyno';//AMM V20
    init(AMM);
})()

/*
ton://transfer/EQBasP-MyMyesmwoNvJrL6KS27bbjNHLavlRcI1jU35TQdyG?amount=100000000&text=00000001000000000000000100B53F755142BBCAF2C7FFE5A320838209E9A4C4972C37D3D97785D4ED7EA718AF502540BE400020000000000000004
ton://transfer/kQA2aQA7gHRQmR0qNnLwPA0LtHOltHbE6YFBj9bk2aQ1Diwr?amount=250000000&text=000000010000000000000000009D54BB16C50AC99A3DEAF124D93F70496198450069CCA61184380116EA20F17D52E90EDD000

ton://transfer/EQBasP-MyMyesmwoNvJrL6KS27bbjNHLavlRcI1jU35TQdyG?amount=100000000&text=00000001000000000000000000B53F755142BBCAF2C7FFE5A320838209E9A4C4972C37D3D97785D4ED7EA718AF502540BE400020000000000000004

query 1
ton://transfer/EQBasP-MyMyesmwoNvJrL6KS27bbjNHLavlRcI1jU35TQdyG?amount=250000000&text=000000010000000000000000009D54BB16C50AC99A3DEAF124D93F70496198450069CCA61184380116EA20F17D52E90EDD000

simple transfer
 ton://transfer/EQBasP-MyMyesmwoNvJrL6KS27bbjNHLavlRcI1jU35TQdyG?amount=100000000&text=00000001000000000000000000B53F755142BBCAF2C7FFE5A320838209E9A4C4972C37D3D97785D4ED7EA718AF502540BE400
 */