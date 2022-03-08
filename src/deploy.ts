import {Address, Cell, ContractSource, TonClient, contractAddress} from "ton";
import {compileFunc} from "ton-compiler";
import {readFile} from "fs/promises";
import {buildDataCell, DexConfig} from "./dex.data";
import BN from "bn.js";


const TOKEN = Address.parseFriendly('EQDanCTHIdPHcqogpptnVAWMBxrAz5YecwLHp1kF3K5f0S-N').address; // kilo token
const TOKEN_ADMIN = Address.parseFriendly('EQDjhy1Ig-S0vKCWwd3XZRKODGx0RJyhqW37ZDMl-pgv8iBr').address //smol-wallet
const PROTOCOL_ADMIN = Address.parseFriendly('EQDrjaLahLkMB-hMCmkzOyBuHJ139ZUYmPHu6RRBKnbdLIYI').address; // DEPLOYER

function init(conf: DexConfig) {
    const dataCell = buildDataCell(conf);
    deploy(dataCell);
}


async function deploy(dataCell: Cell) {
    let funcSource = (await readFile('src/dex.func')).toString('utf-8');
    let source = await compileFunc(funcSource);
    let sourceCell = Cell.fromBoc(source.cell)[0];

    console.log(Cell.fromBoc(source.cell))

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
    msgCell.bits.writeUint(1, 1);

    await client.sendExternalMessage(
        {
            address,
            source: contractSource
        },
        msgCell
    );

    console.log('Init message was sent to', address)
}

var data = {
    name: 'LP Token',
    symbol: 'LP',
    decimals: new BN(9),
    totalSupply: new BN(0),
    tokenReserves: new BN(0),
    tonReserves: new BN(0),
    tokenAddress: TOKEN,
    tokenAdmin: TOKEN_ADMIN,
    tokenAllocPoints: new BN(500),
    protocolAdmin: PROTOCOL_ADMIN,
    protocolAllocPoints: new BN(0),
} as DexConfig;

init(data);