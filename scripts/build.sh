#!/bin/bash


./func -APSR -o build/lp.fif ../ton/crypto/smartcont/stdlib.fc  ./src/dex.fc
if [[ $? -ne 0 ]] ; then
    echo "  ============ ########################### ===================="
    echo "  ============ Compliation failed !!!!!!!!   ==================== "
    echo "  ============ ########################### ===================="


    exit 0
fi