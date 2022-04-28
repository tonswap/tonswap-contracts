const { Contract, Cell, parseAddress, createOffchainUriCell } = require("tonweb");

function buildAddLiquidityCell(to,amount,responseDestination,forwardTonAmount,slippage) {
        let messageBody = new Cell();
        messageBody.bits.writeUint(0xf8a7ea5, 32); // action
        messageBody.bits.writeUint(1, 64); // query-id
        messageBody.bits.writeCoins(amount);
        messageBody.bits.writeAddress(to);
        messageBody.bits.writeAddress(responseDestination);
        messageBody.bits.writeBit(false); // null custom_payload
        messageBody.bits.writeCoins(forwardTonAmount);
        messageBody.bits.writeBit(false); // forward_payload in this slice, not separate messageBody
        messageBody.bits.writeUint(22, 32);
        messageBody.bits.writeUint(slippage, 32); // slippage
}

function buildSwapJettonCell(to, amount, responseDestination, forwardTonAmount, minAmountOut) {
        let messageBody = new Cell();
        messageBody.bits.writeUint(0xf8a7ea5, 32); // action
        messageBody.bits.writeUint(1, 64); // query-id
        messageBody.bits.writeCoins(amount);
        messageBody.bits.writeAddress(to);
        messageBody.bits.writeAddress(responseDestination);
        messageBody.bits.writeBit(false); // null custom_payload
        messageBody.bits.writeCoins(forwardTonAmount);
        messageBody.bits.writeBit(false); // forward_payload in this slice, not separate messageBody
        messageBody.bits.writeUint(24, 32);  // Add Liquidity OP=22
        messageBody.bits.writeUint(minAmountOut, 32); // slippage
}

// cell.bits.writeUint(0xf8a7ea5, 32); // request_transfer op
//         cell.bits.writeUint(params.queryId || 0, 64);
//         cell.bits.writeCoins(params.jettonAmount);
//         cell.bits.writeAddress(params.toAddress);
//         cell.bits.writeAddress(params.responseAddress);
//         cell.bits.writeBit(false); // null custom_payload
//         cell.bits.writeCoins(params.forwardAmount || new BN(0));
//         cell.bits.writeBit(false); // forward_payload in this slice, not separate cell
//         if (params.forwardPayload) {
//             cell.bits.writeBytes(params.forwardPayload);
//         }