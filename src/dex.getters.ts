import {Address, Cell, Slice, TonClient} from "ton";
import TonWeb from "tonweb";
import BN from "bn.js";
import {
    base64StrToCell,
    cellToString,
} from "./utils";


const client = new TonClient({
    endpoint: 'https://scalable-api.tonwhales.com/jsonRPC'
});

const tonweb = new TonWeb(new TonWeb.HttpProvider('https://scalable-api.tonwhales.com/jsonRPC', {apiKey: '13b3407c286b4f36bf08bc3727affa1c34764bc94e0702c265056ab8ff8039d5'}));


class DexGetters {
    constructor(public readonly contractAddress: Address) {}

    async balanceOf(owner: Address) {
        let wc = owner.workChain;
        let address = new BN(owner.hash);
        const res = await tonweb.call(this.contractAddress.toFriendly(),'ibalance_of', [
            [ 'num', wc.toString(10) ],
            [ 'num', address.toString(10)]
        ]);

        return BigInt(res.stack[0][1]);
    }

    async getAmountOut(amountIn: BN, isTokenSource: boolean) {
        // lite-client> runmethod EQDbhtPZi05FKB4ajx6twLoA3wo8j_6RAgBHybJChoW9nyno get_amount_out_lp 1000000 1
        console.log(this.contractAddress.toFriendly())
        console.log(['num', amountIn.toString(10) ]);
        console.log([ 'num', isTokenSource ? '1':'0' ])
        const res = await tonweb.call(this.contractAddress.toFriendly(),'get_amount_out_lp', [
            ['num', amountIn.toString(10) ],
            [ 'num', isTokenSource ? '1':'0' ],
        ]);
        console.log(res);
        return BigInt(res.stack[0][1]);
    }

    async getData() {
        const res = await client.callGetMethod(this.contractAddress,'get_token_data', []);
        var buf = Buffer.from(res.stack[0][1].bytes, 'base64');
        const cellName = base64StrToCell(res.stack[0][1].bytes)
        const name = cellToString(cellName[0]);
        const cSymbol = base64StrToCell(res.stack[1][1].bytes)
        const symbol = cellToString(cSymbol[0]);
        const decimals = res.stack[2][1] as BN;
        const totalSupply = res.stack[3][1] as BN;
        const tokenReserves = BigInt(res.stack[4][1]);
        const tonReserves = BigInt(res.stack[5][1]);
        //const tokenAddress = sliceToAddress267(res.stack[6] as Cell);
        const initialized = res.stack[7][1] as BN;

        return  {
            name,
            symbol,
            decimals,
            totalSupply,
            tokenReserves,
            tonReserves,
            // tokenAddress,
            initialized
        }
    }

    async getAdminData() {
        const res = await client.callGetMethod(this.contractAddress,'get_admin_data', []);
        //console.log(res);
        // todo
        return (res.stack[0] as BN);
    }

    async getRewards(owner: Address) {
        let wc = owner.workChain;
        let address = new BN(owner.hash);
        const res = await tonweb.call(this.contractAddress.toFriendly(),'get_rewards_of', [
            [ 'num', wc.toString(10) ],
            [ 'num', address.toString(10)]
        ]);
        console.log(res)
        return BigInt(res.stack[0][1]);
    }

}

const instance = new DexGetters(Address.parse('EQCSOxDQI94b0vGCN2Lc3DPan8v3P_JRt-z4PJ9Af2_BPHx5'));

export {
    instance
};



async function init() {
    const deployer = Address.parse('EQDrjaLahLkMB-hMCmkzOyBuHJ139ZUYmPHu6RRBKnbdLIYI');
    const adminData = await instance.getAdminData();
    console.log(`adminData ${adminData}`);
    const data = await instance.getData();
   console.log(`data `, data);

    const balance = await instance.balanceOf(deployer)
    console.log('deployer balance ', balance.toString(10));

    const rewards = await instance.getRewards(deployer);
    console.log(rewards);
    console.log('rewards', rewards.toString(10));

    let amountIn = new BN(10000);
    const amount_out = await instance.getAmountOut(amountIn, true);
    console.log(`swapping in ${amountIn.toNumber().toLocaleString()}🎱 amount_out ${ parseInt(amount_out.toString(10)).toLocaleString()}💎 `);

    amountIn = new BN(3000);
    const amount_out1 = await instance.getAmountOut(amountIn, true);
    console.log(`swapping in ${amountIn.toNumber().toLocaleString()}🎱 amount_out ${ parseInt(amount_out1.toString(10)).toLocaleString()}💎 `);


    amountIn = new BN(9000);
    const amount_out2 = await instance.getAmountOut(amountIn, true);
    console.log(`swapping in ${amountIn.toNumber().toLocaleString()}🎱 amount_out ${ parseInt(amount_out2.toString(10)).toLocaleString()}💎 `);

     // const swapOut = instance.getAmountOut(new BN(100000000), true);
     // console.log(`swapOut for 10Kilo ${swapOut}`);
}


function numberFormat(num: number) {

}


(async ()=> {
 init();
})()

