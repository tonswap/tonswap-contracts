# Tonswap - FunC Smart Contracts

## Work in progress!

> This project is still experimental and in an ongoing research phase.

## Overview

Tonswap is a DEX/AMM using the Uniswap V2 curve (a financial model shared by many popular AMMs like PancakeSwap, QuickSwap, Sushi) to create liquidity pairs and allow traders to swap tokens and liquidity providers to supply liquidity and earn rewards.

The project depends on an unofficial implementation for [TRC20](https://github.com/cod1ng-studio/TRC20) (which is not yet distributed and will probably change as the fungibe token standard gets developed).

## Develop

run `npm install`

### Compile contract and run Fift tests

This project depends on the executables **fift**, **func** and **lite-client**. You can build them from [source](https://ton.org/docs/#/howto/getting-started), use [tncli](https://github.com/disintar/tncli) or run `pip install tncli`. After installing **fift** and **func**, copy or symlink the executables to the root folder `ln -s ~/src/func ./func` and `ln -s ~/src/fift ./fift`



### Run tests
the project uses [ton-contract-executor](https://github.com/tonwhales/ton-contract-executor) package to run Jest based tests.
Use `npm run test` to execute the test suite.

## Roadmap

- [X] Basic Bot with TRC20 interaction
- [X] AMM with 0.03% Fees 
- [X] Add Liquidity + Fift Tests
- [X] Remove Liquidity + Fift Tests
- [X] Swap TON -> Token and Token -> TON Tests (based on Uniswap)
- [X] Swap Tests in Fift
- [X] Masterchef with rewards 
- [ ] Masterchef Rewards with Tests 
- [ ] Send receipt based on TRC20
- [ ] Deploy Contract to mainnet
- [ ] Connect Bot to mainnet
- [ ] Add Masterchef functionality with auto stake and auto withdraw inside the contract


