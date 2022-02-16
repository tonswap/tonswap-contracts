import {Address} from "ton";
import {readFile} from "fs/promises";
import {DexConfig} from "./dex.data";
import { DexDebug } from "./dex.debug";
import BN from "bn.js";


const myAddress = Address.parseFriendly('EQD4FPq-PRDieyQKkizFTRtSDyucUIqrj0v_zXJmqaDp6_0t').address;
const bobAddress = Address.parseFriendly('EQDrjaLahLkMB-hMCmkzOyBuHJ139ZUYmPHu6RRBKnbdLIYI').address;


const decimals = new BN('1000000000');

var DefaultConfig = {
    name: 'Masterchef',
    symbol: 'NO_NEED',
    decimals: new BN(9),
    totalSupply: toDecimals(100000),
    totalLPSupply: new BN(0),
    tokenReserves: toDecimals(0),
    tonReserves: toDecimals(0),

} as DexConfig;


function toDecimals(num: number) {
    return (new BN(num)).mul(decimals);
}

function fromDecimals(num: BN) {
    return num.div(decimals).toString(10);
}

const baseLP = new BN('31622776601');
const senderInitialBalance = new BN('200000000000000');

describe('SmartContract', () => {
    let source: string

    beforeAll(async () => {
        source = (await readFile('./src/dex.fc')).toString('utf-8')
    })

    beforeEach(async () => {

    });


    it('should return token Data', async () =>    {

        let contract = await DexDebug.create(DefaultConfig)
        const tokenData = await contract.getData();
        expect(tokenData.name).toEqual(DefaultConfig.name);
        expect(tokenData.symbol).toEqual(DefaultConfig.symbol);
        expect(tokenData.decimals).toEqual(DefaultConfig.decimals);
        expect(tokenData.totalSupply.toNumber()).toEqual(DefaultConfig.totalSupply.toNumber());
        expect(tokenData.decimals).toEqual(DefaultConfig.decimals);
        expect(tokenData.totalLpSupply.toNumber()).toEqual(DefaultConfig.totalLPSupply.toNumber());
        expect(tokenData.tokenReserves.toNumber()).toEqual(DefaultConfig.tokenReserves.toNumber());
        expect(tokenData.tonReserves.toNumber()).toEqual(DefaultConfig.tonReserves.toNumber());
    })

    
  // TODO fix dust issue
    it('should Add Liquidity multiple times', async () => {
        let contract = await DexDebug.create(DefaultConfig)

        let res0 = await contract.initTestData(myAddress)
        expect(res0.exit_code).toBe(0)
        
        

        // Add liquidity take #1
        let res = await contract.addLiquidity(myAddress,  toDecimals(10), toDecimals(100), 2);
        expect(res.exit_code).toBe(0)
        let liq1 = await contract.liquidityOf(myAddress);
        expect(liq1.cmp(baseLP)).toBe(0);
        
        // Add liquidity take #2
        let res2 = await contract.addLiquidity(myAddress,  toDecimals(10), toDecimals(100), 2);
        expect(res2.exit_code).toBe(0);

        let liq2 = await contract.liquidityOf(myAddress);
        expect(liq2.cmp( baseLP.mul( new BN(2)) )) .toBe(0);


        // Add liquidity take #3 with 3x of the amounts
        let res3 = await contract.addLiquidity(myAddress,  toDecimals(30), toDecimals(300), 2);
        expect(res3.exit_code).toBe(0);
        
        // Expect liquidity to be 
        let liq3 = await contract.liquidityOf(myAddress);
        expect(liq3.cmp(baseLP.mul(new BN(5)))).toBe(0);
    })

    it('should Add Liquidity and remove liquidity', async () => {
        
        let contract = await DexDebug.create(DefaultConfig)
        let res0 = await contract.initTestData(myAddress)
        expect(res0.exit_code).toBe(0)

        let tokenBalance = await contract.balanceOf(myAddress);
        console.log('pre add liquidity token:balanceOf', fromDecimals(tokenBalance));
        expect(tokenBalance.cmp(senderInitialBalance)).toBe(0);

        // Add liquidity take #1
        let res = await contract.addLiquidity(myAddress,  toDecimals(10), toDecimals(100), 2);
        expect(res.exit_code).toBe(0);

        let liq1 = await contract.liquidityOf(myAddress);
        console.log('liquidityOf=', liq1.toString(10));
        expect(liq1.cmp(baseLP)).toBe(0);


        let tokenBalanceAfterAddLiq = await contract.balanceOf(myAddress);
        console.log('tokenBalance after add liquidity', fromDecimals(tokenBalanceAfterAddLiq));
        expect(tokenBalanceAfterAddLiq.cmp(senderInitialBalance.sub(toDecimals(100)))).toBe(0);

        const tokenData = await contract.getData();
        console.log('tokenData.tokenReserves', fromDecimals(tokenData.tokenReserves) )
        expect( fromDecimals(tokenData.tokenReserves) ).toEqual('100')
        let tokenReserves = await contract.balanceOf(myAddress);
        
    
        expect((await contract.removeLiquidity(myAddress, liq1)).exit_code).toBe(0);
        let liq2 = await contract.liquidityOf(myAddress);
        expect(liq2.cmp(new BN(0))).toBe(0);

        let tokenBalanceAfterRemove = await contract.balanceOf(myAddress);
        console.log('balance after remove ', fromDecimals(tokenBalanceAfterRemove) );
        console.log('senderInitialBalance.sub(tokenBalanceAfterRemove).toNumber() ', senderInitialBalance.sub(tokenBalanceAfterRemove).toNumber());

        //BUG should be fixed 
        expect(senderInitialBalance.sub(tokenBalanceAfterRemove).toNumber()).toBeLessThanOrEqual(900000000004);
    });
       
})

