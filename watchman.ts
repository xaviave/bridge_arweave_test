/*

need to write wainting transaction function in contract

refechir a si un state est ecrit mais refuse par un watchman qui paye?

*/
import fs = require('fs');
import Arweave = require('arweave');
import { JWKInterface } from 'arweave/node/lib/wallet';
import Smartweave = require('smartweave');
import Wallets from 'arweave/node/wallets';
import { raw } from 'body-parser';

const arweave = Arweave.init({
    host: 'arweave.net',
    protocol: 'https',
    port: 443
});

interface Contract {
    ticker: string,
    contract_id: string,
}

interface WaitingTx {
    owner: string,
    target: string,
    qty: number,
    ticker: string,
    target_ticker: string
}

interface State {
    waiting_txs: WaitingTx[],
}

const contract_GMX: Contract = {"ticker": "GMX", "contract_id": ""};
const contract_XAV: Contract = {"ticker": "XAV", "contract_id": ""};
const watchman_wallet_filepath: string = "";

function get_jwk_wallet_from_file(wallet_filepath: string): JWKInterface {
    const file_wallet: string = fs.readFileSync(wallet_filepath, 'utf8');
    const wallet: JWKInterface = JSON.parse(file_wallet) as JWKInterface;
    return (wallet);
}

function get_jwk_wallet_from_key(pub_key: string): JWKInterface {
    const wallet_filepath: string = "";
    const file_wallet: string = fs.readFileSync(wallet_filepath, 'utf8');
    
    return (JSON.parse(file_wallet) as JWKInterface);
}

function get_status(tx_id: string): number {
    if (tx_id == "") {
        return (404)
    }
    arweave.transactions.getStatus(tx_id)
    .then(res => {
        console.log("[SUCCESS]: " + JSON.stringify(res, null, 4));
        return (res.status);
    })
    .catch(error => { console.log("[ERROR]: " + error) });
    return (404);
}

function validate_transaction() {
    /*
    get votes from watchmens -> decentralized part
    */
}

async function post_transaction(wtx: WaitingTx) {
    // get a validation function to accept or refuse the tx
    validate_transaction();
    
    // get JWKInterface from tx.owner 
    const owner_wallet: JWKInterface = get_jwk_wallet_from_key(wtx.owner);
    
    const tx = await arweave.createTransaction({ target: wtx.target, quantity: wtx.qty.toString() }, owner_wallet);
    await arweave.transactions.sign(tx, owner_wallet);
    
    while (get_status(tx.id) == 404) {
        await arweave.transactions.post(tx.id);
        await new Promise(f => setTimeout(f, 1000));
    }
}

function process_waiting_transaction(contractState: State, last_state_file: string): number {
    let fee: number = 0;
    let raw_state: string = fs.readFileSync(last_state_file, 'utf-8');
    let last_state_contrat : State = JSON.parse(raw_state);
    fs.writeFile(last_state_file, raw_state, function(err) { if (err) { return console.error(err); } });
    
    let wtx_number: number = Object.keys(contractState.waiting_txs).length;
    for (let i: number = Object.keys(last_state_contrat.waiting_txs).length - 1; i < wtx_number; i++) {
        console.log(contractState.waiting_txs[i]);
        post_transaction(contractState.waiting_txs[i]);
        fee++;
    }
    console.log("__________________________________________________________________");
    return (fee);
}

function watch_contracts(watchman_wallet: JWKInterface): void {
    let fee: number = 0;
    Smartweave.readContract(arweave, contract_GMX.contract_id).then(contractState => {
        fee += process_waiting_transaction(contractState, 'GMX_initial_state.json');
    });
    Smartweave.readContract(arweave, contract_XAV.contract_id).then(contractState => {
        fee += process_waiting_transaction(contractState, 'XAV_initial_state.json');
    });
    // need function to pay the watchman with fees number
}

(async () => {
    const reload_interval: number = 60 * 1000; // 60s
    const gmx_wallet = get_jwk_wallet_from_file(watchman_wallet_filepath);
    
    setInterval(()=> { watch_contracts(gmx_wallet) }, reload_interval);
})()
