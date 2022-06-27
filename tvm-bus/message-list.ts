import { Address, fromNano } from "ton";

var data = [
    {
        time: "2022-06-26T07:59:55.052Z",
        from: Address.parse("EQCG-Qj2cpnPsGR-nkRokEgHdzblUlug1MH2twgpRJf5DUOI"),
        inMessage: {
            value: 0,
            body: "x{595F07BC00000000000000015A4A2D938028010DF211ECE5339F60C8FD3C88D120900EEE6DCAA4B741A983ED6E1052892FF21B_}",
            stateInit: "",
            mode: -1,
        },
        contractImpl: {
            name: "x",
            initTime: 1656230395,
            contract: {},
            address: Address.parse("EQDFFzPdq9EPc9Y-aAWZtST0UyVKqPWKDgJ1i_7P9m1NKKR1"),
            initMessageResultRaw: [Object],
        },
        contractAddress: Address.parse("EQDFFzPdq9EPc9Y-aAWZtST0UyVKqPWKDgJ1i_7P9m1NKKR1"),
        exit_code: 0,
        returnValue: undefined,
        logs: [],
        actions: [[Object]],
        isDeployedByAction: false,
    },
    {
        time: "2022-06-26T07:59:55.066Z",
        from: Address.parse("EQDFFzPdq9EPc9Y-aAWZtST0UyVKqPWKDgJ1i_7P9m1NKKR1"),
        inMessage: {
            value: 0,
            body: "x{7BDD97DE00000000000000015A4A2D938028010DF211ECE5339F60C8FD3C88D120900EEE6DCAA4B741A983ED6E1052892FF21B0021BE423D9CA673EC191FA7911A241201DDCDB95496E835307DADC20A5125FE436_}",
            stateInit: "",
            mode: -1,
        },
        contractImpl: {
            name: "x",
            contract: {},
            address: Address.parse("EQBiEB1OVWd6Ovf2JTALSfRpzShtbQbgth-vBeYV9kxvhwcN"),
        },
        contractAddress: Address.parse("EQBiEB1OVWd6Ovf2JTALSfRpzShtbQbgth-vBeYV9kxvhwcN"),
        exit_code: 0,
        returnValue: undefined,
        logs: [],
        actions: [[Object], [Object]],
        isDeployedByAction: false,
    },
    {
        time: "2022-06-26T07:59:55.079Z",
        from: Address.parse("EQBiEB1OVWd6Ovf2JTALSfRpzShtbQbgth-vBeYV9kxvhwcN"),
        inMessage: {
            value: 100000,
            body: "x{0F8A7EA500000000000000015E8D4A510008010DF211ECE5339F60C8FD3C88D120900EEE6DCAA4B741A983ED6E1052892FF21B0021BE423D9CA673EC191FA7911A241201DDCDB95496E835307DADC20A5125FE4341_}",
            stateInit: "",
            mode: -1,
        },
        contractImpl: {
            name: "x",
            initMessageResult: [Object],
            contract: {},
            initMessageResultRaw: [Object],
            address: Address.parse("EQDUKO8nIPHWO6IJhYqh1gpGkExQr1c6K1nW6QE7YhtZoWba"),
        },
        contractAddress: Address.parse("EQDUKO8nIPHWO6IJhYqh1gpGkExQr1c6K1nW6QE7YhtZoWba"),
        exit_code: 0,
        returnValue: undefined,
        logs: [],
        actions: [[Object]],
        isDeployedByAction: false,
    },
    {
        time: "2022-06-26T07:59:55.093Z",
        from: Address.parse("EQDUKO8nIPHWO6IJhYqh1gpGkExQr1c6K1nW6QE7YhtZoWba"),
        inMessage: {
            value: 0xbebc200,
            body: "x{178D451900000000000000015E8D4A51000800C4203A9CAACEF475EFEC4A601693E8D39A50DADA0DC16C3F5E0BCC2BEC98DF0F0021BE423D9CA673EC191FA7911A241201DDCDB95496E835307DADC20A5125FE4342_}",
            stateInit: "",
            mode: -1,
        },
        contractImpl: {
            name: "x",
            initMessageResult: [Object],
            contract: {},
            initMessageResultRaw: [Object],
            address: Address.parse("EQC-pxTsYn8fEf_FeioTHYgIAQmWSaHXo-i8XJg-4MirVN4j"),
        },
        contractAddress: Address.parse("EQC-pxTsYn8fEf_FeioTHYgIAQmWSaHXo-i8XJg-4MirVN4j"),
        exit_code: 0,
        returnValue: undefined,
        logs: [],
        actions: [[Object], [Object]],
        isDeployedByAction: false,
    },
    {
        time: "2022-06-26T07:59:55.096Z",
        from: Address.parse("EQC-pxTsYn8fEf_FeioTHYgIAQmWSaHXo-i8XJg-4MirVN4j"),
        inMessage: {
            value: 0xb532b80,
            body: "x{D53276DB0000000000000001}",
            stateInit: "",
            mode: -1,
        },
        contractImpl: {
            name: "x",
            contract: {},
            address: Address.parse("EQCG-Qj2cpnPsGR-nkRokEgHdzblUlug1MH2twgpRJf5DUOI"),
        },
        contractAddress: Address.parse("EQCG-Qj2cpnPsGR-nkRokEgHdzblUlug1MH2twgpRJf5DUOI"),
        exit_code: 0,
        returnValue: 0xb532b80,
        logs: [],
        actions: [],
        isDeployedByAction: false,
    },
    {
        time: "2022-06-26T07:59:55.097Z",
        from: Address.parse("EQBiEB1OVWd6Ovf2JTALSfRpzShtbQbgth-vBeYV9kxvhwcN"),
        inMessage: { value: 0, body: "x{}", stateInit: "", mode: -1 },
        contractImpl: {
            name: "x",
            contract: {},
            address: Address.parse("EQCG-Qj2cpnPsGR-nkRokEgHdzblUlug1MH2twgpRJf5DUOI"),
        },
        contractAddress: Address.parse("EQCG-Qj2cpnPsGR-nkRokEgHdzblUlug1MH2twgpRJf5DUOI"),
        exit_code: 0,
        returnValue: 0xbebc200,
        logs: [],
        actions: [],
        isDeployedByAction: false,
    },
];

