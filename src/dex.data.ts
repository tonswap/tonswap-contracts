import BN from "bn.js";
import {Cell, serializeDict} from "ton";

export const stringToCell = (str: string) => {
    let cell = new Cell()
    cell.bits.writeString(str)
    return cell
}

export type DexConfig = {
    name: string
    symbol: string
    decimals: BN
    totalSupply: BN
    totalLPSupply: BN
    tokenReserves: BN
    tonReserves : BN
}

export function buildDataCell(conf: DexConfig) {
    


    let dataCell = new Cell()
    dataCell.bits.writeUint(conf.name.length, 8)        // name.length
    dataCell.bits.writeString(conf.name)                // name
    dataCell.bits.writeUint(conf.symbol.length, 8)        // symbol.length
    dataCell.bits.writeString(conf.symbol)              // symbol
    dataCell.bits.writeUint(conf.decimals, 8)           // decimals
    dataCell.bits.writeCoins(conf.totalSupply)      // total_supply
    dataCell.bits.writeCoins(conf.totalLPSupply)      // total_supply
    dataCell.bits.writeCoins(conf.tokenReserves)    // token_reserves
    dataCell.bits.writeCoins(conf.tonReserves)      // ton_reserves
    dataCell.bits.writeUint(0, 1)                       // balances dict
    dataCell.bits.writeUint(0, 1)                       // allowed  dict
    dataCell.bits.writeUint(0, 1)                       // credits dict
    dataCell.bits.writeUint(1, 1)                       // inited
    
    return dataCell
}


/* 
int name_size = ds~load_uint(8);
  slice name = ds~load_bits(name_size * 8);
  int symbol_size = ds~load_uint(8);
  slice symbol = ds~load_bits(symbol_size * 8);
  int decimals = ds~load_uint(8);
  int total_supply = ds~load_grams();
  int token_reserves = ds~load_grams();
  int ton_reserves = ds~load_grams();
  cell balances = ds~load_dict();
  cell approvals = ds~load_dict();
  cell liqudity = ds~load_dict();
  int initialised = ds~load_uint(1);

*/