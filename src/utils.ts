import BN from "bn.js";
import { Address, Cell, Slice } from "ton";
// @ts-ignore
import { ExecutionResult } from "ton-contract-executor";

const decimals = new BN("1000000000");

export function parseJettonTransfer(msg: Cell) {
    let slice = msg.beginParse();
    var op = slice.readUint(32);
    var query = slice.readUint(64);
    var amount = slice.readCoins();
    var to = slice.readAddress();

    return {
        op: op.toString(10),
        query: query.toString(10),
        to,
        amount,
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
    const formattedStr = numStr.substring(0, dotIndex) + "." + numStr.substring(dotIndex, numStr.length);
    return formattedStr;
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
        ...res,
        returnValue: res.result[1] as BN,
        logs: filterLogs(res.logs),
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

export function writeString(cell: Cell, str: string) {
    for (let i = 0; i < str.length; i++) {
        cell.bits.writeUint8(str.charCodeAt(i));
    }
}

/// Ton Web impl for bytes to base64
export function bytesToBase64(bytes: any) {
    let result = "";
    let i;
    const l = bytes.length;
    for (i = 2; i < l; i += 3) {
        result += base64abc[bytes[i - 2] >> 2];
        result += base64abc[((bytes[i - 2] & 0x03) << 4) | (bytes[i - 1] >> 4)];
        result += base64abc[((bytes[i - 1] & 0x0f) << 2) | (bytes[i] >> 6)];
        result += base64abc[bytes[i] & 0x3f];
    }
    if (i === l + 1) {
        // 1 octet missing
        result += base64abc[bytes[i - 2] >> 2];
        result += base64abc[(bytes[i - 2] & 0x03) << 4];
        result += "==";
    }
    if (i === l) {
        // 2 octets missing
        result += base64abc[bytes[i - 2] >> 2];
        result += base64abc[((bytes[i - 2] & 0x03) << 4) | (bytes[i - 1] >> 4)];
        result += base64abc[(bytes[i - 1] & 0x0f) << 2];
        result += "=";
    }
    return result;
}

const base64abc = (() => {
    const abc = [];
    const A = "A".charCodeAt(0);
    const a = "a".charCodeAt(0);
    const n = "0".charCodeAt(0);
    for (let i = 0; i < 26; ++i) {
        abc.push(String.fromCharCode(A + i));
    }
    for (let i = 0; i < 26; ++i) {
        abc.push(String.fromCharCode(a + i));
    }
    for (let i = 0; i < 10; ++i) {
        abc.push(String.fromCharCode(n + i));
    }
    abc.push("+");
    abc.push("/");
    return abc;
})();
