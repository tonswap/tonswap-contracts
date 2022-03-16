import {Address, Cell, ContractSource, TonClient, contractAddress, serializeDict} from "ton";
import {compileFunc} from "ton-compiler";
import {readFile} from "fs/promises";
import BN from "bn.js";
import {DictionaryHelper} from "./dictionary-helper";


const TOKEN_OWNER = Address.parseFriendly('EQDanCTHIdPHcqogpptnVAWMBxrAz5YecwLHp1kF3K5f0S-N').address; // kilo token


async function buildDataCell(name: string, symbol: string, owner: Address, totalSupply: BN) {
    const balanceTable = new Map([
        [new BN(owner.hash).toString(10), totalSupply],
    ]);
    const balances = serializeDict(balanceTable, 264, (value, cell) => {
        cell.bits.writeCoins(value)
    })
    console.log('ts dictionary');
    console.log(balances)

    let dataCell = new Cell()
    dataCell.bits.writeUint(name.length, 8)          // name.length
    dataCell.bits.writeString(name)                           // name
    dataCell.bits.writeUint(symbol.length, 8)       // symbol.length
    dataCell.bits.writeString(symbol)                        // symbol
    dataCell.bits.writeUint(9, 8)             // decimals
    dataCell.bits.writeCoins(totalSupply)             // totalSupply
    dataCell.bits.writeUint(0,1)              // balances
    dataCell.bits.writeUint(0,1)             // allowance
    dataCell.bits.writeUint(0,1)             // inited
    return dataCell
}

async function deploy(dataCell: Cell) {
    let funcSource = (await readFile('src/trc20-mint.func')).toString('utf-8');
    let msgHexComment = (await readFile('src/msg_hex_comment.func')).toString('utf-8');
    let source = await compileFunc(msgHexComment+funcSource);
    let sourceCell = Cell.fromBoc(source.cell)[0];

    let contractSource: ContractSource = {
        initialCode: sourceCell,
        initialData: dataCell,
        workchain: 0,
        type: '',
        backup: () => '',
        describe: () => 'dex'
    }

    let address = await contractAddress(contractSource);

    console.log('contract address', address)

    let client = new TonClient({
        endpoint: 'https://scalable-api.tonwhales.com/jsonRPC'
    })

    // message with one bit , just to statisfy initialized the recv_external mechanisem.
    let msgCell = new Cell()
    msgCell.bits.writeUint(0, 1);

    await client.sendExternalMessage(
        {
            address,
            source: contractSource
        },
        msgCell
    );

    console.log('Init message was sent to', address)
}

( async ()=> {
    const data = await buildDataCell(
        "USDD",
        "USDD",
        TOKEN_OWNER,
        new BN("1000000000000000000")
    );

    deploy(data);
})();