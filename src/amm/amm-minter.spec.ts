
import {
    Address, Cell, CellMessage, CommonMessageInfo, InternalMessage, RawCommonMessageInfo,
} from "ton";
import BN from "bn.js";
import { JettonMinter } from "../jetton/jetton-minter";
import { AmmMinter } from "./amm-minter";
import { parseActionsList, SendMsgOutAction, parseJettonTransfer, sliceToAddress267 } from "../utils";
// @ts-ignore
import { SmartContract, ExecutionResult, Suc } from "ton-contract-executor";
import { JettonWallet } from "../jetton/jetton-wallet";
import { LpWallet } from "./amm-wallet";
import { actionToInternalMessage, addLiquidityCell, parseAmmResp, swapTokenCell } from "./amm-utils";
import { OPS } from "./ops";


const contractAddress = Address.parse('EQD4FPq-PRDieyQKkizFTRtSDyucUIqrj0v_zXJmqaDp6_0t')
const minterAddress = Address.parse('EQD4FPq-PRDieyQKkizFTRtSDyucUIqrj0v_zXJmqaDp6_0t')
const alice = Address.parseFriendly('EQCLjyIQ9bF5t9h3oczEX3hPVK4tpW2Dqby0eHOH1y5_Nvb7').address;
const amm = Address.parseFriendly('EQCbPJVt83Noxmg8Qw-Ut8HsZ1lz7lhp4k0v9mBX2BJewhpe').address;

const aliceSubwallet = Address.parseFriendly('EQCLjyIQ9bF5t9h3oczEX3hPVK4tpW2Dqby0eHOH1y5_Nvb7').address;


const TRC20_TRANSFER = 0xf8a7ea5;
const SWAP_OUT_SUB_OP = 8;
const OP_ADD_LIQUIDITY = 22;


describe('Jetton Minter ', () => {
    

    
    it("mint USDC", async () => {

        const {
            masterUSDC,
            aliceUSDC
        } = await initEnvironment();
    
        const jettonWalletResponse = await aliceUSDC.getData();
        console.log(`jettonWalletResponse  (after send) balance:${jettonWalletResponse.balance.toString()}`);

        ///////// mint again
        const mintResponse2 = await masterUSDC.mint(alice, alice, new BN(2505));
        const mintMessage2 = mintResponse2.actions[0] as SendMsgOutAction;
        const mintMessageRAW = actionToInternalMessage(amm, contractAddress, mintMessage2.message?.body);
        
        const mintMessageResponse2 = await aliceUSDC.sendInternalMessage(mintMessageRAW);
        expect(mintMessageResponse2.exit_code).toBe(0);
        
        const data2 = await aliceUSDC.getData();
        console.log(`jettonWalletResponse2  (after send #2) balance:${ data2.balance.toString()}`);
    })

    it("alice sends bob USDC", async () => {
        const {
            masterUSDC,
            aliceUSDC
        } = await initEnvironment();

        let aliceData = await aliceUSDC.getData();
        console.log(`alice owner: ${sliceToAddress267(aliceData.owner).toFriendly()}`);
        
        const transferResponse = await aliceUSDC.transferOverloaded(alice, amm, new BN(502), amm, undefined, new BN(100000000), OPS.ADD_LIQUIDITY, new BN(5));
        
        const transferMessage = transferResponse.actions[0] as SendMsgOutAction;
        
        const msg = actionToInternalMessage(amm, contractAddress, transferMessage.message?.body);
        const bobUSDC  = await JettonWallet.createFromMessage(
            transferMessage.message?.init?.code as Cell,
            transferMessage.message?.init?.data as Cell,
            msg);

        const bobUsdcData = await bobUSDC.getData();
        console.log(`bobUsdcData after transfer balance:${ bobUsdcData.balance.toString()}  owner: ${ sliceToAddress267(bobUsdcData.owner).toFriendly()}`);
    })

    it("alice adds Liquidity", async () => {
        
        await addLiquidity();
        
    })

    it.only("alice removes liquidity", async () => {
        const expectedOutPut = '332665999';

        const {
            aliceUSDC,
            masterAMM,
            ammUsdcWallet,
            lpWallet
        } = await addLiquidity();  //create 

        console.log(await lpWallet.getData());
        
    });

    it.only("alice swaps usdc to TON", async () => {
        const expectedOutPut = '332665999';

        const {
            aliceUSDC,
            masterAMM,
            ammUsdcWallet
        } = await addLiquidity();  //create 
        

        const minAmountOut = new BN(expectedOutPut);
        const transferResponse = await aliceUSDC.transferOverloaded(alice, amm, new BN(251),  amm, undefined, new BN(101), OPS.SWAP_TOKEN, minAmountOut);
        const transferMessage = transferResponse.actions[0] as SendMsgOutAction;
        
        const jettonMsg = actionToInternalMessage(amm, contractAddress, transferMessage.message?.body);
        const transferUsdcResultRaw = await ammUsdcWallet.sendInternalMessage(jettonMsg);
        const transferUsdcResult = parseAmmResp(transferUsdcResultRaw);
            
        const bobUsdcData = await ammUsdcWallet.getData();
        console.log(`bobUsdcData after transfer balance:${ bobUsdcData.balance.toString()}  owner: ${ sliceToAddress267(bobUsdcData.owner).toFriendly()}`);

        
        console.log(transferUsdcResult.actions);
        
        const transferNotification = transferUsdcResult.actions[2] as SendMsgOutAction;
        const msgTransferUsdcToAmm = actionToInternalMessage(amm, contractAddress, transferNotification.message?.body );

        let ammSwapTokenResponseRaw = await masterAMM.sendInternalMessage(msgTransferUsdcToAmm);
        
        console.log(ammSwapTokenResponseRaw);
        
        let ammSwapTokenResponse = parseAmmResp(ammSwapTokenResponseRaw);
        console.log(ammSwapTokenResponse.actions);
        

        let sendTonAfterSwapMessage = ammSwapTokenResponse.actions[0] as SendMsgOutAction;
        console.log('sendTonAfterSwapMessage value=',sendTonAfterSwapMessage.message.info?.value.coins.toString());
        expect(sendTonAfterSwapMessage.message.info?.value.coins.toString()).toBe(expectedOutPut);

    });

    

    it.only("alice swaps TON to USDC", async () => {
        const expectedOutPut = '332665999';

        const {
            aliceUSDC,
            masterAMM,
            ammUsdcWallet
        } = await addLiquidity();  //create 

    });
});


