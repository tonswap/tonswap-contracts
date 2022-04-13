
import {
    Address, Cell, CellMessage, CommonMessageInfo, InternalMessage,
} from "ton";
import BN from "bn.js";
import { JettonMinter } from "../jetton/jetton-minter";
import { parseActionsList, SendMsgOutAction, parseJettonTransfer, sliceToAddress267 } from "../utils";
import { SmartContract } from "ton-contract-executor";
import { JettonWallet } from "../jetton/jetton-wallet";


const contractAddress = Address.parse('EQD4FPq-PRDieyQKkizFTRtSDyucUIqrj0v_zXJmqaDp6_0t')
const minterAddress = Address.parse('EQD4FPq-PRDieyQKkizFTRtSDyucUIqrj0v_zXJmqaDp6_0t')
const alice = Address.parseFriendly('EQCLjyIQ9bF5t9h3oczEX3hPVK4tpW2Dqby0eHOH1y5_Nvb7').address;
const bob = Address.parseFriendly('EQCbPJVt83Noxmg8Qw-Ut8HsZ1lz7lhp4k0v9mBX2BJewhpe').address;

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
        const mintMessageRAW = actionToInternalMessage(bob, contractAddress, mintMessage2.message?.body);
        
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
        
        

        const transferResponse = await aliceUSDC.transfer(alice, bob, new BN(502), bob);
        console.log(transferResponse);
        
        const transferMessage = transferResponse.actions[0] as SendMsgOutAction;
        
        const msg = actionToInternalMessage(bob, contractAddress, transferMessage.message?.body);
        const bobUSDC = await JettonWallet.createFromMessage(
            transferMessage.message?.init?.code as Cell,
            transferMessage.message?.init?.data as Cell,
            msg);

        const bobUsdcData = await bobUSDC.getData();
        console.log(`bobUsdcData after transfer balance:${ bobUsdcData.balance.toString()}  owner: ${ sliceToAddress267(bobUsdcData.owner).toFriendly()}`);
        
    })

    it.only("alice adds Liquidity", async () => {
        const {
            masterUSDC,
            aliceUSDC
        } = await initEnvironment();

        let aliceData = await aliceUSDC.getData();
        console.log(`alice owner: ${sliceToAddress267(aliceData.owner).toFriendly()}`);
        
        
        let extra_data = new Cell();
        extra_data.bits.writeUint(OP_ADD_LIQUIDITY ,32);
        extra_data.bits.writeUint(new BN(5) ,32);  // slippage

        const transferResponse = await aliceUSDC.transfer(alice, bob, new BN(502),  bob, undefined, new BN(10), extra_data);
        console.log(transferResponse);
        
        const transferMessage = transferResponse.actions[0] as SendMsgOutAction;
        
        const msg = actionToInternalMessage(bob, contractAddress, transferMessage.message?.body);
        const bobUSDC = await JettonWallet.createFromMessage(
            transferMessage.message?.init?.code as Cell,
            transferMessage.message?.init?.data as Cell,
            msg);

        const bobUsdcData = await bobUSDC.getData();
        console.log(`bobUsdcData after transfer balance:${ bobUsdcData.balance.toString()}  owner: ${ sliceToAddress267(bobUsdcData.owner).toFriendly()}`);
        
    })


});


async function initEnvironment() {
    const masterUSDC = await JettonMinter.create(new BN(0), alice, "https://ipfs.io/ipfs/dasadas");
    const mintResponse = await masterUSDC.mint(alice, alice, new BN(1500));
    const mintMessage = mintResponse.actions[0] as SendMsgOutAction;
    //send the transfer message to the contract
    const initTransferMessage = actionToInternalMessage(bob, aliceSubwallet, mintMessage.message?.body);
    // Deploy USDC Sub wallet based on the output action from the mint result, 
    // so we take the output message and initiate a contract based on the code data and init state and save reference to it
    let aliceUSDC = await JettonWallet.createFromMessage(mintMessage.message?.init?.code as Cell, mintMessage.message?.init?.data as Cell, initTransferMessage);

    return {
        masterUSDC,
        aliceUSDC
    }
} 



function actionToInternalMessage(to: Address, from:Address, messageBody: Cell, messageValue = new BN(1000000000), bounce = false) {
    let msg = new CommonMessageInfo( { body: new CellMessage(messageBody) });
    return new InternalMessage({
        to,
        from,
        value: messageValue,
        bounce,
        body: msg
    })
}