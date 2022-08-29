import BN from "bn.js";
import { Address, beginCell, Cell, contractAddress, InternalMessage, toNano, WalletV1R2Source } from "ton";
import { SmartContract } from "ton-contract-executor";
import { TvmBus, iTvmBusContract } from "ton-tvm-bus";

const walletV3Code = Cell.fromBoc(
    "B5EE9C724101010100710000DEFF0020DD2082014C97BA218201339CBAB19F71B0ED44D0D31FD31F31D70BFFE304E0A4F2608308D71820D31FD31FD31FF82313BBF263ED44D0D31FD31FD3FFD15132BAF2A15144BAF2A204F901541055F910F2A3F8009320D74A96D307D402FB00E8D101A4C8CB1FCB1FCBFFC9ED5410BD6DAD"
)[0];

export class Wallet implements iTvmBusContract {
    contract: SmartContract;
    address: Address;

    private constructor(contract: SmartContract, myAddress: Address, tvmBus: TvmBus, balance: BN) {
        this.contract = contract;
        this.address = myAddress;
        tvmBus.registerContract(this);
        contract.setC7Config({
            balance,
            myself: myAddress,
        });
    }

    async sendInternalMessage(message: InternalMessage) {
        //@ts-ignore
        return this.contract.sendInternalMessage(message);
    }

    static async Create(tvmBus: TvmBus, balance = toNano(10), publicKey = new BN(0), walletId = 0) {
        const dataCell = beginCell().storeUint(0, 32).storeUint(walletId, 32).storeBuffer(publicKey.toBuffer()).endCell();
        const contract = await SmartContract.fromCell(walletV3Code, dataCell, {
            getMethodsMutate: true,
        });
        const myAddress = contractAddress({ workchain: 0, initialCode: walletV3Code, initialData: dataCell });
        return new Wallet(contract, myAddress, tvmBus, balance);
    }
}
