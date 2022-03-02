import  BN  from "bn.js";


function toBigInt(a: BN) {
    return BigInt(a.toString(10) );
}

export function init () {}

expect.extend({
    toBeBNcloseTo(receivedValue: BN, targetValue: BN, delta: BN) {
        if(receivedValue.cmp(targetValue) == 0 ) { 
            return {
                pass: true,
                message: "" 
            }
        }
        const low = toBigInt(targetValue.clone().sub(delta) );
        const high = toBigInt(targetValue.clone().add(delta) );
        const val = toBigInt(receivedValue);
        
        let res = val >= low && val <= high;
        return {
            pass: res,
            message: () => 
            `expected ${receivedValue.toString(10)} ~= ${targetValue.toString(10)}
            >  ${low.toString(10)} 
            <  ${high.toString(10)}`
        }
    } 
}); 

expect.extend({
    eqBN(receivedValue: BN, targetValue: BN) {
        if(receivedValue.cmp(targetValue) == 0 ) { 
            return {
                pass: true,
                message: "" 
            }
        }
        return {
            pass: false,
            message: () => 
            `
            expected ${receivedValue.toString(10)} 
            got      ${targetValue.toString(10)}`
        }
    }
});