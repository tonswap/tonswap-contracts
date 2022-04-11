#!/bin/bash


./func -APSR -o build/trc20.fif ../ton/crypto/smartcont/stdlib.fc  ./src/trc20-mint.func ./src/msg_hex_comment.func
if [[ $? -ne 0 ]] ; then
    echo "  ============ ########################### ===================="
    echo "  ============ Compliation failed !!!!!!!!   ==================== "
    echo "  ============ ########################### ===================="
    exit 0
fi