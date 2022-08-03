import { fromNano } from "ton";

const data = [
    {
        time: "2022-06-02T17:33:45.484Z",
        from: "EQCG-Qj2cpnPsGR-nkRokEgHdzblUlug1MH2twgpRJf5DUOI",
        inMessage: {
            body: "x{0F8A7EA500000000000000015E8D4A51000800295A7213B7EF887BA390A4BFF42F0ACE16850E2D0B937D6B36B999993421061D00052B4E4276FDF10F74721497FE85E159C2D0A1C5A1726FAD66D73333268420C38ABA43B74000000000160000000555D21DBA000}",
            stateInit: "",
            mode: -1,
        },

        contractAddress: "EQBz0LEPh_220w7OOmPF6YkxC4nISw2H75vytbXpP-68oKZr",
        exit_code: 0,
        returnValue: undefined,
        logs: [],
        isDeployedByAction: false,
    },
    {
        time: "2022-06-02T17:33:45.498Z",
        from: "EQBz0LEPh_220w7OOmPF6YkxC4nISw2H75vytbXpP-68oKZr",
        inMessage: {
            body: "x{178D451900000000000000015E8D4A510008010DF211ECE5339F60C8FD3C88D120900EEE6DCAA4B741A983ED6E1052892FF21B00052B4E4276FDF10F74721497FE85E159C2D0A1C5A1726FAD66D73333268420C39574876E80000000002C0000000AABA43B74001_}",
            stateInit: "",
            mode: -1,
        },

        contractAddress: "EQBSUVChetZry2tY4dOHi2tHmkLfOMoEiAEIf8gJ975JXi9f",
        exit_code: 0,
        returnValue: undefined,
        logs: [],
        isDeployedByAction: false,
    },
    {
        time: "2022-06-02T17:33:45.514Z",
        from: "EQBSUVChetZry2tY4dOHi2tHmkLfOMoEiAEIf8gJ975JXi9f",
        inMessage: {
            body: "x{7362D09C00000000000000015E8D4A510008010DF211ECE5339F60C8FD3C88D120900EEE6DCAA4B741A983ED6E1052892FF21A000000160000000555D21DBA000}",
            stateInit: "",
            mode: -1,
        },
        contractAddress: "EQAUrTkJ2_fEPdHIUl_6F4VnC0KHFoXJvrWbXMzMmhCDDvIE",
        returnValue: undefined,
        logs: ["1. #DEBUG#: s0 = 1000000000000", "2. #DEBUG#: s0 = 1"],
        isDeployedByAction: false,
    },
    {
        time: "2022-06-02T17:33:45.516Z",
        from: "EQAUrTkJ2_fEPdHIUl_6F4VnC0KHFoXJvrWbXMzMmhCDDvIE",
        contractAddress: "EQCG-Qj2cpnPsGR-nkRokEgHdzblUlug1MH2twgpRJf5DUOI",
        logs: [],
        isDeployedByAction: false,
    },
    {
        time: "2022-06-02T17:33:45.530Z",
        from: "EQAUrTkJ2_fEPdHIUl_6F4VnC0KHFoXJvrWbXMzMmhCDDvIE",
        inMessage: {
            body: "x{0F8A7EA500000000000000015E8D4A510008010DF211ECE5339F60C8FD3C88D120900EEE6DCAA4B741A983ED6E1052892FF21B0021BE423D9CA673EC191FA7911A241201DDCDB95496E835307DADC20A5125FE4341_}",
            stateInit: "",
            mode: -1,
        },

        contractAddress: "EQBSUVChetZry2tY4dOHi2tHmkLfOMoEiAEIf8gJ975JXi9f",
        exit_code: 0,
        returnValue: undefined,
        logs: [],
        isDeployedByAction: false,
    },
    {
        time: "2022-06-02T17:33:45.544Z",
        from: "EQBSUVChetZry2tY4dOHi2tHmkLfOMoEiAEIf8gJ975JXi9f",
        inMessage: {
            body: "x{178D451900000000000000015E8D4A51000800295A7213B7EF887BA390A4BFF42F0ACE16850E2D0B937D6B36B999993421061D0021BE423D9CA673EC191FA7911A241201DDCDB95496E835307DADC20A5125FE4342_}",
            stateInit: "",
            mode: -1,
        },

        contractAddress: "EQBz0LEPh_220w7OOmPF6YkxC4nISw2H75vytbXpP-68oKZr",
        exit_code: 0,
        returnValue: undefined,
        logs: [],
        isDeployedByAction: false,
    },
    {
        time: "2022-06-02T17:33:45.546Z",
        from: "EQBz0LEPh_220w7OOmPF6YkxC4nISw2H75vytbXpP-68oKZr",
        inMessage: {
            body: "x{D53276DB0000000000000001}",
            stateInit: "",
            mode: -1,
        },
        contractAddress: "EQCG-Qj2cpnPsGR-nkRokEgHdzblUlug1MH2twgpRJf5DUOI",
        logs: [],
        isDeployedByAction: false,
    },
];

interface StringArray {
    [index: string]: any;
}

function enrich(data: any) {
    const enriched = data.map((it: any, i: number) => {
        it.from = it.from.toFriendly();
        it.contractAddress = it.contractAddress.toFriendly();
        it.index = i;
        if (i == 0) {
            return it;
        }
        it.prev = data[i - 1];
        return it;
    });

    return enriched;
}

function dataToTree(data: any) {
    let result: StringArray = {};
    data.forEach((it: object, i: number) => {
        if (i == 0) {
            //@ts-ignore
            it.index = 0;
            return (result["0"] = it);
        }
        //console.log(it);

        // @ts-ignore
        if (it.prev.contractAddress == it.from) {
            //@ts-ignore
            const key = `${it.from}-${it.prev.index}`;
            result[key] = result[key] || [];
            result[key].push(it);

            // @ts-ignore
        } else if (it.prev.prev?.contractAddress == it.from) {
            // @ts-ignore
            const key = `${it.from}-${it.prev.prev.index}`;
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
            //console.log(message);
            
            const senderKey = messageToKey(findMessageSender(message)); // go to previous message and extract key to find chains tail
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
        //console.log(chain);

        let tailKey = messageToKey(chain[chain.length - 1]);
        if (tailKey == newMessageSenderKey) {
            return key;
        }
    }
    // no chains found
    return "";
}

function messageToKey(message: any) {
    return `${message.contractAddress}-${message.index}`;
}
export function printChain(data: any) {
    const richData = enrich(data);
    const result = dataToTree(richData);

    const chains = treeToChains(result);
    //console.log(chains);
    
    print(chains);
}

function print(data: any) {
    let buffer = "";

    for (let key in data) {
        buffer += `\n\n${key} ===> \n\t`;
        let arr = data[key];
        for (let j = 0; j < arr.length; j++) {
            if (j > 0) {
                buffer += `\n \t`;
            }
            const coins = fromNano(arr[j].inMessage.value);
            buffer += `${arr[j].prev?.contractImpl?.constructor.name} ${addressEllipsis(arr[j].from)}  ->  Message::${messageOpToName(
                arr[j]
            )}(${coins}💎)   -> ${arr[j].contractImpl?.constructor.name} ${addressEllipsis(arr[j].contractAddress)} [${
                arr[j].index
            }] `.padEnd(100);
        }
        buffer += `\n`;
    }
    console.log(buffer);
}

function addressEllipsis(address: string) {
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

printChain(data);

// A -> B -> C
//        -> D -> F
//        -> E -> G
