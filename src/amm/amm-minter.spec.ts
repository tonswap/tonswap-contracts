
import {
    Address, Cell, CellMessage, CommonMessageInfo, InternalMessage,
} from "ton";
import BN from "bn.js";
import { JettonMinter } from "../jetton/jetton-minter.debug";
import { parseActionsList, SendMsgOutAction, parseJettonTransfer } from "../utils";
import { SmartContract } from "ton-contract-executor";
import { JettonWallet } from "./amm-wallet.debug";


const contractAddress = Address.parse('EQD4FPq-PRDieyQKkizFTRtSDyucUIqrj0v_zXJmqaDp6_0t')
const alice = Address.parseFriendly('kQCLjyIQ9bF5t9h3oczEX3hPVK4tpW2Dqby0eHOH1y5_Nk1x').address;
const bob = Address.parseFriendly('EQCbPJVt83Noxmg8Qw-Ut8HsZ1lz7lhp4k0v9mBX2BJewhpe').address;


const TRC20_TRANSFER = 0xf8a7ea5;
const SWAP_OUT_SUB_OP = 8;


// var initData = {
//     name: 'LP Token',
//     symbol: 'LP',
//     decimals: new BN(9),
//     totalSupply: toDecimals(0),
//     tokenReserves: toDecimals(0),
//     tonReserves: toDecimals(0),
//     tokenAddress: SUSHI_TOKEN_V2,
//     tokenAdmin: TOKEN_ADMIN,
//     tokenAllocPoints: new BN(500),
//     protocolAdmin: PROTOCOL_ADMIN,
//     protocolAllocPoints: new BN(0),
// } as DexConfig;


describe('Jetton Minter ', () => {
    
    it("mint USDC", async () => {

        const masterUSDC = await JettonMinter.create(new BN(0), alice, "https://ipfs.io/ipfs/dasadas");
        const mintResponse = await masterUSDC.mint(alice, bob, new BN(1500));
        
        const mintMessage = mintResponse.actions[0] as SendMsgOutAction;
        console.log(mintMessage);
        
        //send the transfer message to the contract
        let initMsg = new CommonMessageInfo( { body: new CellMessage(mintMessage.message?.body) });
        const msg = new InternalMessage({
            to: bob,
            from: contractAddress,
            value: new BN(1000000000), // 0.1 TON
            bounce: false,
            body: initMsg
        })
        // Deploy USDC Sub wallet based on the output action from the mint result, 
        // so we take the output message and initiate a contract based on the code data and init state and save reference to it
        let usdcSubWallet = await JettonWallet.createFromMessage(mintMessage.message?.init?.code as Cell, mintMessage.message?.init?.data as Cell, msg);
    
        const jettonWalletResponse = await usdcSubWallet.getData();
        console.log(`jettonWalletResponse  (after send) balance:${jettonWalletResponse.balance.toString()}`);

        ///////// mint again
        const mintResponse2 = await masterUSDC.mint(alice, bob, new BN(2505));
        const mintMessage2 = mintResponse2.actions[0] as SendMsgOutAction;
        let mintMessageInfo2 = new CommonMessageInfo( { body: new CellMessage(mintMessage2.message?.body) });

        const mintMessageRAW = new InternalMessage({
            to: bob,
            from: contractAddress,
            value: new BN(1000000000), // 0.1 TON
            bounce: false,
            body: mintMessageInfo2
        })
        
        const mintMessageResponse2 = await usdcSubWallet.sendInternalMessage(mintMessageRAW);
        expect(mintMessageResponse2.exit_code).toBe(0);
        
        const data2 = await usdcSubWallet.getData();
        console.log(`jettonWalletResponse2  (after send #2) balance:${ data2.balance.toString()}`);
    })

});



function mintJetton(amount: BN) {

}

