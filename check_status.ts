import Arweave = require('arweave');

const arweave = Arweave.init({
  host: 'arweave.net',
  protocol: 'https',
  port: 443
});

const tx_id: string = 'pWPg4kf2P8_thUMgijjy19FL91OdZ7UCmvjM2MpdmIU'

arweave.transactions.getStatus(tx_id)
.then(res => {
  console.log("[SUCCESS]: " + JSON.stringify(res, null, 4));
})
.catch(error => { console.log("[ERROR]: " + error) });

// how verto get fee from transaction

