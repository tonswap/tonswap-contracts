# Tonswap - FunC Smart Contracts

## Work in progress!

> This project is still experimental and in an ongoing research phase.

## Overview

Tonswap is a DEX/AMM using the Uniswap V2 curve (a financial model shared by many popular AMMs like PancakeSwap, QuickSwap, Sushi) to create liquidity pairs and allow traders to swap tokens and liquidity providers to supply liquidity and earn rewards.

The project depends on an Jetton standart implementation for [Jetton](https://github.com/ton-blockchain/token-contract/tree/jettons/ft).

## Develop

run `npm install`

### Compile contract and run Fift tests

This project depends on the executables **fift**, **func** and **lite-client**. You can build them from [source](https://ton.org/docs/#/howto/getting-started), use [tncli](https://github.com/disintar/tncli) or run `pip install tncli`. After installing **fift** and **func**, copy or symlink the executables to the root folder `ln -s ~/src/func ./func` and `ln -s ~/src/fift ./fift`

### Run tests

the project uses [ton-contract-executor](https://github.com/tonwhales/ton-contract-executor) package to run Jest based tests.
Use `npm run test` to execute the test suite.

## Roadmap

-   [x] Basic Bot with TRC20 interaction
-   [x] AMM with 0.03% Fees
-   [x] Add Liquidity + Fift Tests
-   [x] Remove Liquidity + Fift Tests
-   [x] Swap TON -> Token and Token -> TON Tests (based on Uniswap)
-   [x] Swap Tests in Fift
-   [x] Masterchef with rewards
-   [x] Masterchef Rewards with Tests
-   [x] Add Masterchef functionality with auto stake and auto withdraw inside the contract
-   [ ] Gas Optimizations
-   [x] Move to Jetton architecture

-   [x] migrate add liquidity to uniswap
-   [x] declare the exact ton amount to swap on ton-token swap , ensure gas is sufficient
-   [x] Add Liquidity should validate sufficient gas for minting LP contract , so liquidity slippage check should include it.
-   [x] Write end to end script that deploys on test/main-net
-   [x] enforce overflows in price calculation
-   [x] upgrade to latest npm ton
-   [ ] Connect Bot to mainnet
-   [ ] Connect Web app
