import {Address} from "ton";
import {readFile} from "fs/promises";
import {DexConfig} from "./dex.data";
import { DexDebug } from "./dex.debug";
import BN from "bn.js";


const myAddress = Address.parseFriendly('EQD4FPq-PRDieyQKkizFTRtSDyucUIqrj0v_zXJmqaDp6_0t').address;
const bobAddress = Address.parseFriendly('EQDrjaLahLkMB-hMCmkzOyBuHJ139ZUYmPHu6RRBKnbdLIYI').address;


const decimals = new BN('10000000000');

var DefaultConfig = {
    name: 'Masterchef',
    symbol: 'NO_NEED',
    decimals: new BN(9),
    totalSupply: toBN(100000),
    totalLPSupply: new BN(12),
    tokenReserves: toBN(0),
    tonReserves: toBN(0),

} as DexConfig;


function toBN(num: number) {
    return (new BN(num)).mul(decimals);
}


describe('SmartContract', () => {
    let source: string

    beforeAll(async () => {
        source = (await readFile('./src/dex.fc')).toString('utf-8')
    })


    // it('should return token Data', async () =>    {

    //     let contract = await DexDebug.create(DefaultConfig)
    //     const tokenData = await contract.getData();
    //     expect(tokenData.name).toEqual(DefaultConfig.name);
    //     expect(tokenData.symbol).toEqual(DefaultConfig.symbol);
    //     expect(tokenData.decimals).toEqual(DefaultConfig.decimals);
    //     expect(tokenData.totalSupply.toNumber()).toEqual(DefaultConfig.totalSupply.toNumber());
    //     expect(tokenData.decimals).toEqual(DefaultConfig.decimals);
    //     expect(tokenData.totalLpSupply.toNumber()).toEqual(DefaultConfig.totalLPSupply.toNumber());
    //     expect(tokenData.tokenReserves.toNumber()).toEqual(DefaultConfig.tokenReserves.toNumber());
    //     expect(tokenData.tonReserves.toNumber()).toEqual(DefaultConfig.tonReserves.toNumber());
    // })

    

    it('should Add Liquidity multiple times', async () => {
        let contract = await DexDebug.create(DefaultConfig)

        let res0 = await contract.initTestData(myAddress)
        expect(res0.exit_code).toBe(0)
        
        const baseLP = 316227766016;

        let res = await contract.addLiquidity(myAddress,  toBN(10), toBN(100), 2);
        expect(res.exit_code).toBe(0)
        expect(res.returnValue).toBe(baseLP);

        let res2 = await contract.addLiquidity(myAddress,  toBN(10), toBN(100), 2);
        expect(res2.exit_code).toBe(0);
        expect(res2.returnValue).toBeCloseTo(baseLP*2, 12);

    
        expect(await contract.liquidityOf(myAddress)).toBe(2);

        let res3 = await contract.addLiquidity(myAddress,  toBN(30), toBN(300), 2);
        expect(res3.exit_code).toBe(0);
        expect(res2.returnValue).toBeCloseTo(baseLP * 5, 12);

        expect(await contract.liquidityOf(myAddress)).toBe(baseLP * 5);        
    })

    


//     it('should mint a couple of tokens ', async () => {
//         let contract = await Trc721Debug.create(DefaultConfig);

//         let res1 = await contract.mint(myAddress)
//         expect(res1.exit_code).toBe(0)
//         let res2 = await contract.mint(myAddress)
//         expect(res2.exit_code).toBe(0)        

//         let uri = await contract.getTokenUri(2)
//         let nftData = await fethcIpfs(uri);
//         expect(nftData.image).toBe(APE_2_IMAGE);

//         expect( await contract.getSupply()).toBe(2)
//         expect( await contract.balanceOf(myAddress)).toBe(2);

//         expect( await contract.balanceOf(bobAddress)).toBe(0);

       

//         //console.log(await contract.getOwner(1));

//         //console.log(await contract.getOwner(1));
        
//         //expect((await contract.getOwner(2)).toFriendly()).toEqual(myAddress.toFriendly())
//     })

//     it('should mint a couple of tokens from different users ', async () => {
//         let contract = await Trc721Debug.create(DefaultConfig);

//         let res1 = await contract.mint(myAddress)
//         expect(res1.exit_code).toBe(0)
//         expect( await contract.getSupply()).toBe(1)
//         expect( await contract.balanceOf(myAddress)).toBe(1);

//         let res2 = await contract.mint(bobAddress)
//         expect(res2.exit_code).toBe(0)        
//         expect( await contract.getSupply()).toBe(2)
//         expect( await contract.balanceOf(bobAddress)).toBe(1);

//         let uri = await contract.getTokenUri(2)
//         let nftData = await fethcIpfs(uri);
//         expect(nftData.image).toBe(APE_2_IMAGE);

        
//     });
       
    
//     it('should transfer from user to bob', async () => {
//         let contract = await Trc721Debug.create(DefaultConfig);

//         let res1 = await contract.mint(myAddress)
//         expect(res1.exit_code).toBe(0)
//         expect( await contract.getSupply()).toBe(1)
//         expect( await contract.balanceOf(myAddress)).toBe(1);

//         contract.transfer(bobAddress)
        
//     });

 

})

