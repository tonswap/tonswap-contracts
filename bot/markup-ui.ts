import { Markup } from "telegraf";
import { BigNumber } from "bignumber.js";
import { execRunMethod, getAccountBalance, execFifth, getMacros, macroReplace, toDecimal } from "./utils";
const MACROS = getMacros();

type currnecy = {
    address:string
    symbol: string
    name: string
}

const UI_DECIMALS = 5;

interface MapObj {
    [key: string]: currnecy 
}
const currencies: MapObj = {
    'USDC': {address:  MACROS['$USDC'] , symbol: '💲', name:'USDC'},
    'KILO': {address:  MACROS['$KILO'] , symbol: '𐄷', name:'KILO'},
    'LP':   {address:  MACROS['$DEX']  , symbol: '📉', name:'LP'},
    'WTON': {address:  MACROS['$WTON'] , symbol: '💎', name:'WTON'},
}


export function initMarkupUI(bot: any) {
    var start = (ctx: any) => {

        ctx.session ??= { counter: 0 };
        ctx.session.counter = 0;
        showState(ctx);
        
    };

    // bot.on('new_chat_members', (msg:any) => {
    //     bot.sendMessage(msg.chat.id, 'Hello please run /ui to start a session');
    // });

    bot.command('ui', start);
    bot.command('start', start);

  
    bot.hears('Back to Menu 🏠', start);

    bot.on('text', onText);
    bot.on('quit', (ctx: any)=> { console.log('x')});
    
    bot.action('menu', (ctx: any)=> {

        console.log('menu !!!!!!!!!!!!!!!!!!!!!!')
    });
    ''
    bot.action('begin-swap',(ctx: any) => {
        ctx.reply('Choose coin to swap', Markup
            .inlineKeyboard([[
                Markup.button.callback(' 💰USDC ➡ 💎KILO',  'swap USDC')
            ], [
                Markup.button.callback(' 💎KILO ➡ 💰USDC', 'swap KILO')
            ]
            ])
        );

       showBackButton(ctx);
        
    });

    bot.action(/swap (.+)/, (ctx:any)=> {
        
        let token = ctx.match[1]
        console.log(`swap token ${token}`);
        if( token == 'USDC') {
            ctx.session.source_token = currencies['USDC'];
            ctx.session.target_token = currencies['KILO'];
        } else {
            ctx.session.source_token = currencies['KILO'];
            ctx.session.target_token = currencies['USDC'];
        }
        ctx.reply('choose swap amount');
        ctx.session.counter = 1;
    });

    bot.action('swap-amount', (ctx:any)=> {
        ctx.reply('choose swap amount');
    });

    bot.action(/swap-to (.+)/, (ctx:any)=> {
        let token = ctx.match[1];
        ctx.session.target_token = currencies[token];
        ctx.session.counter = 3;
        showState(ctx);
    });

    bot.action("balance", (ctx:any)=> {
        if(!ctx?.session.wallet_address) {
            ctx.reply('Please set your wallet address (base64)');
            ctx.session.counter = 3;
        } else {
            printBalances(ctx);
        }
    })

    bot.action(/mint (.+)/, (ctx:any)=> {
        let token = ctx.match[1] as string;
        token = token.toUpperCase();
        const bocBuffer = `000000050000000000000000`; // mint action generated buy mint.fif
        ctx.reply(`Mint ${token} TX`);
        const url = `ton://transfer/${currencies[token].address}?amount=100000000&text=${bocBuffer}`;
        
        ctx.reply(url, Markup.inlineKeyboard([
            Markup.button.url('Execute Mint Tranasaction', url), 
        ]));
        showBackButton(ctx);
    });

    bot.action('how', (ctx:any)=> {
        ctx.reply(`In order to demo this swap you need to follow these steps:
        1. Go to Menu using /start command 
        2. choose mint $USDC , and click on the ton:// link ( in case your ton wallet doesnt open copy the link and paste in browser, or you can use the web telegram app web.telegram.org)
        3. choose mint $KILO
        4. Go to Menu and run Balance command , and paste your address in the base64 format (EQDrjaLahLkMB-hMCmkzOyBuHJ139ZUYmPHu6RRBK...LIYI)
        5. check that you have sufficent funds and you can swap between the assets
        6. go to Menu > choose Swap > USDC -> KILO
        7. click on the transaction link ( copy paste the link in chrome if needed)
        8. Menu > Balance and check if the balance is update
        9. There is an option to view the LP reserves using Pool Reserves
        `)

        showBackButton(ctx);
    })

    bot.action('complete-swap', (ctx:any)=> {
        showSwapLink(ctx);
    })


    bot.action('pool-stats', async (ctx:any)=> {
        
        const reserves_a = await execRunMethod(MACROS['$DEX'], 'get_reserves_a', []);
        const reserves_b = await execRunMethod(MACROS['$DEX'], 'get_reserves_b', []);
        //const total_supply = await execRunMethod(MACROS['$DEX'], 'get_total_supply', []);
        
        ctx.replyWithHTML(`Pool reserve $USDC: <b> ${ toDecimal(reserves_a) }</b> `);
        ctx.replyWithHTML(`Pool reserve $KILO: <b> ${ toDecimal(reserves_b) }</b> `);
        showBackButton(ctx);
    })
}


