import { Address, Cell, ContractSource, TonClient, contractAddress } from "ton";
import { compileFunc } from "ton-compiler";
import { readFile } from "fs/promises";
import { buildDataCell, DexConfig } from "./dex.data";
import BN from "bn.js";
import { stripBoc, toDecimals } from "./utils";
import { DexActions } from "./dex.actions";
import * as fs from "fs";

const MAIN_NET_RPC = "https://scalable-api.snwhales.com/jsonRPC";

//const USDC_ADDRESS = 'kQA2aQA7gHRQmR0qNnLwPA0LtHOltHbE6YFBj9bk2aQ1Diwr';
const LUNA_ADDRESS = "EQAycqbigAAkekkGG1A_3LSVGS1RfvJb4YavqUcbUg0pYK0u";
const TOKEN = Address.parseFriendly(LUNA_ADDRESS).address;
const TOKEN_ADMIN = Address.parseFriendly(
    "EQDjhy1Ig-S0vKCWwd3XZRKODGx0RJyhqW37ZDMl-pgv8iBr"
).address; //smol-wallet
const PROTOCOL_ADMIN = Address.parseFriendly(
    "EQDrjaLahLkMB-hMCmkzOyBuHJ139ZUYmPHu6RRBKnbdLIYI"
).address; // DEPLOYER

const data = {
    name: "LP Token",
    symbol: "LP",
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
    let funcSource = (await readFile("src/dex.func")).toString("utf-8");
    let msgHexComment = (await readFile("src/msg_hex_comment.func")).toString("utf-8");
    let source = await compileFunc(msgHexComment + funcSource);
    let sourceCell = Cell.fromBoc(source.cell)[0];

    console.log(Cell.fromBoc(source.cell));

    let contractSource: ContractSource = {
        initialCode: sourceCell,
        initialData: dataCell,
        workchain: 0,
        type: "",
        backup: () => "",
        describe: () => "dex",
    };

    let address = await contractAddress(contractSource);

    console.log("contract address", address);

    let client = new TonClient({
        endpoint: MAIN_NET_RPC,
        //endpoint: 'http://127.0.0.1:4443/jsonRPC'
    });

    // message with one bit , just to statisfy initialized the recv_external mechanisem.
    let msgCell = new Cell();
    msgCell.bits.writeUint(1, 1);

    client.sendMessage

    client.

    await client.sendExternalMessage(
        {
            address,
            source: contractSource,
        },
        msgCell
    );

    console.log("Init message was sent to", address);

    await logDeepLinks(address);
}

async function logDeepLinks(address: Address) {
    const contractLink = `https://tonwhales.com/explorer/address/${address.toFriendly()}`;
    console.log(contractLink);
    const fundLink = `fund contract ton://transfer/${address.toFriendly()}?amount=100000000`;
    console.log(fundLink);

    const initData = await DexActions.initData();
    const bocData = stripBoc(initData.toString());
    const initLink = `ton://transfer/${address.toFriendly()}?amount=100000000&text=${bocData}`;
    console.log(`init data ${initLink}`);

    const TOKEN = "EQAycqbigAAkekkGG1A_3LSVGS1RfvJb4YavqUcbUg0pYK0u"; //LUNA
    const transferAndLiq = await DexActions.transferAndAddLiquidity(address, toDecimals(10), 10);
    const addLiquidityBoc = stripBoc(transferAndLiq.toString());
    const ALdeeplink = `ton://transfer/${TOKEN}?amount=250000000&text=${addLiquidityBoc}`;

    console.log(`*** ADD-LIQUIDITY ***
    transfer-erc20 -> add-liquditiy-> 
    ${ALdeeplink}`);

    // Swap 13 Luna  for 1 TON
    const swapOut = await DexActions.transferAndSwapOut(address, toDecimals(13), toDecimals(1));
    const swapOutBoc = stripBoc(swapOut.toString());
    const swapOutLink = `ton://transfer/${TOKEN}?amount=250000000&text=${swapOutBoc}`;

    // Swap 1 TON for 10 LUNA
    const swapIn = await DexActions.swapIn(toDecimals(8));
    const swapInBoc = stripBoc(swapIn.toString());
    const swapInLink = `ton://transfer/${address.toFriendly()}?amount=250000000&text=${swapInBoc}`;

    const html = `<!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title></title>
    </head>
    <body>
      <h3>DEPLOY FOR ${address.toFriendly()}</h3>
      <h3>Explorer Link</h3>
      <a class="href" href="${contractLink}">${contractLink}</a>
      <h3>fund Contract by sending ton</h3>
      <a class="href" href="${fundLink}">fund contract with TON</a>
      <h3>ADD LIQUIDITY DEEP LINK</h3>
      <a class="href" href="${ALdeeplink}">add liquidity</a>
      <h3>SWAP: 10 LUNA -> 1 TON</h3>
      <a class="href" href="${swapOutLink}">10 LUNA -> 1 TON</a>
      <h3> SWAP: 1 TON - > 10 LUNA</h3>
      <a class="href" href="${swapInLink}"> 1 TON - > 10 LUNA</a>
    </body>
    </html>`;

    const file = `./deployed-html/${address.toFriendly()}.html`;
    fs.writeFileSync(file, html, "utf-8");
    console.log(`html file ` + file);
}

init(data);
