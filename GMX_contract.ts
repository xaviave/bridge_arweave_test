const ERR_NOQTY = "No qty specified";
const ERR_NOTARGET = "No target specified";
const ERR_INTEGER = "Invalid value. Must be an integer";

declare function ContractError(e: string): void;
declare function ContractAssert(cond: any, e: string): asserts cond;

interface WaitingTx {
    owner: string,
    target: string,
    qty: number,
    ticker: string,
    target_ticker: string
}

type State = {
    balances: Record<string, number>,
    waiting_txs: Record<string, WaitingTx>,
};

type Action = {
    input: {
        function: string,
        target?: string,
        ticker_target?: string,
        ticker: string,
        qty?: number,
        approved?: boolean,
    },
    caller: string,
};

function transfer_GMX(state: State, caller: string, target: string, qty: number) {
    const balances = state.balances;
    
    balances[caller] -= qty;
    if (target in balances) {
        balances[target] += qty;
    } else {
        balances[target] = qty;
    }
}

function transfer_XAV_GMX(state: State, caller: string, target: string, qty: number) {
    const balances = state.balances;
    
    balances[caller] -= qty;
    balances["locked"] += qty;
}

function transfer_GMX_XAV(state: State, caller: string, target: string, qty: number) {
    const balances = state.balances;
    const waiting_txs = state.waiting_txs;
    
    balances["locked"] -= qty;
    if (target in balances) {
        balances[target] += qty;
    } else {
        balances[target] = qty;
    }
    waiting_txs[Object.keys(waiting_txs).length] = {"owner": caller, "target": target, "target_ticker": "XAV", "ticker": "GMX", "qty": qty};
}

function balance(state: State, target: string): number {
    // get locked token balance with "locked" as target
    ContractAssert(target, ERR_NOTARGET);
    return state.balances[target] ?? 0;
}

function check_transfer_args(caller: string, target: string, qty: number) {
    ContractAssert(qty, ERR_NOQTY);
    ContractAssert(qty > 0, "Invalid value for qty. Must be positive");
    ContractAssert(target, ERR_NOTARGET);
    ContractAssert(target !== caller, "Target must be different from the caller");
}

export async function handle(state: State, action: Action): Promise<{state?: State, result?:unknown}> {
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
        } else if (ticker === "GMX" && ticker_target === "GMX") {
            transfer_GMX(state, caller, target, qty);
        } else if (ticker === "GMX" && ticker_target === "XAV") {
            transfer_GMX_XAV(state, caller, target, qty);
        } else {
            throw new (ContractError as any)(`No transfer allowed between: 'GMX' and '${ticker_target}".`);
        }
        return { state };
    }
    
    if (input.function == 'balance') {
        const target = input.target;
        const ticker = input.ticker;
        
        if (ticker !== "GMX") {
            throw new (ContractError as any)(`The balance ticker is not allowed.`);
        }
        return { result: { target: ticker, balance: balance(state, target) } }
    }
    
    throw new (ContractError as any)(`No function supplied or function not recognised: "${input.function}".`);
}