interface StringArray {
    [index: string]: any;
}

function enrich(data: any) {
    const enriched = data.map((it: any, i: number) => {
        // it.from = it.from;
        // it.contractAddress = it.contractAddress;
        it.index = i;
        if (i == 0) {
            return it;
        }
        it.prev = data[i - 1];
        it.sender = findNearestSender(data, i, it.from);

        if (it.sender) {
            // throw "no sender";
        } else {
            console.log(`couldn't found sender ${it.from.toFriendly()}`);

            // throw "sender not found"
        }
        return it;
    });

    return enriched;
}

function findNearestSender(data: any, index: number, address: Address) {
    for (let i = index; i >= 0; i--) {
        if (data[i].contractAddress?.toFriendly() == address.toFriendly()) {
            return data[i];
        }
    }
    throw "not found";

    return null;
}

function dataToTree(data: any) {
    let result: StringArray = {};
    data.forEach((it: object, i: number) => {
        //genesis
        if (i == 0) {
            //@ts-ignore
            it.index = 0;
            return (result["0"] = it);
        }

        // previous message is the sender
        // @ts-ignore
        if (it.prev.contractAddress == it.from) {
            //@ts-ignore
            const key = `${it.from.toFriendly()}-${it.prev.index}`;
            result[key] = result[key] || [];
            result[key].push(it);
        } else {
            // @ts-ignore
            if (!it.sender) {
                //  console.log(i, it);
            }
            // @ts-ignore
            const key = `${it.sender.contractAddress.toFriendly()}-${it.sender.index}`;
            result[key] = result[key] || [];
            result[key].push(it);
        }
        // @ts-ignore
        // console.log(i, "it.prev.prev.contractAddress", it.prev.prev?.contractAddress);
    });
    return result;
}

