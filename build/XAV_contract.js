"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handle = void 0;
const ERR_NOQTY = "No qty specified";
const ERR_NEGQTY = "Invalid value for qty. Must be positive";
const ERR_NOTARGET = "No target specified";
const ERR_INTEGER = "Invalid value. Must be an integer";
const ERR_TICKER = "The balance ticker is not allowed.";
function transfer_XAV(state, caller, target, qty) {
    const balances = state.balances;
    if (balances[caller].qty >= qty) {
        if (balances[caller].qty >= qty) {
            balances[caller].qty -= qty;
            if (target in balances) {
                balances[target].qty += qty;
            }
            else {
                balances[target].qty = qty;
            }
        }
        else {
            throw new ContractError(`No enough balance from '${caller}".`);
        }
    }
    else {
        throw new ContractError(`No balance from '${caller}" in this contract.`);
    }
}
function transfer_GMX_XAV(state, target, qty) {
    const balances = state.balances;
    balances["locked"].qty -= qty;
    if (target in balances) {
        balances[target].qty += qty;
    }
    else {
        balances[target].qty = qty;
    }
}
function transfer_XAV_GMX(state, caller, target, qty) {
    const balances = state.balances;
    const waiting_txs = state.waiting_txs;
    if (caller in balances) {
        if (balances[caller].qty > qty) {
            balances[caller], qty -= qty;
            balances["locked"].qty += qty;
            waiting_txs[Smartweave.transaction.id] = { "owner": caller, "target": target, "target_ticker": "GMX", "ticker": "GMX", "qty": qty, "vote": {} };
        }
        else {
            throw new ContractError(`No enough balance from '${caller}'.`);
        }
    }
    else {
        throw new ContractError(`No enough balance from '${caller}'.`);
    }
}
function select_winner(state, waiting_tx_vote) {
    let tmp = 0;
    let total_stake = 0;
    for (let key in waiting_tx_vote.voter) {
        if (waiting_tx_vote.voter[key] > 0) {
            total_stake += state.balances[key].qty;
        }
    }
    let winner_stake = Math.floor(Math.random() * total_stake);
    for (let key in waiting_tx_vote.voter) {
        if (waiting_tx_vote.voter[key] > 0) {
            tmp += state.balances[key].qty;
            if (winner_stake < tmp) {
                return key;
            }
        }
    }
    return "error";
}
function vote_waiting_transaction(state, target, voter, qty) {
    const waiting_tx = state.waiting_txs[target];
    const waiting_tx_vote = waiting_tx.vote;
    if (voter in waiting_tx_vote.voter) {
        throw new ContractError(`'${target}' already vote in this transaction`);
    }
    else {
        waiting_tx_vote.voter[voter] = qty;
    }
    if (waiting_tx_vote.voter.length >= waiting_tx_vote.min_vote) {
        let validator = select_winner(state, waiting_tx_vote);
        if (validator === "error" || waiting_tx_vote.voter[validator] === 0) {
            state.balances[validator].qty -= SmartWeave.transaction.reward + SmartWeave.transaction.reward * 0.2;
        }
        else {
            transfer_GMX_XAV(state, waiting_tx.target, waiting_tx.qty);
            state.balances[validator].qty += SmartWeave.transaction.reward + SmartWeave.transaction.reward * 0.1;
        }
        delete state.waiting_txs[target];
    }
    return { state };
}
function balance(state, target) {
    ContractAssert(target, ERR_NOTARGET);
    return state.balances[target].qty ?? 0;
}
function check_transfer_args(caller, target, qty) {
    ContractAssert(qty, ERR_NOQTY);
    ContractAssert(qty > 0, ERR_NEGQTY);
    ContractAssert(target, ERR_NOTARGET);
    ContractAssert(target !== caller, "Target must be different from the caller");
}
async function handle(state, action) {
    const input = action.input;
    const caller = action.caller;
    if (input.function == 'transfer') {
        const target = input.target;
        const ticker = state.ticker;
        const ticker_target = input.ticker_target;
        const qty = input.qty;
        ContractAssert(state.balances[caller].locked, `'${target}' balance is currently locked. Transfer are not allowed`);
        ContractAssert(state.balances[caller].locked, `'${caller}' balance is currently locked. Transfer are not allowed`);
        ContractAssert(qty, ERR_INTEGER);
        check_transfer_args(caller, target, qty);
        if (ticker === "XAV" && ticker_target === "XAV") {
            transfer_XAV(state, caller, target, qty);
        }
        else if (ticker === "XAV" && ticker_target === "GMX") {
            transfer_XAV_GMX(state, caller, target, qty);
        }
        else {
            throw new ContractError(`No transfer allowed between: 'XAV' and '${ticker_target}'.`);
        }
        return { state };
    }
    if (input.function == 'balance') {
        const target = input.target;
        const ticker = state.ticker;
        if (ticker !== "XAV") {
            throw new ContractError(ERR_TICKER);
        }
        return { result: { target: ticker, balance: balance(state, target) } };
    }
    if (input.function == 'vote') {
        const target = input.target;
        const voter = input.voter;
        const qty = input.qty;
        ContractAssert(!state.balances[voter].locked, `'${voter}' balance is currently not locked. The vote is not allowed`);
        return vote_waiting_transaction(state, target, voter, qty);
    }
    if (input.function == 'lock_balance') {
        const target = input.target;
        const block_timer = input.timer;
        state.balances[target].locked = true;
        state.balances[target].block = await SmartWeave.block.height + block_timer;
        return { state };
    }
    if (input.function == 'unlock_balance') {
        const target = input.target;
        if (state.balances[target].block < await SmartWeave.block.height) {
            ContractAssert(!state.balances[target].locked, `'${target}' balance is currently not locked. Can't be unlocked since block ${state.balances[target].block} is reached`);
        }
        state.balances[target].locked = false;
        return { state };
    }
    throw new ContractError(`No function supplied or function not recognised: "${input.function}".`);
}
exports.handle = handle;
