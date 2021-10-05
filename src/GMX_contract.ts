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

interface Balance {
    /*
    qty: token holding
    block: number height to unlock stake transfer
    lock: lock the transfer between qty and stake while working as validator
    WIP // age: add additionnal age weight allowing long date honest validator to increase their stake
    */
    qty: number,
    block: number,
    locked: boolean
}

type State = {
    ticker: string,
    balances: Record<string, Balance>,
    waiting_txs: Record<string, WaitingTx>,
};

type Action = {
    input: {
        function: string,
        target?: string,
        qty?: number,
        ticker_target?: string,
        voter?: string,
        timer?: number
    },
    caller: string
};

function transfer_GMX(state: State, caller: string, target: string, qty: number) {
    /*
    ** Transcation from caller wallet to target wallet
    **
    ** caller: wallet id of the interacting account
    ** target: wallet id of the receving account
    ** qty: Winston to transfer
    */

    const balances = state.balances;
    
    if (balances[caller].qty >= qty) {
        if (balances[caller].qty >= qty) {
            balances[caller].qty -= qty;
            if (target in balances) {
                balances[target].qty += qty;
            } else {
                balances[target].qty = qty;
            }
        } else {
            throw new (ContractError as any)(`No enough balance from '${caller}".`);
        }
    } else {
        throw new (ContractError as any)(`No balance from '${caller}" in this contract.`);
    }
}

function transfer_XAV_GMX(state: State, target: string, qty: number) {
    /*
    ** Incomming transcation from validated wiaiting transaction.
    **
    ** target: wallet id of the receving account
    ** qty: Winston to transfer
    */

    const balances = state.balances;
    
    balances["locked"].qty -= qty;
    if (target in balances) {
        balances[target].qty += qty;
    } else {
        balances[target].qty = qty;
    }
}

function transfer_GMX_XAV(state: State, caller: string, target: string, qty: number) {
    /*
    ** Create a waiting transaction to be validated to allow token transfer between contracts/blockchains
    ** Waiting transcation is handle by the validators' votes.
    **
    ** caller: wallet id of the interacting account
    ** target: wallet id of the receving account
    ** qty: Winston to transfer
    */
    
    const balances = state.balances;
    const waiting_txs = state.waiting_txs;
    
    if (caller in balances) {
        if (balances[caller].qty > qty) {
            balances[caller],qty -= qty;
            balances["locked"].qty += qty;
            
            waiting_txs[Smartweave.transaction.id] = {"owner": caller, "target": target, "target_ticker": "XAV", "ticker": "GMX", "qty": qty, "vote": {} as Vote};
        } else {
            throw new (ContractError as any)(`No enough balance from '${caller}'.`);
        }
    } else {
        throw new (ContractError as any)(`No enough balance from '${caller}'.`);
    }
}

function select_winner(state: State, waiting_tx_vote: Vote) {
    let tmp: number = 0
    let total_stake: number = 0
    
    for (let key in waiting_tx_vote.voter) {
        if (waiting_tx_vote.voter[key] > 0) {
            total_stake += state.balances[key].qty;
        }
    }

    let winner_stake: number = Math.floor(Math.random() * total_stake);
    for (let key in waiting_tx_vote.voter) {
        if (waiting_tx_vote.voter[key] > 0) {
            tmp += state.balances[key].qty;
            if (winner_stake < tmp) {
                return key
            }
        }
    }
    return "error";
}

function vote_waiting_transaction(state: State, target: string, voter: string, qty: number) {
    /*
    ** Voting system for validator, allow inter contract/blockchain transaction.
    ** if there is more than the half of min votes, votes are accounting
    ** and the transactiuon is deleted form the waiting transaction if process or not
    **
    ** target: id of the waiting transaction
    ** voter: wallet id of the validator
    ** qty: 1 (authorize) - 0 (forbid)
    */

    // validator that propose a bad transaction receives a slashing penalty else the selected validator receive a reward
    
    const waiting_tx =  state.waiting_txs[target];
    const waiting_tx_vote = waiting_tx.vote;
    
    if (voter in waiting_tx_vote.voter) {
        throw new (ContractError as any)(`'${target}' already vote in this transaction`);
    } else {
        waiting_tx_vote.voter[voter] = qty
    }

    if (waiting_tx_vote.voter.length >= waiting_tx_vote.min_vote) {
        let validator: string = select_winner(state, waiting_tx_vote);
        if (validator === "error" || waiting_tx_vote.voter[validator] === 0) {
            // slashing penalty 120% fee
            state.balances[validator].qty -= SmartWeave.transaction.reward + SmartWeave.transaction.reward * 0.2;
        } else {
            transfer_XAV_GMX(state, waiting_tx.target, waiting_tx.qty);
            // pay validator 110% fee
            state.balances[validator].qty += SmartWeave.transaction.reward + SmartWeave.transaction.reward * 0.1;
        }
        delete state.waiting_txs[target];
    }
    return { state };
}

function balance(state: State, target: string): number {
    ContractAssert(target, ERR_NOTARGET);
    return state.balances[target].qty ?? 0;
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
        
        ContractAssert(state.balances[caller].locked, `'${target}' balance is currently locked. Transfer are not allowed`);
        ContractAssert(state.balances[caller].locked, `'${caller}' balance is currently locked. Transfer are not allowed`);
        ContractAssert(qty, ERR_INTEGER);
        check_transfer_args(caller, target, qty);
        
        if (ticker === "GMX" && ticker_target === "GMX") {
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
        
        ContractAssert(!state.balances[voter].locked, `'${voter}' balance is currently not locked. The vote is not allowed`);
        return vote_waiting_transaction(state, target, voter, qty);
    }
    
    if (input.function == 'lock_balance') {
        const target = input.target!;
        const block_timer = input.timer;

        state.balances[target].locked = true;
        state.balances[target].block = await SmartWeave.block.height + block_timer;
        return { state };
    }
    
    if (input.function == 'unlock_balance') {
        const target = input.target!;

        if (state.balances[target].block < await SmartWeave.block.height) {
            ContractAssert(!state.balances[target].locked, `'${target}' balance is currently not locked. Can't be unlocked since block ${state.balances[target].block} is reached`);
        }
        state.balances[target].locked = false
        return { state };
    }
    
    throw new (ContractError as any)(`No function supplied or function not recognised: "${input.function}".`);
}
