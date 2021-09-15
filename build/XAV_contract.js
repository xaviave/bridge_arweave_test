const ERR_NOQTY = "No qty specified";
const ERR_NOTARGET = "No target specified";
const ERR_INTEGER = "Invalid value. Must be an integer";
function transfer_XAV(state, caller, target, qty) {
    const balances = state.balances;
    balances[caller] -= qty;
    if (target in balances) {
        balances[target] += qty;
    }
    else {
        balances[target] = qty;
    }
}
function transfer_GMX_XAV(state, caller, qty) {
    const balances = state.balances;
    balances[caller] -= qty;
    balances["locked"] += qty;
}
function transfer_XAV_GMX(state, caller, target, qty) {
    const balances = state.balances;
    const waiting_txs = state.waiting_txs;
    balances["locked"] -= qty;
    if (target in balances) {
        balances[target] += qty;
    }
    else {
        balances[target] = qty;
    }
    waiting_txs[Object.keys(waiting_txs).length] = { "owner": caller, "target": target, "target_ticker": "GMX", "ticker": "XAV", "qty": qty };
}
function balance(state, target) {
    ContractAssert(target, ERR_NOTARGET);
    return state.balances[target] ?? 0;
}
function check_transfer_args(caller, target, qty) {
    ContractAssert(qty, ERR_NOQTY);
    ContractAssert(qty > 0, "Invalid value for qty. Must be positive");
    ContractAssert(target, ERR_NOTARGET);
    ContractAssert(target !== caller, "Target must be different from the caller");
}
export async function handle(state, action) {
    const input = action.input;
    const caller = action.caller;
    if (input.function == 'transfer') {
        const target = input.target;
        const ticker = input.ticker;
        const ticker_target = input.ticker_target;
        const qty = input.qty;
        ContractAssert(qty, ERR_INTEGER);
        check_transfer_args(caller, target, qty);
        if (ticker === "XAV" && ticker_target === "GMX") {
            transfer_XAV_GMX(state, caller, target, qty);
        }
        else if (ticker === "XAV" && ticker_target === "XAV") {
            transfer_XAV(state, caller, target, qty);
        }
        else if (ticker === "GMX" && ticker_target === "XAV") {
            transfer_GMX_XAV(state, caller, qty);
        }
        else {
            throw new ContractError(`No transfer allowed between: 'XAV' and '${ticker_target}".`);
        }
        return { state };
    }
    if (input.function == 'balance') {
        const target = input.target;
        const ticker = input.ticker;
        if (ticker !== "XAV") {
            throw new ContractError(`The balance ticker is not allowed.`);
        }
        return { result: { target: ticker, balance: balance(state, target) } };
    }
    throw new ContractError(`No function supplied or function not recognised: "${input.function}".`);
}
