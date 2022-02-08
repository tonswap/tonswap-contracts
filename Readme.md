# Tonswap

## This project is TRC20 + AMM built in, including Liquidity Pool and fees
This project tries to combine a [TRC20](https://github.com/cod1ng-studio/TRC20) based and an AMM [uniswap](https://github.com/Uniswap/v2-core) 

### Compile Contract and RUN Fift Tests
In order to run this project you need a this binaris **fift** **func** and **lite-client** , you can install from [source](https://ton.org/docs/#/howto/getting-started) or use [tncli](https://github.com/disintar/tncli) or just run `pip install tncli` 

after you installing **fift** and **func** copy or symlink the binaries to root folder `ln -s ~/src/func ./func` and `ln -s ~/src/fift ./fift`

### Run Tests
`npm run test-dex`  for non npm users just run `./scripts/test-dex.sh`

### Telegram bot as user interface
The telegram bot serves as a UI which you can interact with AMM, The bot supports commands such as swap , balance , liquidity stats.

Run `npm install` to install npm dependencies
and just `npm run bot`

[![Bot](https://i.ibb.co/cDtCYFd/Group-25.png)](https://drive.google.com/file/d/1m3QnCtsUbTdbuAq2_Y7D2l1tr-6kibM2/view?usp=sharing)


### Roadmap

### Phase I
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
