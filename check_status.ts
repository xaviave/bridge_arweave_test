import Arweave = require('arweave');

const arweave = Arweave.init({
  host: 'arweave.net',
  protocol: 'https',
  port: 443
});

const tx_id: string = 'uzeI6A6dqoRpzBFHy5acTQM3f0-Qu3KuR2f2Q67e2aE'

arweave.transactions.getStatus(tx_id)
.then(res => {
  console.log("[SUCCESS]: " + JSON.stringify(res, null, 4));
})
.catch(error => { console.log("[ERROR]: " + error) });
