import {Address, Cell, ContractSource, TonClient, contractAddress} from "ton";
import {compileFunc} from "ton-compiler";
import {readFile} from "fs/promises";
const util = require('util');
const exec = util.promisify(require('child_process').exec);
import {buildDataCell, DexConfig} from "./dex.data";
import BN from "bn.js";
import {stripBoc, toDecimals} from "./utils";
import {DexActions} from "./dex.actions";


const MAIN_NET_RPC = 'https://scalable-api.tonwhales.com/jsonRPC';
const LOCAL_RPC = '';


//const USDC_ADDRESS = 'kQA2aQA7gHRQmR0qNnLwPA0LtHOltHbE6YFBj9bk2aQ1Diwr';
const LUNA_ADDRESS = 'EQAycqbigAAkekkGG1A_3LSVGS1RfvJb4YavqUcbUg0pYK0u';
const TOKEN = Address.parseFriendly(LUNA_ADDRESS).address;
const TOKEN_ADMIN = Address.parseFriendly('EQDjhy1Ig-S0vKCWwd3XZRKODGx0RJyhqW37ZDMl-pgv8iBr').address //smol-wallet
const PROTOCOL_ADMIN = Address.parseFriendly('EQDrjaLahLkMB-hMCmkzOyBuHJ139ZUYmPHu6RRBKnbdLIYI').address; // DEPLOYER

const data = {
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
        endpoint: MAIN_NET_RPC
        //endpoint: 'http://127.0.0.1:4443/jsonRPC'
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

    await logDeepLinks(address);
}

async function logDeepLinks(address: Address) {
    console.log(`https://tonwhales.com/explorer/address/${address.toFriendly()}`);
    console.log(`fund contract ton://transfer/${address.toFriendly()}?amount=100000000`);
    console.log(`init data ton://transfer/${address.toFriendly()}?amount=100000000`)

    const TOKEN = 'EQAycqbigAAkekkGG1A_3LSVGS1RfvJb4YavqUcbUg0pYK0u'; //LUNA
    const transferAndLiq = await DexActions.transferAndAddLiquidity(address, toDecimals(10), 10 )
    const boc2 = stripBoc(transferAndLiq.toString());
    const deeplink =  `ton://transfer/${TOKEN}?amount=250000000&text=${boc2}`;
    console.log(`*** ADD-LIQUIDITY ***
    transfer-erc20 -> add-liquditiy->
    ${deeplink}`);
}


init(data);