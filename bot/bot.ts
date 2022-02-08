import { Telegraf, Markup, Context, session } from 'telegraf';
const { reply, fork } = Telegraf
import { getMacros, macroReplace, execFifth, execRunMethod } from './utils'
import { initMarkupUI } from './markup-ui';
const MACROS = getMacros();

const sayYoMiddleware = fork((ctx) => ctx.reply('yo'))

interface SessionData {
    messageCount: number
// ... more session data go here
}

// Define your own context type
interface MyContext extends Context {
    session?: SessionData
// ... more props go here
}


const config = require('./config');

const process = require('process');
const bot = new Telegraf<MyContext>(config.token)

bot.use(session());



console.log('======================== TONSWAP =============================');






bot.help((ctx: any) => {
    ctx.reply(
`/balance <token_addr> <address_file> ->  prints out balance address
-> /balance $USDC #MY_ADDRESS
/transfer <token_addr> <target_addr> <amount> 
-> /transfer $USDC LP-TON.addr 200
/mint <token_address> -> creates a mint action on a erc20
-> /mint $USDC
/addliquidity <amount_a> <amount_b> -> 
-> /addliquidity 1000 1000
/removeliquidity <lp_address> <amount_to_remove> -> 
-> /removeliquidity $LP 2.5
/swap <src_token_address> <lp_address> <amount_to_swap> <min_amount_out> 
->    /swap $USDC $LP_USDC_KILO 4000 1 Send
/quit to stop the bot
`);
});



bot.command('balances', async (ctx: any) => {
    
    let cmd = ctx.update.message.text.replace('/balances ', '');
    let args = cmd.split(' ');
    args = macroReplace(args);
    
    if (args.length === 0) {
        console.log(cmd)
        return 
    }
    
    ctx.replyWithHTML("<b>=================== Balances =====================================================</b>");
    for(var key in MACROS) {
        if(key.indexOf('$') != 0) {
            continue;
        }
        let address = MACROS[key];
        console.log(key, address)
        let out = await execRunMethod(address, 'ibalance_of', args);
        ctx.replyWithHTML(`${key} > ${address} Balance -> <b>${out}</b>`);
    }
    ctx.replyWithHTML("<b>==================================================================================</b>");
});

bot.command('addliquidity', async (ctx: any) => {
    console.log('addLiquidity !');
    let cmd = ctx.update.message.text.replace('/addliquidity ', '');
    let args = cmd.split(' ');
    args = macroReplace(args);

    if (args.length !== 2 ) {
        console.log(`/addliquidity token_a_amount token_b_amount`);
        return 
    }

    let stdOut = await execFifth('./fift-actions/add-liquidity.fif', [args[0], args[1]]);
    if (stdOut.startsWith('x{')) {
        let buffer = stdOut.substring(2, stdOut.length - 2 );
        const link = `ton://transfer/${MACROS["$DEX"]}?amount=100000000&text=${buffer}`;
        ctx.reply(link);
    } else {
        ctx.reply('something went wrong');
        //ctx.session.counter = 1;
    }
});


bot.command('balance', async (ctx: any) => {
    
    let cmd = ctx.update.message.text.replace('/balance ', '');
    let args = cmd.split(' ');
    args = macroReplace(args);
    
    if (args.length === 0) {
        console.log(cmd)
        return 
    }
    console.log(args);
    let contract = args.shift() as string;
    let out = await execRunMethod(contract, 'ibalance_of', args);
    ctx.replyWithHTML(`Balance -> <b>${out}</b>`);
});

bot.command('mint', async (ctx: any)=> {
    // same ouput of  FIFT mint.fif 
    
    let cmd = ctx.update.message.text.replace('/mint ', '');
    let args = cmd.split(' ');
    args = macroReplace(args);
    if (args.length === 0) {
        console.log(cmd)
        return 
    }
    const bocBuffer = `000000050000000000000000`; // mint action generated buy mint.fif
    ctx.reply(`generating ton deep link mint TX`);
    ctx.reply(`ton://transfer/${args[0]}?amount=150000000&text=${bocBuffer}`)
    
})


