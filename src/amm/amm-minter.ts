import { readFile } from "fs/promises";
//@ts-ignore
import { cellToBoc, SmartContract, SuccessfulExecutionResult } from "ton-contract-executor";
import { filterLogs, parseInternalMessageResponse, sliceToAddress } from "../utils";
import { AmmLpWallet } from "./amm-wallet";

import { Address, Cell, CellMessage, InternalMessage, Slice, CommonMessageInfo, TonClient, fromNano } from "ton";
import BN from "bn.js";
import { parseActionsList, sliceToAddress267, toUnixTime } from "../utils";
import { OPS } from "./ops";
import { compileFuncToB64 } from "../funcToB64";
import { bytesToAddress } from "../deploy/deploy-utils";
import { bytesToBase64 } from "../jetton/jetton-minter";
import { writeString } from "../messageUtils";

const contractAddress = Address.parse("EQD4FPq-PRDieyQKkizFTRtSDyucUIqrj0v_zXJmqaDp6_0t");

export class AmmMinter {
    private constructor(public readonly contract: SmartContract) {}

    async getData() {
        let res = await this.contract.invokeGetMethod("get_jetton_data", []);

        const totalSupply = res.result[0] as BN;
        const mintable = res.result[1] as BN;
        //@ts-ignore
        const tokenWalletAddress = sliceToAddress267(res.result[2] as BN).toFriendly();
        const tonReserves = res.result[3] as BN;
        const tokenReserves = res.result[4] as BN;
        const content = res.result[2] as Cell;
        const code = res.result[3] as Cell;

        return {
            totalSupply,
            mintable,
            tokenWalletAddress,
            tonReserves,
            tokenReserves,
            content,
        };
    }

    async sendInternalMessage(message: InternalMessage) {
        let res = await this.contract.sendInternalMessage(message);
        return parseInternalMessageResponse(res);
    }

    async swapTon(from: Address, tonToSwap: BN, minAmountOut: BN) {
        const fee = new BN(100000000);

        let messageBody = AmmMinter.SwapTon(tonToSwap, minAmountOut);

        let res = await this.contract.sendInternalMessage(
            new InternalMessage({
                from,
                to: contractAddress,
                value: tonToSwap.add(fee),
                bounce: false,
                body: new CommonMessageInfo({ body: new CellMessage(messageBody) }),
            })
        );

        let successResult = res as SuccessfulExecutionResult;
        return {
            exit_code: res.exit_code,
            returnValue: res.result[1] as BN,
            logs: filterLogs(res.logs),
            actions: parseActionsList(successResult.action_list_cell),
        };
    }

    static SwapTon(tonToSwap: BN, minAmountOut: BN): Cell {
        console.log(`SwapTon tonToSwap:${fromNano(tonToSwap).toString()} minAmountOut:${fromNano(minAmountOut).toString()}`);
        let cell = new Cell();
        cell.bits.writeUint(OPS.SWAP_TON, 32); // action
        cell.bits.writeUint(1, 64); // query-id
        cell.bits.writeCoins(tonToSwap); // swapping amount of tons
        cell.bits.writeCoins(minAmountOut); // minimum received
        return cell;
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
        return {
            exit_code: res.exit_code,
            returnValue: res.result[1] as BN,
            logs: res.logs,
            actions: parseActionsList(successResult.action_list_cell),
        };
    }

    async rewardsOf(lpAmount: BN, secondsStaked: BN) {
        let data = await this.contract.invokeGetMethod("get_rewards_by", [
            { type: "int", value: lpAmount.toString() },
            { type: "int", value: secondsStaked.toString() },
        ]);

        const tokenRewards = data.result[0] as Slice;
        const protocolRewards = data.result[1] as Slice;

        // const admin = new Address(0, new BN(rawAddress).toBuffer() );
        return {
            tokenRewards,
            protocolRewards,
            logs: data.logs,
        };
    }

    async getAmountOut(amountIn: BN, reserveIn: BN, reserveOut: BN) {
        let res = await this.contract.invokeGetMethod("get_amount_out", [
            { type: "int", value: amountIn.toString() },
            { type: "int", value: reserveIn.toString() },
            { type: "int", value: reserveOut.toString() },
        ]);

        const minAmountOut = res.result[0] as BN;
        return {
            minAmountOut,
        };
    }
    static async GetWalletAddress(client: TonClient, minterAddress: Address, walletAddress: Address) {
        try {
            let cell = new Cell();
            cell.bits.writeAddress(walletAddress);

            // tonweb style
            const b64data = bytesToBase64(await cell.toBoc({ idx: false }));
            // nodejs buffer
            let b64dataBuffer = (await cell.toBoc({ idx: false })).toString("base64");

            // console.log("bytesToBase64", b64data);
            // console.log("b64dataBuffer", b64dataBuffer);

            let res = await client.callGetMethod(minterAddress, "get_wallet_address", [["tvm.Slice", b64dataBuffer]]);

            console.log(res);

            return bytesToAddress(res.stack[0][1].bytes);
        } catch (e) {
            console.log("exception", e);
        }
    }

