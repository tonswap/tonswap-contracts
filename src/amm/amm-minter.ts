import { readFile } from "fs/promises";
//@ts-ignore
import { SmartContract, SuccessfulExecutionResult } from "ton-contract-executor";
import { parseAmmResp } from "../utils";

import {
    Address,
    Cell,
    CellMessage,
    InternalMessage,
    Slice,
    CommonMessageInfo,
    ExternalMessage,
    serializeDict,
} from "ton";
import BN from "bn.js";
import {
    parseActionsList,
    sliceToAddress267,
    toUnixTime,
    sliceToString,
    addressToSlice264,
    sliceToAddress,
} from "../utils";
import { compileFuncToB64 } from "../funcToB64";
import { OPS } from "./ops";

const contractAddress = Address.parse("EQD4FPq-PRDieyQKkizFTRtSDyucUIqrj0v_zXJmqaDp6_0t");
const addressA = Address.parseFriendly("kQCLjyIQ9bF5t9h3oczEX3hPVK4tpW2Dqby0eHOH1y5_Nk1x").address;
const addressB = Address.parseFriendly("EQCbPJVt83Noxmg8Qw-Ut8HsZ1lz7lhp4k0v9mBX2BJewhpe").address;

const TRC20_TRANSFER = 0xf8a7ea5;
const SWAP_OUT_SUB_OP = 8;

const OP_MINT = 21;
const BURN_NOTIFICATION = 0x7bdd97de;
const INTERNAL_TRANSFER = 0x178d4519;

export class AmmMinter {
    private constructor(public readonly contract: SmartContract) {}

    //   ds~load_coins(), ;; total_supply
    //   ds~load_msg_addr(), ;; token_wallet_address
    //   ds~load_coins(), ;; ton_reserves
    //   ds~load_coins(), ;; token_reserves
    //   ds~load_ref(), ;; content
    //   ds~load_ref()  ;; jetton_wallet_code
    async getData() {
        let res = await this.contract.invokeGetMethod("get_jetton_data", []);

        const totalSupply = res.result[0] as BN;
        const mintable = res.result[1] as BN;
        //@ts-ignore
        const tokenAddress = sliceToAddress267(res.result[2] as BN).toFriendly();
        const tonReserves = res.result[3] as BN;
        const tokenReserves = res.result[4] as BN;
        const content = res.result[2] as Cell;
        const code = res.result[3] as Cell;

        return {
            totalSupply,
            mintable,
            tokenAddress,
            tonReserves,
            tokenReserves,
            content,
        };
    }

    async sendInternalMessage(message: InternalMessage) {
        let res = await this.contract.sendInternalMessage(message);
        return parseAmmResp(res);
    }

    async swapTon(from: Address, tonToSwap: BN, minAmountOut: BN) {
        const fee = new BN(100000000);

        let messageBody = new Cell();
        messageBody.bits.writeUint(OPS.SWAP_TON, 32); // action
        messageBody.bits.writeUint(1, 64); // query-id
        messageBody.bits.writeCoins(tonToSwap); // swapping amount of tons
        messageBody.bits.writeCoins(minAmountOut); // minimum received

        let res = await this.contract.sendInternalMessage(
            new InternalMessage({
                from,
                to: contractAddress,
                value: tonToSwap.add(fee),
                bounce: false,
                body: new CommonMessageInfo({ body: new CellMessage(messageBody) }),
            })
        );

        console.log(res);
        let successResult = res as SuccessfulExecutionResult;
        return {
            exit_code: res.exit_code,
            returnValue: res.result[1] as BN,
            logs: res.logs,
            actions: parseActionsList(successResult.action_list_cell),
        };
    }

    // burn#595f07bc query_id:uint64 amount:(VarUInteger 16)
    //           response_destination:MsgAddress custom_payload:(Maybe ^Cell)
    //           = InternalMsgBody;
    async receiveBurn(subwalletOwner: Address, sourceWallet: Address, amount: BN) {
        let messageBody = new Cell();
        messageBody.bits.writeUint(OPS.Burn_notification, 32); // action
        messageBody.bits.writeUint(1, 64); // query-id
        messageBody.bits.writeCoins(amount); // jetton amount received
        messageBody.bits.writeAddress(sourceWallet);

        const removeLiquidityAmount = 300000;
        let customPayload = new Cell();
        customPayload.bits.writeUint(2, 32); // sub op for removing liquidty
        customPayload.bits.writeCoins(removeLiquidityAmount); // sub op for removing liquidty

        messageBody.refs.push(customPayload);

        let res = await this.contract.sendInternalMessage(
            new InternalMessage({
                from: subwalletOwner,
                to: contractAddress,
                value: new BN(10000),
                bounce: false,
                body: new CommonMessageInfo({ body: new CellMessage(messageBody) }),
            })
        );

        let successResult = res as SuccessfulExecutionResult;
        //console.log(res);
        return {
            exit_code: res.exit_code,
            returnValue: res.result[1] as BN,
            logs: res.logs,
            actions: parseActionsList(successResult.action_list_cell),
        };
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
        let data = await this.contract.invokeGetMethod("get_jetton_data", []);
        const rawAddress = data.result[2] as Slice;

        // const admin = new Address(0, new BN(rawAddress).toBuffer() );
        return {
            totalSupply: data.result[0] as BN,
            mintable: data.result[1] as BN,
            adminAddress: sliceToAddress(rawAddress, true),
            content: data.result[3],
            jettonWalletCode: data.result[4],
        };
    }

    setUnixTime(time: number) {
        this.contract.setUnixTime(time);
    }