bot.command('transfer', async (ctx: any) => {
    console.log(`transfer start`)
    let cmd = ctx.update.message.text.replace('/transfer ', '');
    let args = cmd.split(' ');
    args = macroReplace(args);
    if (args.length === 0) {
        ctx.replyWithHTML(
            `missing arguments please use 
            /trasnfer <token_addr> <target_addr> <amount>`);
            return 
        }
        let trc20Token = args.shift() as string;
        let to = args.shift() as string;
        let amount = args.shift() as string;
        
        // generate the boc file for transfer
        const tmpBoc = `transfer-query-${Date.now()}.boc`
        let stdOut = await execFifth('./fift-actions/trc20-transfer.fif', [to, amount], tmpBoc);
        if (stdOut.startsWith('x{')) {
            let buffer = stdOut.substring(2, stdOut.length - 2 );
            let deepLink = `ton://transfer/${trc20Token}?amount=250000000&text=${buffer}`;
            ctx.reply(`Transfer transaction -> ${deepLink}`);
        } else {
            ctx.reply(`fift execuation failed`);
        }
    });
    
    
    
    
    bot.command('swap', async (ctx: any) => {
        
        let cmd = ctx.update.message.text.replace('/swap ', '');
        let args = cmd.split(' ');
        console.log('raw args',args);
        args = macroReplace(args);
        console.log('parsed args',args);
        if( args.length !== 4) {
            ctx.reply(`the command is missing paramsters `+args.join(' '));
            ctx.reply(`/swap <source_token> <lp_address.addr> <amount_a> <amount_b>`);
            return;
        }
        let source_token = args[0];
        let lp_address = args[1];
        let amount_a = args[2];
        let amount_b = args[3];
        
        let stdOut = await execFifth('./fift-actions/swap.fif', [lp_address, amount_a, amount_b]);
        if (stdOut.startsWith('x{')) {
            let buffer = stdOut.substring(2, stdOut.length - 2 );
            let deepLink = `ton://transfer/${source_token}?amount=250000000&text=${buffer}`;
            ctx.reply(`Transfer transaction -> ${deepLink}`);
        } else {
            ctx.reply(`fift execuation failed`);
        }
    });
    
    
    
    bot.command('removeliquidity', async (ctx: any) => {
        
        let cmd = ctx.update.message.text.replace('/removeliquidity ', '');
        let args = cmd.split(' ');
        args = macroReplace(args);
        if( args.length !== 2) {
            ctx.reply(`the command is missing paramsters `+args.join(' '));
            ctx.reply(`/removeliquidity <lp_address> <lp_amount>`);
            return;
        }
        
        let lp_address = args[0];
        let lp_amount = args[1];
        
        let stdOut = await execFifth('./fift-actions/remove-liquidity.fif', [lp_amount]);
        if (stdOut.startsWith('x{')) {
            let buffer = stdOut.substring(2, stdOut.length - 2 );
            let deepLink = `ton://transfer/${lp_address}?amount=250000000&text=${buffer}`;
            ctx.reply(`Transfer transaction -> ${deepLink}`);
        } else {
            ctx.reply(`fift execuation failed`);
        }
    });
    
    
    bot.command('seqno', async (ctx: any) => {
        let args = ctx.update.message.text.split(' ');
        if (args.length < 2) {
            return 
        }
        let wallet = args[1];
        ctx.reply(`getting seqno ${wallet}`);
        let stdout = await execRunMethod(wallet, 'seqno', []);
        ctx.replyWithHTML(`<b>${wallet} seqno -></b> <b>${stdout}</b>`);
    });
    
    
    
    bot.command('quit', (ctx: any) => {
        // Explicit usage
        ctx.telegram.leaveChat(ctx.message.chat.id);
        // Context shortcut
        ctx.leaveChat();
    });
    
    
    
    initMarkupUI(bot);
    
    
    
    /* ================================================================= */
    
    // bot.command('keyboard', (ctx) => {
        // ctx.reply(
            //     'Keyboard',
            //     Markup.inlineKeyboard([
                //         Markup.button.callback('First option', 'first'),
                //         Markup.button.callback('Second option', 'second'),
                //     ])
                //     );
                // });
                // bot.on('text', (ctx) => {
                    //     ctx.reply(
                        //     'You choose the ' +
                        //     (ctx.message.text === 'first' ? 'First' : 'Second') +
                        //     ' Option!'
                        //     );
                        // });
                        
                        
        
bot.launch();
// process.once('SIGINT', () => bot.stop('SIGINT'));
// process.once('SIGTERM', () => bot.stop('SIGTERM'));