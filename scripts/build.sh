#!/bin/bash


./func -APSR -o build/dex.fif ../ton/crypto/smartcont/stdlib.fc  ./src/dex.func
if [[ $? -ne 0 ]] ; then
    echo "  ============ ########################### ===================="
    echo "  ============ Compliation failed !!!!!!!!   ==================== "
    echo "  ============ ########################### ===================="


    exit 0
fi