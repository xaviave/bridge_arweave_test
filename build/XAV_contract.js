const ERR_NOQTY = "No qty specified";
const ERR_NEGQTY = "Invalid value for qty. Must be positive";
const ERR_NOTARGET = "No target specified";
const ERR_INTEGER = "Invalid value. Must be an integer";
const ERR_TICKER = "The balance ticker is not allowed.";
function transfer_XAV(state, caller, target, qty) {
    const balances = state.balances;
    if (caller === "locked") {
        throw new ContractError(`Not allowed.`);
    }
    if (!(caller in balances)) {
        throw new ContractError(`No enough balance from '${caller}'.`);
    }
    if (balances[caller] < qty) {
        throw new ContractError(`No balance from '${caller}' in this contract.`);
    }
    balances[caller] -= qty;
    if (target in balances) {
        balances[target] += qty;
    }
    else {
        balances[target] = qty;
    }
}
function transfer_GMX_XAV(state, target, qty) {
    const balances = state.balances;
    balances["locked"] -= qty;
    if (target in balances) {
        balances[target] += qty;
    }
    else {
        balances[target] = qty;
    }
}
function transfer_XAV_GMX(state, caller, target, qty) {
    const balances = state.balances;
    const waiting_txs = state.waiting_txs;
    if (caller in balances) {
        if (balances[caller] > qty) {
            balances[caller] -= qty;
            balances["locked"] += qty;
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
function increase_vault(state, caller, qty) {
    const vault = state.vault;
    const balances = state.balances;
    if (!(caller in balances)) {
        throw new ContractError(`No enough balance from '${caller}'.`);
    }
    if (balances[caller] < qty) {
        throw new ContractError(`No balance from '${caller}' in this contract.`);
    }
    if (!(caller in vault)) {
        throw new ContractError(`'${caller}' is not referenced in vault`);
    }
    if (vault[caller].locked === false) {
        throw new ContractError(`'${caller}' vault is not lock. Increase vault balance isn't available.`);
    }
    balances[caller] -= qty;
    vault[caller].balance += qty;
}
function select_winner(state, waiting_tx_vote) {
    let tmp = 0;
    let total_stake = 0;
    for (let key in waiting_tx_vote.voter) {
        if (waiting_tx_vote.voter[key] > 0) {
            total_stake += state.vault[key].balance;
        }
    }
    let winner_stake = Math.floor(Math.random() * total_stake);
    for (let key in waiting_tx_vote.voter) {
        if (waiting_tx_vote.voter[key] > 0) {
            tmp += state.vault[key].balance;
            if (winner_stake < tmp) {
                return key;
            }
        }
    }
    return "error";
}
function vote_waiting_transaction(state, target, voter, qty) {
    const vault = state.vault;
    const waiting_txs = state.waiting_txs[target];
    const waiting_txs_vote = waiting_txs.vote;
    if (!(voter in vault)) {
        throw new ContractError(`'${voter}' is not referenced in vault. The vote is not allowed`);
    }
    if (vault[voter].locked === false) {
        throw new ContractError(`'${voter}' vault is not locked. The vote is not allowed`);
    }
    if (voter in waiting_txs_vote.voter) {
        throw new ContractError(`'${target}' already vote in this transaction`);
    }
    else {
        waiting_txs_vote.voter[voter] = qty;
    }
    if (waiting_txs_vote.voter.length >= waiting_txs_vote.min_vote) {
        let validator = select_winner(state, waiting_txs_vote);
        if (validator === "error" || waiting_txs_vote.voter[validator] === 0) {
            vault[validator].balance -= SmartWeave.transaction.reward + SmartWeave.transaction.reward * 0.2;
        }
        else {
            transfer_GMX_XAV(state, waiting_txs.target, waiting_txs.qty);
            vault[validator].balance += SmartWeave.transaction.reward + SmartWeave.transaction.reward * 0.1;
        }
        delete state.waiting_txs[target];
    }
}
function balance_vault(state, target) {
    ContractAssert(target, ERR_NOTARGET);
    return state.vault[target].balance ?? 0;
}
function balance(state, target) {
    ContractAssert(target, ERR_NOTARGET);
    return state.balances[target] ?? 0;
}
function check_transfer_args(caller, target, qty) {
    ContractAssert(qty, ERR_NOQTY);
    ContractAssert(qty > 0, ERR_NEGQTY);
    ContractAssert(target, ERR_NOTARGET);
    ContractAssert(target !== caller, "Target must be different from the caller");
}
export function handle(state, action) {
    const input = action.input;
    const caller = action.caller;
    if (input.function == 'transfer') {
        const target = input.target;
        const ticker = state.ticker;
        const ticker_target = input.ticker_target;
        const qty = input.qty;
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
    if (input.function == 'balance_vault') {
        const target = input.target;
        const ticker = state.ticker;
        if (ticker !== "XAV") {
            throw new ContractError(ERR_TICKER);
        }
        return { result: { target: ticker, balance_vault: balance_vault(state, target) } };
    }
    if (input.function == 'lock_vault') {
        const qty = input.qty;
        const vault = state.vault;
        const block_timer = await SmartWeave.block.height + input.timer;
        if (caller in vault) {
            vault[caller] = {};
        }
        state.vault[caller].locked = true;
        state.vault[caller].block = block_timer;
        increase_vault(state, caller, qty);
        return { state };
    }
    if (input.function == 'unlock_vault') {
        const vault = state.vault;
        const balances = state.balances;
        if (state.vault[caller].block < await SmartWeave.block.height) {
            throw new ContractError(`'${caller}' vault is currently locked. Can't be unlocked since block ${vault[caller].block} is reached`);
        }
        balances[caller] += vault[caller].balance;
        delete vault[caller];
        return { state };
    }
    if (input.function == 'increase_vault') {
        const qty = input.qty;
        increase_vault(state, caller, qty);
        return { state };
    }
    if (input.function == 'vote') {
        const qty = input.qty;
        const voter = input.voter;
        const target = input.target;
        vote_waiting_transaction(state, target, voter, qty);
        return { state };
    }
    throw new ContractError(`No function supplied or function not recognised: "${input.function}".`);
}
