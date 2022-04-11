

echo "running wallet-v3.fif (wallet query build) <pk.file> <dest_address> <subwallet_id> <seqno> <TON_gr> ? -B <boc-to-deploy>"

./fift -s fift-deployments/wallet-v3.fif  liyi kQD1SZW415G1d4EyMCSo6pK5VBKxcjDBpOrFOcBTr9rz6w0O  698983191 309 0.1 -B SUSHI.boc deploy-sushi
./lite-client -C global.config.json -c "sendfile memonic-test/deploy-sushi.boc"