    static async GetAmountOut(client: TonClient, minterAddress: Address, amountIn: BN, reserveIn: BN, reserveOut: BN) {
        let res = await client.callGetMethod(minterAddress, "get_amount_out", [
            ["num", amountIn.toString()],
            ["num", reserveIn.toString()],
            ["num", reserveOut.toString()],
        ]);
        return {
            minAmountOut: BigInt(res.stack[0][1]),
        };
    }
    static async GetJettonData(client: TonClient, minterAddress: Address) {
        // console.log(`GetJettonData ${minterAddress.toFriendly()}`);
        let res = await client.callGetMethod(minterAddress, "get_jetton_data", []);

        const totalSupply = res.stack[0][1] as string;
        const mintable = res.stack[1][1] as string;
        const jettonWalletAddressBytes = res.stack[2][1].bytes as string;
        const tonReserves = res.stack[3][1] as string;
        const tokenReserves = res.stack[4][1] as string;
        return {
            totalSupply,
            jettonWalletAddress: bytesToAddress(jettonWalletAddressBytes),
            mintable,
            tonReserves,
            tokenReserves,
        };
    }

    setUnixTime(time: number) {
        this.contract.setUnixTime(time);
    }

    static async CompileCodeToCell() {
        const ammMinterCodeB64: string = compileFuncToB64([
            "src/amm/stdlib.fc", // this is the full stdlib (fromFuncCode injects stdlib automatically)
            "src/amm/op-codes.func",
            "src/amm/params.func",
            "src/amm/amm-utils.func",
            "src/amm/amm-minter-utils.func",
            "src/amm/amm-minter.func",
        ]);
        return Cell.fromBoc(ammMinterCodeB64);
    }

    static async buildDataCell(
        content: string,
        rewardsWallet: Address,
        rewardsRate: BN,
        protocolRewardsWallet: Address,
        protocolRewardsRate: BN
    ) {
        const contentCell = new Cell();
        writeString(contentCell, content);

        const adminData = new Cell();
        adminData.bits.writeAddress(rewardsWallet);
        adminData.bits.writeUint(rewardsRate, 64);
        adminData.bits.writeAddress(protocolRewardsWallet);
        adminData.bits.writeUint(protocolRewardsRate, 64);

        const dataCell = new Cell();
        dataCell.bits.writeCoins(0); // total-supply
        dataCell.bits.writeAddress(zeroAddress()); // token_wallet_address starts as null
        dataCell.bits.writeCoins(0); // ton-reserves
        dataCell.bits.writeCoins(0); // token-reserves
        dataCell.refs.push(contentCell);
        dataCell.refs.push((await AmmLpWallet.compileWallet())[0]);
        dataCell.refs.push(adminData);
        return {
            initDataCell: dataCell,
            codeCell: await AmmMinter.CompileCodeToCell(),
        };
    }

    // this method is using codeCell instead of .fromFuncSource
    static async create2(
        content: string,
        rewardsWallet: Address,
        rewardsRate: BN,
        protocolRewardsWallet: Address,
        protocolRewardsRate: BN = new BN(0)
    ) {
        const data = await AmmMinter.buildDataCell(content, rewardsWallet, rewardsRate, protocolRewardsWallet, protocolRewardsRate);

        const code = await AmmMinter.CompileCodeToCell();

        let contract = await SmartContract.fromCell(code[0], data.initDataCell, {
            getMethodsMutate: true,
            debug: true,
        });
        const instance = new AmmMinter(contract);

        instance.setUnixTime(toUnixTime(Date.now()));
        return instance;
    }
}

// Null Address EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c
function zeroAddress() {
    let cell = new Cell();
    cell.bits.writeUint(2, 2);
    cell.bits.writeUint(0, 1);
    cell.bits.writeUint(0, 8);
    cell.bits.writeUint(0x0000000000000000, 256);

    return cell.beginParse().readAddress();
}
