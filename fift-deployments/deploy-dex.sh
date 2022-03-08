#!/bin/bash
version="$1"

## build run test 
npm run test-dex
## build
./fift -s fift-deployments/dex.fif 0 KILO.addr owner.addr 500 USDC.addr 0 DEX LP > DEX-$version.txt

echo "File built  => DEX-$version future address is in file ./DEX-$version.txt"

## deploy on chain 
./lite-client -C global.config.json -c "sendfile DEX-$version.boc"

echo "Deployed DEX-$version "
cp "DEX-$version.addr" ./addresses        

echo "Moved  DEX-$version.addr to  ./addresses"
echo 'reanme $DEX address to new address';
echo "Fund account \n /transfer $KILO DEX-$version.addr 0.5 \n /transfer $USDC DEX-$version.addr 0.2"