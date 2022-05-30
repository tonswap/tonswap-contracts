# Tonswap - FunC Smart Contracts

## Work in progress!

> This project is still experimental and in an ongoing research phase.

## Overview

Tonswap is a DEX/AMM using the Uniswap V2 curve (a financial model shared by many popular AMMs like PancakeSwap, QuickSwap, Sushi) to create liquidity pairs and allow traders to swap tokens and liquidity providers to supply liquidity and earn rewards.

The project depends on an Jetton standard implementation for [Jetton](https://github.com/ton-blockchain/token-contract/tree/jettons/ft).

## Develop

run `npm install`

### Compile contract and run Fift tests

This project depends on the executables **fift**, **func** and **lite-client**. You can build them from [source](https://ton.org/docs/#/howto/getting-started), or you can download the [pre compiled binaries](https://github.com/ton-defi-org/ton-binaries/releases).

### Run tests

the project uses [ton-contract-executor](https://github.com/tonwhales/ton-contract-executor) package to run Jest based tests.
Use `npm run test` to execute the test suite.

### Run end to end test on Mainnet or Testnet

`npm run e2e` (this process will generate a deploy wallet during uts execution)

## Roadmap

-   [x] Full functional AMM with 0.03% fees
-   [x] End to end Jest test coverage using [ton-contract-executor](https://github.com/tonwhales/ton-contract-executor)
-   [ ] Gas Optimizations , sender should receive the gas change in the end of the message flows
-   [x] Move to Jetton architecture
-   [x] Add Liquidity should validate sufficient gas for minting LP contract , so liquidity slippage check should include it.
-   [x] Write end to end script that deploys on test/main-net
-   [x] enforce overflows in price calculation
-   [x] upgrade to latest npm ton
-   [x] Connect Bot to mainnet
-   [x] Connect Web app