async function initEnvironment() {
    const masterUSDC = await JettonMinter.create(new BN(0), alice, "https://ipfs.io/ipfs/dasadas");
    const mintResponse = await masterUSDC.mint(alice, alice, new BN(1500));
    const mintMessage = mintResponse.actions[0] as SendMsgOutAction;
    //send the transfer message to the contract
    const initTransferMessage = actionToInternalMessage(amm, aliceSubwallet, mintMessage.message?.body);
    // Deploy USDC Sub wallet based on the output action from the mint result, 
    // so we take the output message and initiate a contract based on the code data and init state and save reference to it
    let aliceUSDC = await JettonWallet.createFromMessage(mintMessage.message?.init?.code as Cell, mintMessage.message?.init?.data as Cell, initTransferMessage);

    const masterAMM = await AmmMinter.create(new BN(0), alice, "https://ipfs.io/ipfs/dasadas");

    return {
        masterUSDC,
        aliceUSDC,
        masterAMM
    }
} 



async function addLiquidity() {
    const {
        aliceUSDC,
        masterAMM
    } = await initEnvironment();

    let aliceData = await aliceUSDC.getData();
    console.log(`alice owner: ${sliceToAddress267(aliceData.owner).toFriendly()}`);

    const transferResponse = await aliceUSDC.transferOverloaded(alice, amm, new BN(502),  amm, undefined, new BN(101), OPS.ADD_LIQUIDITY, new BN(5));
    const transferMessage = transferResponse.actions[0] as SendMsgOutAction;
    
    const jettonMsg = actionToInternalMessage(amm, contractAddress, transferMessage.message?.body);
    const ammUsdcWallet = await JettonWallet.createFromMessage(
        transferMessage.message?.init?.code as Cell,
        transferMessage.message?.init?.data as Cell,
        jettonMsg);
        
    const bobUsdcData = await ammUsdcWallet.getData();
    console.log(`bobUsdcData after transfer balance:${ bobUsdcData.balance.toString()}  owner: ${ sliceToAddress267(bobUsdcData.owner).toFriendly()}`);
    //@ts-ignore
    const transferNotification = ammUsdcWallet.initMessageResult.actions[2] as SendMsgOutAction;
  //  console.log(transferNotification);

    const msgUsdcToAmm = actionToInternalMessage(amm, contractAddress, transferNotification.message?.body );

    let ammRespRaw = await masterAMM.sendInternalMessage(msgUsdcToAmm)
    const ammData = await masterAMM.getData();
    console.log(`ammData 
        tonReservers:${ammData.tonReserves.toString()}
        tokenReserves:${ammData.tokenReserves.toString()}
        totalSupply:${ammData.totalSupply.toString()}
    `);
    
    let ammRes = parseAmmResp(ammRespRaw)

    let mintLpMessage = ammRes.actions[0] as SendMsgOutAction;
    
    const lpMsg = actionToInternalMessage(amm, contractAddress, mintLpMessage.message?.body);
    const lpWallet = await LpWallet.createFromMessage(
        mintLpMessage.message?.init?.code as Cell,
        mintLpMessage.message?.init?.data as Cell,
        lpMsg);
    
    let lpData = await lpWallet.getData();

    expect(lpData.balance.toString()).toBe("708519"); // lp amount

    return {
        aliceUSDC,
        masterAMM,
        ammUsdcWallet,
        lpWallet,
    }
}
