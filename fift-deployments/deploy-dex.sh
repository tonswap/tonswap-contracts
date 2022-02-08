#!/bin/bash
version="$1"

## build run test 
npm run test-dex
## build 
./fift -s fift-deployments/dex.fif 0 addresses/USDC.addr addresses/KILO.addr keys/doron-wallet.addr DEX-$version > DEX-$version.txt 

echo "File built  => DEX-$version future address is in file ./DEX-$version.txt"
## deploy on chain 
./lite-client -C global.config.json -c "sendfile DEX-$version.boc"

echo "Deployed DEX-$version "
cp "DEX-$version.addr" ./addresses        

echo "Moved  DEX-$version.addr to  ./addresses"

echo 'reanme $DEX address to new address';

echo "Fund account \n /transfer $KILO DEX-$version.addr 0.5 \n /transfer $USDC DEX-$version.addr 0.5"
echo "Now Swap /swap $USDC DEX-$version.addr 0.03 0.025"