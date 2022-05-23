export enum OPS {
    Transfer = 0xf8a7ea5,
    Transfer_notification = 0x7362d09c,
    Internal_transfer = 0x178d4519,
    Excesses = 0xd53276db,
    Burn = 0x595f07bc,
    Burn_notification = 0x7bdd97de,
    ADD_LIQUIDITY = 22,
    REMOVE_LIQUIDITY = 23,
    SWAP_TOKEN = 24,
    SWAP_TON = 25,
    ClaimRewards = 0x5a3e000,
    ClaimRewardsNotification = 0x5a3e001,
}

export enum ERROR_CODES {
    MinAmountOutIsInsufficient = 601,
    ADD_LIQUIDITY_INSUFFICIENT_BALANCE = 103,
    ADD_LIQUIDITY_WRONG_JETTON_SENDER = 76,
}
