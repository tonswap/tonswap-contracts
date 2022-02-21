import {Address} from "ton";
import {readFile} from "fs/promises";
import {DexConfig} from "./dex.data";
import { DexDebug } from "./dex.debug";
import BN from "bn.js";


const myAddress = Address.parseFriendly('EQD4FPq-PRDieyQKkizFTRtSDyucUIqrj0v_zXJmqaDp6_0t').address;
const PROTOCOL_ADMIN = Address.parseFriendly('EQDrjaLahLkMB-hMCmkzOyBuHJ139ZUYmPHu6RRBKnbdLIYI').address;
const KILO_TOKEN = Address.parseFriendly('EQA2aQA7gHRQmR0qNnLwPA0LtHOltHbE6YFBj9bk2aQ1Dpeh').address;
const TOKEN_ADMIN = Address.parseFriendly('EQCbPJVt83Noxmg8Qw-Ut8HsZ1lz7lhp4k0v9mBX2BJewhpe').address;



const decimals = new BN('1000000000');

var configData = {
    name: 'LP Token',
    symbol: 'LP',
    decimals: new BN(9),
    totalSupply: toDecimals(0),
    tokenReserves: toDecimals(0),
    tonReserves: toDecimals(0),
    tokenAddress: KILO_TOKEN,
    tokenAdmin: TOKEN_ADMIN,
    tokenAllocPoints: new BN(10),
    protocolAdmin: PROTOCOL_ADMIN,
    protocolAllocPoints: new BN(77),
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

        let contract = await DexDebug.create(configData)
        const tokenData = await contract.getData();
        expect(tokenData.name).toEqual(configData.name);
        expect(tokenData.symbol).toEqual(configData.symbol);
        expect(tokenData.decimals).toEqual(configData.decimals);
        expect(tokenData.totalSupply.toNumber()).toEqual(configData.totalSupply.toNumber());
        expect(tokenData.decimals).toEqual(configData.decimals);
        expect(tokenData.tokenReserves.toNumber()).toEqual(configData.tokenReserves.toNumber());
        expect(tokenData.tonReserves.toNumber()).toEqual(configData.tonReserves.toNumber());
    })


    it('should return admin Data', async () =>    {

        let contract = await DexDebug.create(configData)
        const tokenData = await contract.getAdminData();
        expect(tokenData.admin.equals(configData.tokenAdmin)).toBe(true);
        expect(tokenData.adminPoints.toNumber()).toEqual(configData.tokenAllocPoints.toNumber());
        expect(tokenData.protocol.equals(configData.protocolAdmin)).toBe(true);
        expect(tokenData.protocolPoints.toNumber()).toEqual(configData.protocolAllocPoints.toNumber());
    })

    

    it('should Add Liquidity multiple times', async () => {
        let contract = await DexDebug.create(configData)

        let res0 = await contract.initTestData(myAddress)
        expect(res0.exit_code).toBe(0)
        
        

        // Add liquidity take #1
        let res = await contract.addLiquidity(KILO_TOKEN, myAddress,  toDecimals(10), toDecimals(100), 2);
        expect(res.exit_code).toBe(0)
        let liq1 = await contract.balanceOf(myAddress);
        console.log(liq1.toNumber());
        expect(liq1.cmp(baseLP)).toBe(0);
        
        // Add liquidity take #2
        let res2 = await contract.addLiquidity(KILO_TOKEN, myAddress, toDecimals(10), toDecimals(100), 2);
        expect(res2.exit_code).toBe(0);

        let liq2 = await contract.balanceOf(myAddress);
        expect(liq2.cmp( baseLP.mul( new BN(2)) )) .toBe(0);


        // Add liquidity take #3 with 3x of the amounts
        let res3 = await contract.addLiquidity(KILO_TOKEN, myAddress, toDecimals(30), toDecimals(300), 2);
        expect(res3.exit_code).toBe(0);
        
        // Expect liquidity to be 
        let liq3 = await contract.balanceOf(myAddress);
        expect(liq3.cmp(baseLP.mul(new BN(5)))).toBe(0);
    })

//     it('should Add Liquidity and remove liquidity', async () => {
        
//         let contract = await DexDebug.create(configData)
//         let res0 = await contract.initTestData(myAddress)
//         expect(res0.exit_code).toBe(0)

//         let tokenBalance = await contract.balanceOf(myAddress);
//         console.log('pre add liquidity token:balanceOf', fromDecimals(tokenBalance));
//         expect(tokenBalance.cmp(senderInitialBalance)).toBe(0);

//         // Add liquidity take #1
//         let res = await contract.addLiquidity(KILO_TOKEN, tokenSender toDecimals(10), toDecimals(100), 2);
//         expect(res.exit_code).toBe(0);

//         let liq1 = await contract.liquidityOf(myAddress);
//         console.log('liquidityOf=', liq1.toString(10));
//         expect(liq1.cmp(baseLP)).toBe(0);


//         let tokenBalanceAfterAddLiq = await contract.balanceOf(myAddress);
//         console.log('tokenBalance after add liquidity', fromDecimals(tokenBalanceAfterAddLiq));
//         expect(tokenBalanceAfterAddLiq.cmp(senderInitialBalance.sub(toDecimals(100)))).toBe(0);

//         const tokenData = await contract.getData();
//         console.log('tokenData.tokenReserves', fromDecimals(tokenData.tokenReserves) )
//         expect( fromDecimals(tokenData.tokenReserves) ).toEqual('100')
//         let tokenReserves = await contract.balanceOf(myAddress);
        
    
//         expect((await contract.removeLiquidity(myAddress, liq1)).exit_code).toBe(0);
//         let liq2 = await contract.liquidityOf(myAddress);
//         expect(liq2.cmp(new BN(0))).toBe(0);

//         let tokenBalanceAfterRemove = await contract.balanceOf(myAddress);
//         console.log('balance after remove ', fromDecimals(tokenBalanceAfterRemove) );
//         console.log('senderInitialBalance.sub(tokenBalanceAfterRemove).toNumber() ', senderInitialBalance.sub(tokenBalanceAfterRemove).toNumber());

//         expect(senderInitialBalance.sub(tokenBalanceAfterRemove).toNumber()).toBe(0);
//     });


//     it('should swap in Token->TON', async () => {
//         let contract = await DexDebug.create(configData)
//         await contract.initTestData(myAddress)

//         // Add liquidity take #1
//         let res = await contract.addLiquidity(KILO_TOKEN, tokenSender toDecimals(10), toDecimals(100), 2);

//     });
       
})

