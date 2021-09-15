import Arweave = require('arweave');

const arweave = Arweave.init({
  host: 'arweave.net',
  protocol: 'https',
  port: 443
});

const tx_id: string = 'eNNwRcwhMSO8enkaSKjvghV9Td2mDvKC0fDaS7YXI-s'

arweave.transactions.getStatus(tx_id)
.then(res => {
  console.log("[SUCCESS]: " + JSON.stringify(res, null, 4));
})
.catch(error => { console.log("[ERROR]: " + error) });

