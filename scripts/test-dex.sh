#!/bin/bash



./func -APSR -o build/dex.fif ../ton/crypto/smartcont/stdlib.fc ./src/dex.fc
if [[ $? -ne 0 ]] ; then
    echo "  ============ ########################### ===================="
    echo "  ============ Compliation failed !!!!!!!!   ==================== "
    echo "  ============ ########################### ===================="


    exit 0
fi


echo "  ============ ########################### ===================="
echo "  ========== CTOR  Compilation completed ==================== "
echo "  ============ ########################### ===================="

# echo " running ./fift -s test/getters.fif"
#echo "  ========== ######## Test -> Getters ########## ===================="
# ./fift -s test/getters.fif
# if [[ $? -ne 0 ]] ; then
#     exit 1
# fi
# echo "  ========== ######## Test -> getters [OK] ########## ===================="





echo "  ========== ######## Test -> DEX-Swaps        ########## ===================="
./fift -s test/dex-suite.fif
if [[ $? -ne 0 ]] ; then
    exit 1
fi
echo "  ========== ######## Test OK -> DEX-Swaps ########## ======================="