const header = `<br>
____  _____  _  _  ___  _    _    __    ____ <br>
(_  _)(  _  )( \( )/ __)( \/\/ )  /__\  (  _ \ <br >
 )(   )(_)(  )  ( \__ \ )    (  /(__)\  )___/<br>
(__) (_____)(_)\_)(___/(__/\__)(__)(__)(__)<br>`;

const showState = async (ctx: any) => {
    switch (ctx.session.counter) {
        case 0:
           // ctx.replyWithHTML(header);
            ctx.reply('Welcome to TonSwap, Chose ', Markup
                .inlineKeyboard([
                    [
                        Markup.button.callback('💰 Swap $USDC and $KILO', 'begin-swap'), 
                    ],
                    // [
                    //     Markup.button.url('➕ Manage Liquidity', 'https://uniswap.org/'),
                    // ],
                    [
                        Markup.button.callback(`💵 Balance [${ctx?.session?.wallet_address?.substr(0,10)|| ''}...]`, 'balance'), 
                    ],
                    [
                        Markup.button.callback('📊 Pool Reserves', 'pool-stats'), 
                    ],
                    [
                        Markup.button.callback('❓How to Swap', 'how'), 
                    ],
                    [
                        Markup.button.callback('⛏ mint 💵USDC', 'mint usdc'), 
                        Markup.button.callback('⛏ mint ⚖KILO', 'mint kilo'), 
                    ]
                ])
            );     
            
            
            break;

        case 1:
            
            break;
        case 2:
            console.log('stage 2 !')
            let iDir = ctx.session.source_token.name == 'USDC' ? '1': '0';
            let amount = (new BigNumber(ctx.session.swap_amount)).multipliedBy(10 ** UI_DECIMALS).toString();
            
            ctx.reply(`fetching expcted output amount ...`);
            let minAmountOut = await execRunMethod(MACROS['$DEX'], 'get_amount_out_lp', [ amount, iDir]); 
            //console.log(`minAmountOut=${minAmountOut}`);
            ctx.session.min_amount_out = new BigNumber(minAmountOut).div(10 ** UI_DECIMALS).toFixed(); // TODO should be fixed after deployemnt
            //console.log(`minAmountOut ${ ctx.session.min_amount_out }`)
            const reserves_a = await execRunMethod(MACROS['$DEX'], 'get_reserves_a', []);
            const reserves_b = await execRunMethod(MACROS['$DEX'], 'get_reserves_b', []);
            let price = (new BigNumber(reserves_a)).div(reserves_b);
            ctx.replyWithHTML(`<b>Price</b> 1 $USDC = ${price} $KILO`);
           
            const msg = `swapping ${ctx.session.swap_amount}$${ctx.session.source_token.name} for minimum amount of ${ctx.session.min_amount_out}$${ctx.session.target_token.name} (after fees)`;
            
            ctx.reply(msg, Markup.inlineKeyboard([
                Markup.button.callback('✅ Swap', 'complete-swap'), 
                Markup.button.callback('⛔️ Cancel', 'start')    
            ]));
            
            break;

        case 5:
            ctx.reply('Enter smart-contract address of TRC20 token:');
            break;

        case 6:
            ctx.reply('Please enter the amount of ' + formatName(ctx.session.toAddr) + ':');
            break;
        // case 8:
        //     showOrderLink(ctx);
        //     break;

        case 10:
            ctx.reply('Please enter your wallet address:');
            break;
    }
};


 async function onText(ctx: any)  {
    console.log(`on text ${ctx.message.text}`)
    
    switch (ctx.session?.counter) {
     
         case 1: // Choose Token amount to swap
            ctx.session.swap_amount = parseFloat(ctx.message.text);
            if(ctx.session.swap_amount == 0) {
                ctx.reply('⚠️ bad input , please insert a valid number');
                break;
            }
            ctx.session.counter = 2;
            showState(ctx);
            break;
        
        case 3: // Set User wallet address for balance query
            if(ctx.message.text || ctx.session.wallet_address) {
                let address = macroReplace([ctx.message.text])[0];
                ctx.session.wallet_str = address || ctx.message.text;
                ctx.session.wallet_address = ctx.session.wallet_str;
                return printBalances(ctx);
                
            }
            ctx.session.counter = 4;
            showState(ctx);
            break;
            
    }
}


