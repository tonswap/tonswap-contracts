# Tonswap - FunC smart contracts

## Work in progress!

> This project is still experimental and in an ongoing research phase.

## Overview

Tonswap is a DEX/AMM using the Uniswap V2 curve (a financial model shared by many popular AMMs like PancakeSwap, QuickSwap, Sushi) to create liquidity pairs and allow liquidity providers to supply liquidity and traders to swap tokens.

The project depends on an unofficial implementation for [TRC20](https://github.com/cod1ng-studio/TRC20) (which is not yet distributed and will probably change as the fungibe token standard gets developed).

## Develop

### Compile contract and run Fift tests

This project depends on the executables **fift**, **func** and **lite-client**. You can build them from [source](https://ton.org/docs/#/howto/getting-started), use [tncli](https://github.com/disintar/tncli) or run `pip install tncli`. After installing **fift** and **func**, copy or symlink the executables to the root folder `ln -s ~/src/func ./func` and `ln -s ~/src/fift ./fift`

### Run tests

`npm run test-dex`, for non npm users just run `./scripts/test-dex.sh`

### Telegram bot as user interface

The telegram bot serves as a UI which you can interact with AMM, The bot supports commands such as swap , balance , liquidity stats.

Run `npm install` to install npm dependencies.

Run `npm run bot` to launch bot, you will need config.json

## Roadmap

- [X] - Basic Bot with TRC20 interaction
- [X] - AMM with 0.03% Fees 
- [X] - Add Liquidity + Fift Tests
- [X] - Remove Liquidity + Fift Tests
- [X] - Swap TON -> Token and Token -> TON Tests (based on Uniswap)
- [X] - Swap Tests in Fift
- [X] - Masterchef with rewards 
- [X] - Masterchef Rewards with Tests 
- [ ] - Deploy Contract to mainnet
- [ ] - Connect Bot to mainnet
- [ ] - Add Masterchef functionality with auto stake and auto withdraw inside the contract

### Demo video

[![Bot](https://i.ibb.co/cDtCYFd/Group-25.png)](https://drive.google.com/file/d/1m3QnCtsUbTdbuAq2_Y7D2l1tr-6kibM2/view?usp=sharing)
