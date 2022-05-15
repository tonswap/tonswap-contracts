//https://github.com/tonwhales/ton-nft/blob/main/packages/utils/parseActionsList.ts
import BN from "bn.js";
import { Address, Cell, RawCurrencyCollection, RawMessage, Slice } from "ton";
import { readCurrencyCollection, readMessage } from "./messageUtils";
// @ts-ignore
import { ExecutionResult } from "ton-contract-executor";

// out_list_empty$_ = OutList 0;
// out_list$_ {n:#} prev:^(OutList n) action:OutAction
//     = OutList (n + 1);
// action_send_msg#0ec3c86d mode:(## 8)
// out_msg:^(MessageRelaxed Any) = OutAction;
// action_set_code#ad4de08e new_code:^Cell = OutAction;
// action_reserve_currency#36e6b809 mode:(## 8)
// currency:CurrencyCollection = OutAction;
// libref_hash$0 lib_hash:bits256 = LibRef;
// libref_ref$1 library:^Cell = LibRef;
// action_change_library#26fa1dd4 mode:(## 7) { mode <= 2 }
// libref:LibRef = OutAction;
//
// out_list_node$_ prev:^Cell action:OutAction = OutListNode;

export type SendMsgOutAction = { type: "send_msg"; message: RawMessage; mode: number };
export type ReserveCurrencyAction = {
    type: "reserve_currency";
    mode: number;
    currency: RawCurrencyCollection;
};
export type UnknownOutAction = { type: "unknown" };
const decimals = new BN("1000000000");
const decimals18 = new BN("1000000000000000000");

export type OutAction = SendMsgOutAction | ReserveCurrencyAction | UnknownOutAction;

export function parseActionsList(actions: Slice | Cell): OutAction[] {
    let list: any[] = [];

    let ref: Slice;

    let outAction: OutAction;

    let slice;
    if (actions instanceof Cell) {
        slice = Slice.fromCell(actions);
    } else {
        slice = actions;
    }

    try {
        ref = slice.readRef();
    } catch (e) {
        return list;
    }

    let magic = slice.readUint(32).toNumber();
    if (magic === 0x0ec3c86d) {
        outAction = {
            type: "send_msg",
            mode: slice.readUint(8).toNumber(),
            message: readMessage(slice.readRef()),
        };
    } else if (magic === 0x36e6b809) {
        outAction = {
            type: "reserve_currency",
            mode: slice.readUint(8).toNumber(),
            currency: readCurrencyCollection(slice),
        };
    } else {
        outAction = { type: "unknown" };
    }

    list.push(outAction);
    list.push(...parseActionsList(ref));
    return list;
}

export function parseTrc20Transfer(msgBody: Cell) {
    let slice = msgBody.beginParse();
    var op = slice.readUint(32);
    var query = slice.readUint(64);
    var to = sliceToAddress(slice);

    var grams = slice.readCoins();
    console.log("parseTrc20Transfer amount", grams.toString(10));
    console.log("parseTrc20Transfer", to);
    return {
        op: op.toString(10),
        query: query.toString(10),
        to: to,
        amount: grams,
        // amount: fees
    };
}

export function parseTrc20TransferRecipt(msgBody: Cell) {
    let slice = msgBody.beginParse();
    var op = slice.readUint(32);
    var query = slice.readUint(64);
    var to = sliceToAddress(slice);

    var grams = slice.readCoins();
    console.log("parseTrc20Transfer amount", grams.toString(10));
    console.log("parseTrc20Transfer", to);
    return {
        op: op.toString(10),
        query: query.toString(10),
        to: to,
        amount: grams,
        // amount: fees
    };
}

export function parseJettonTransfer(msg: Cell) {
    // refs[0] is stateInit

    let slice = msg.refs[0].beginParse();

    //let slice = msg.beginParse();

    var op = slice.readUint(32);
    var query = slice.readUint(64);
    var amount = slice.readCoins();
    var to = slice.readAddress();
    var to2 = slice.readAddress();

    return {
        op: op.toString(10),
        query: query.toString(10),
        to,
        amount,
        // amount: fees
    };
}

export function toUnixTime(timeInMS: number) {
    return Math.round(timeInMS / 1000);
}

export function sliceToString(s: Slice) {
    let data = s.readRemaining();
    return data.buffer.slice(0, Math.ceil(data.cursor / 8)).toString();
}

export function cellToString(s: Cell) {
    let data = s.beginParse().readRemaining();
    return data.buffer.slice(0, Math.ceil(data.cursor / 8)).toString();
}

export function base64StrToCell(str: string): Cell[] {
    let buf = Buffer.from(str, "base64");
    return Cell.fromBoc(buf);
}

export function addressToSlice264(a: Address) {
    let c = new Cell();
    c.bits.writeAddress(a);
    const s = c.beginParse();
    const _anyCast = s.readUint(3);
    const addr = s.readUint(264);
    return addr;
}

export function sliceToAddress267(s: Slice) {
    const _anyCast = new BN(s.readUint(3)); //ignore anycast bits
    return sliceToAddress(s);
}

export function sliceToAddress(s: Slice, isAnyCastAddress = false) {
    if (isAnyCastAddress) {
        s.skip(3);
    }
    const wc = new BN(s.readUint(8));
    const addr = s.readUint(256);
    const address = new Address(wc.toNumber(), addr.toBuffer());
    return address;
}

export function toDecimals(num: number | string) {
    return new BN(num).mul(decimals);
}

export function fromDecimals(num: BN) {
    const numStr = num.toString();
    const dotIndex = numStr.length - 9;
    const formmatedStr = numStr.substring(0, dotIndex) + "." + numStr.substring(dotIndex, numStr.length);
    return formmatedStr;
}

export function fmt18(num: number | string) {
    return new BN(num).mul(decimals18);
}

export function unFmt18(num: BN) {
    return new BN(num).div(decimals18);
}

export function stripBoc(bocStr: string) {
    //console.log(`parsing boc ${bocStr}`);
    return bocStr.substr(2, bocStr.length - 4);
}

export function parseInternalMessageResponse(result: ExecutionResult) {
    // @ts-ignore
    let res = result as SuccessfulExecutionResult;
    //console.log(res);
    return {
        exit_code: res.exit_code,
        returnValue: res.result[1] as BN,
        logs: filterLogs(res.logs),
        actions: parseActionsList(res.action_list_cell),
    };
}

export function filterLogs(logs: string) {
    const arr = logs.split("\n");
    //    console.log(arr.length);

    let filtered = arr.filter((it) => {
        return it.indexOf("#DEBUG#") !== -1 || it.indexOf("error") !== -1;
    });
    const beautified = filtered.map((it, i) => {
        const tabIndex = it.indexOf("\t");
        return `${i + 1}. ${it.substring(tabIndex + 1, it.length)}`;
    });

    return beautified;
}