async function printBalances(ctx: any) {
    let stdOut = await execFifth('./utils/parse-address.fif', [ctx.session.wallet_str]);
    console.log(stdOut);
    ctx.session.wallet_int = stdOut.replace("\n", " ");
    ctx.replyWithHTML(`====== Wallet Balance =====`);
    let tonBalance = await getAccountBalance(ctx.session.wallet_str) as string;
    
    let tonBalanceBN = (new BigNumber(tonBalance)).div(10 ** 18).toString();
    ctx.replyWithHTML(`$TON: <b>${ tonBalanceBN }</b>`);

    showBackButton(ctx);
    for(var key in MACROS) {
        if(key.indexOf('USDC') > -1 || key.indexOf('KILO') > -1 ) {
            
            let address = MACROS[key];
            console.log(key, address)
            let out = await execRunMethod(address, 'ibalance_of', ctx.session.wallet_int.split(' '));
            let outBN = (new BigNumber(out)).div(10 ** UI_DECIMALS).toString()
            ctx.replyWithHTML(`${key}: <b>${outBN}</b>`);
        }
    }
    

    
}



async function showSwapLink(ctx: any) {

    const normal_swap_in = (new BigNumber(ctx.session.swap_amount)).div( 10 ** (9 - UI_DECIMALS) ).toString();
    const normal_swap_out = (new BigNumber(ctx.session.min_amount_out)).div( 10 ** (9 - UI_DECIMALS) ).toString();
    let stdOut = await execFifth('./fift-actions/swap.fif', [MACROS["#DEX_FILE"], normal_swap_in, normal_swap_out]);
    if (stdOut.startsWith('x{')) {
        let buffer = stdOut.substring(2, stdOut.length - 2 );
        const link = `ton://transfer/${ctx.session.source_token.address}?amount=200000000&text=${buffer}`;
        ctx.reply(`Click Link to Proceed ${link}`);
        
        
    } else {
        ctx.reply('something went wrong');
        ctx.session.counter = 1;
    }
}

function  showBackButton(ctx: any) {
    ctx.reply('...', Markup
    .keyboard([
        ['Back to Menu 🏠'],
    ])
    .oneTime()
    .resize());
}

// async function showRemoveLPLink(ctx: any) {
//     let stdOut = await execFifth('./fift-actions/remove-liquidity.fif', [ctx.session.lp_amount_a, ctx.session.lp_amount_b]);
//     if (stdOut.startsWith('x{')) {
//         let buffer = stdOut.substring(2, stdOut.length - 2 );
//         const link = `ton://transfer/${DEX_ADDR}?amount=1&text=${buffer}`;
//         ctx.reply(link);
//     } else {
//         ctx.reply('something went wrong');
//         ctx.session.counter = 1;
//     }
// }







const formatName = (addr: string) => {
    const currency = currencies[addr];
    if (!currency) {
        return addr;
    }
    return currency.symbol + ' ' + currency.name;
};