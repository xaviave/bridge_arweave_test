const ERR_NOQTY = "No qty specified";
const ERR_NEGQTY = "Invalid value for qty. Must be positive";
const ERR_NOTARGET = "No target specified";
const ERR_INTEGER = "Invalid value. Must be an integer";
const ERR_TICKER = "The balance ticker is not allowed.";

declare function ContractError(e: string): void;
declare function ContractAssert(cond: any, e: string): asserts cond;

interface Vote {
    min_vote: number,
    voter: Record<string, number>
}

interface WaitingTx {
    owner: string,
    target: string,
    qty: number,
    ticker: string,
    target_ticker: string
    vote: Vote
}

type State = {
    ticker: string,
    balances: Record<string, number>,
    waiting_txs: Record<string, WaitingTx>,
};

type Action = {
    input: {
        function: string,
        target?: string,
        ticker_target?: string,
        qty?: number,
        voter?: string,
    },
    caller: string
};

function transfer_GMX(state: State, caller: string, target: string, qty: number) {
    const balances = state.balances;
    
    if (balances[caller] >= qty) {
        if (balances[caller] >= qty) {
            balances[caller] -= qty;
            if (target in balances) {
                balances[target] += qty;
            } else {
                balances[target] = qty;
            }
        } else {
            throw new (ContractError as any)(`No enough balance from '${caller}".`);
        }
    } else {
        throw new (ContractError as any)(`No balance from '${caller}" in this contract.`);
    }
}

function transfer_XAV_GMX(state: State, target: string, qty: number) {
    const balances = state.balances;
    
    balances["locked"] -= qty;
    if (target in balances) {
        balances[target] += qty;
    } else {
        balances[target] = qty;
    }
}

function transfer_GMX_XAV(state: State, caller: string, target: string, qty: number) {
    const balances = state.balances;
    const waiting_txs = state.waiting_txs;
    
    if (caller in balances) {
        if (balances[caller] > qty) {
            balances[caller] -= qty;
            balances["locked"] += qty;
            // need a hash for this not just a number
            waiting_txs[Object.keys(waiting_txs).length] = {"owner": caller, "target": target, "target_ticker": "XAV", "ticker": "GMX", "qty": qty, "vote": {} as Vote};
        } else {
            throw new (ContractError as any)(`No enough balance from '${caller}'.`);
        }
    } else {
        throw new (ContractError as any)(`No enough balance from '${caller}'.`);
    }
}

function vote_wainting_transaction(state: State, target: string, voter: string, qty: number) {
    const waiting_tx =  state.waiting_txs;
    const waiting_tx_vote = waiting_tx.vote;

    if (voter in waiting_tx_vote.voter) {
        throw new Error(`'${target}' already vote in this transaction`);
    } else {
        waiting_tx_vote.voter[voter] = qty;
    }
    if (waiting_tx_vote.voter.length > waiting_tx_vote.min_vote) {
        console.log("ahhh");
    }
}

function balance(state: State, target: string): number {
    // get locked token balance with "locked" as target
    ContractAssert(target, ERR_NOTARGET);
    return state.balances[target] ?? 0;
}

function check_transfer_args(caller: string, target: string, qty: number) {
    ContractAssert(qty, ERR_NOQTY);
    ContractAssert(qty > 0, ERR_NEGQTY);
    ContractAssert(target, ERR_NOTARGET);
    ContractAssert(target !== caller, "Target must be different from the caller");
}

export async function handle(state: State, action: Action): Promise<{state?: State, result?:unknown}> {
    const input = action.input;
    const caller = action.caller;
    
    if (input.function == 'transfer') {
        const target = input.target!;
        const ticker = state.ticker;
        const ticker_target = input.ticker_target;
        const qty = input.qty;
        
        ContractAssert(qty, ERR_INTEGER);
        check_transfer_args(caller, target, qty);
        
        if (ticker === "XAV" && ticker_target === "GMX") {
            transfer_XAV_GMX(state, target, qty);
        } else if (ticker === "GMX" && ticker_target === "GMX") {
            transfer_GMX(state, caller, target, qty);
        } else if (ticker === "GMX" && ticker_target === "XAV") {
            transfer_GMX_XAV(state, caller, target, qty);
        } else {
            throw new (ContractError as any)(`No transfer allowed between: 'GMX' and '${ticker_target}'.`);
        }
        return { state };
    }
    
    if (input.function == 'balance') {
        const target = input.target!;
        const ticker = state.ticker;
        
        if (ticker !== "GMX") {
            throw new (ContractError as any)(ERR_TICKER);
        }
        return { result: { target: ticker, balance: balance(state, target) } }
    }
    
    if (input.function == 'vote') {
        const target = input.target!;
        const voter = input.voter!;
        const qty = input.qty!;
        
        vote_wainting_transaction(state, target, voter, qty);
    }
    throw new (ContractError as any)(`No function supplied or function not recognised: "${input.function}".`);
}