    static async create(
        tokenAdmin: Address,
        content: string,
        rewardsWallet: Address,
        rewardsRate: BN,
        protocolRewardsWallet: Address,
        protocolRewardsRate: BN = new BN(0)
    ) {
        let msgHexComment = (await readFile("./src/amm/msg_hex_comment.func")).toString("utf-8");
        let jettonAMM = (await readFile("./src/amm/amm-minter-utils.func")).toString("utf-8");
        let jettonMinter = (await readFile("./src/amm/amm-minter.func")).toString("utf-8");
        let utils = (await readFile("./src/amm/amm-utils.func")).toString("utf-8");
        let opcodes = (await readFile("./src/amm/op-codes.func")).toString("utf-8");
        let params = (await readFile("./src/amm/params.func")).toString("utf-8");
        let stdlib = (await readFile("./src/amm/stdlib.func")).toString("utf-8");

        //based on tonweb example
        //const code = Cell.fromBoc("B5EE9C7241021101000319000114FF00F4A413F4BCF2C80B0102016202030202CC0405001BA0F605DA89A1F401F481F481A8610201D40607020148080900BB0831C02497C138007434C0C05C6C2544D7C0FC02F83E903E900C7E800C5C75C87E800C7E800C00B4C7E08403E29FA954882EA54C4D167C0238208405E3514654882EA58C4CD00CFC02780D60841657C1EF2EA4D67C02B817C12103FCBC2000113E910C1C2EBCB853600201200A0B0201200F1001F500F4CFFE803E90087C007B51343E803E903E90350C144DA8548AB1C17CB8B04A30BFFCB8B0950D109C150804D50500F214013E809633C58073C5B33248B232C044BD003D0032C032483E401C1D3232C0B281F2FFF274013E903D010C7E801DE0063232C1540233C59C3E8085F2DAC4F3208405E351467232C7C6600C02F13B51343E803E903E90350C01F4CFFE80145468017E903E9014D6B1C1551CDB1C150804D50500F214013E809633C58073C5B33248B232C044BD003D0032C0327E401C1D3232C0B281F2FFF274140331C146EC7CB8B0C27E8020822625A020822625A02806A8486544124E17C138C34975C2C070C00930802C200D0E008ECB3F5007FA0222CF165006CF1625FA025003CF16C95005CC07AA0013A08208989680AA008208989680A0A014BCF2E2C504C98040FB001023C85004FA0258CF1601CF16CCC9ED54006C5219A018A182107362D09CC8CB1F5240CB3F5003FA0201CF165007CF16C9718018C8CB0525CF165007FA0216CB6A15CCC971FB00103400828E2A820898968072FB028210D53276DB708010C8CB055008CF165005FA0216CB6A13CB1F13CB3FC972FB0058926C33E25502C85004FA0258CF1601CF16CCC9ED5400DB3B51343E803E903E90350C01F4CFFE803E900C145468549271C17CB8B049F0BFFCB8B0A0822625A02A8005A805AF3CB8B0E0841EF765F7B232C7C572CFD400FE8088B3C58073C5B25C60043232C14933C59C3E80B2DAB33260103EC01004F214013E809633C58073C5B3327B55200083200835C87B51343E803E903E90350C0134C7E08405E3514654882EA0841EF765F784EE84AC7CB8B174CFCC7E800C04E81408F214013E809633C58073C5B3327B55204F664B79");

        // custom solution, using func to compile, and fift to serialize the code into a string
        const ammWalletCodeB64: string = compileFuncToB64([
            "src/amm/stdlib-jetton-wallet.func",
            "src/amm/op-codes.func",
            "src/amm/params.func",
            "src/amm/amm-utils.func",
            "src/amm/amm-wallet.func",
            "src/amm/msg_hex_comment.func",
        ]);
        const ammWalletCode = Cell.fromBoc(ammWalletCodeB64);

        const data = await buildCell(
            tokenAdmin,
            content,
            ammWalletCode[0],
            rewardsWallet,
            rewardsRate,
            protocolRewardsWallet,
            protocolRewardsRate
        );

        const combinedCode = [
            stdlib,
            opcodes,
            params,
            utils,
            jettonAMM,
            jettonMinter,
            msgHexComment,
        ].join("\n");
        let contract = await SmartContract.fromFuncSource(combinedCode, data, {
            getMethodsMutate: true,
        });
        const instance = new AmmMinter(contract);

        instance.setUnixTime(toUnixTime(Date.now()));
        return instance;
    }
}

async function buildCell(
    token_wallet_address: Address,
    content: string,
    tokenCode: Cell,
    rewardsWallet: Address,
    rewardsRate: BN,
    protocolRewardsWallet: Address,
    protocolRewardsRate: BN
) {
    //   ds~load_coins(), ;; total_supply
    //   ds~load_msg_addr(), ;; token_wallet_address
    //   ds~load_coins(), ;; ton_reserves
    //   ds~load_coins(), ;; token_reserves
    //   ds~load_ref(), ;; content
    //   ds~load_ref()  ;; jetton_wallet_code

    const contentCell = new Cell();
    contentCell.bits.writeString(content);

    const adminData = new Cell();
    adminData.bits.writeAddress(rewardsWallet);
    adminData.bits.writeUint(rewardsRate, 64);
    adminData.bits.writeAddress(protocolRewardsWallet);
    adminData.bits.writeUint(protocolRewardsRate, 64);

    const dataCell = new Cell();
    dataCell.bits.writeCoins(0);
    dataCell.bits.writeAddress(token_wallet_address);
    dataCell.bits.writeCoins(0);
    dataCell.bits.writeCoins(0);
    dataCell.refs.push(contentCell);
    dataCell.refs.push(tokenCode);
    dataCell.refs.push(adminData);
    return dataCell;
}
