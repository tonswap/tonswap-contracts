#### Token Address
run `npm run deploy:trc20` make sure token address

Contract Address
`$LUNA`

#### Deploy
run `npm run deploy` make sure token address 

Contract deployed at
`EQCgSVCWAegMvM3kq4hKtgjZDaGUrm8-bSTgtNKnODsIZq39`

run ` ts-node src/dex.actions.ts` and run 
add Liquidity command


#### add-liquidity 
``` 
ton://transfer/EQCovK7cCG01JX6hPDWRk2388ZS_uFZ9h23XZYeeM3mPX4fH?amount=250000000&text=00000001000000000000000000756C982D70132BB9002B71B545144EF06C829F61D381718BA5A3CF3B5BA96E535012A05F200020000000000000004
```

#### add-liquidity
``` 
ton://transfer/<conract_address>?amount=250000000&text=00000001000000000000000000756C982D70132BB9002B71B545144EF06C829F61D381718BA5A3CF3B5BA96E535012A05F200020000000000000004
```
### check liquidity
```
runmethod ibalance_of 0 <addr>
```