// tree
// key address-Index

function treeToChains(data: StringArray) {
    let chains: StringArray = {};

    for (let key in data) {
        // genesis message
        if (key == "0") {
            chains["0"] = [data[key]];
            continue;
        }
        let arr = data[key];
        for (let j = 0; j < arr.length; j++) {
            const message = arr[j];

            const senderKey = messageToKey(message.sender); // go to previous message and extract key to find chains tail
            const chainKey = findChainByTail(chains, senderKey);

            if (chainKey) {
                chains[chainKey].push(message);
            } else {
                // create a new chain with key of the current message
                chains[messageToKey(message)] = [message];
            }
        }
    }
    return chains;
    //  console.log(buff
}

function findMessageSender(message: any) {
    if (message.prev.contractAddress == message.from) {
        return message.prev;
    } else {
        if (!message.prev.prev) {
            throw "raw chain messages is broken ! ";
        }
        return message.prev.prev;
    }
}

function findChainByTail(chains: StringArray, newMessageSenderKey: string) {
    for (let key in chains) {
        const chain = chains[key];

        let tailKey = messageToKey(chain[chain.length - 1]);
        // console.log(`tailKey: ${tailKey} == ${newMessageSenderKey}`);

        if (tailKey == newMessageSenderKey) {
            return key;
        }
    }
    // no chains found

    return "";
}

function messageToKey(message: any) {
    return `${message.contractAddress.toFriendly()}-${message.index}`;
}
export function printChain(data: any) {
    const richData = enrich(data);

    const result = dataToTree(richData);

    const chains = treeToChains(result);

    print(chains);
}

function print(data: any) {
    let buffer = "";

    for (let key in data) {
        buffer += `\n================\n${key} ===> \n\t`;
        let arr = data[key];

        for (let j = 0; j < arr.length; j++) {
            if (j == 0 && arr[j].sender) {
                buffer += `Origin: ${addressEllipsis(arr[j].sender.contractAddress.toFriendly())}-${arr[j].sender.index}\n`;
            }

            const coins = fromNano(arr[j].inMessage.value);
            buffer += `\n\t [${arr[j].index}] 
                ⬅️  From: ${arr[j].sender?.contractImpl?.constructor.name} ${addressEllipsis(arr[j].from)}  
                🛄  Message: ${messageOpToName(arr[j])} ( ${coins}💎 )   
                ➡️  To: ${arr[j].contractImpl?.constructor.name} ${addressEllipsis(arr[j].contractAddress)}`.padEnd(100);
        }
        buffer += `\n`;
    }
    console.log(buffer);
}

function addressEllipsis(address: string) {
    if (!address) {
        return `...`;
    }

    if (typeof address == "object") {
        // @ts-ignore
        address = address.toFriendly();
    }

    return `${address.substring(0, 6)}....${address.substring(42, 48)}`;
}

function messageOpToName(message: any) {
    const opsDict: StringArray = {
        "0x0f8a7ea5": "Transfer",
        "0x7362d09c": "Transfer_notification",
        "0x178d4519": "Internal_transfer",
        "0xd53276db": "Excesses",
        "0x595f07bc": "Burn",
        "0x7bdd97de": "Burn_notification",
        "22": "ADD_LIQUIDITY",
        "23": "REMOVE_LIQUIDITY",
        "24": "SWAP_TOKEN",
        "25": "SWAP_TON",
        "21": "MINT",
    };
    let val = `0x${message.inMessage?.body.substring(2, 10)}`.toLowerCase();
    return opsDict[val] ? opsDict[val] : "x{}";
}

//printChain(data);

// A -> B -> C
//        -> D -> F
//        -> E -> G
