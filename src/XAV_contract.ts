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

interface Vault {
    /*
    qty: token holding
    block: number height to unlock stake transfer
    lock: lock the transfer between qty and stake while working as validator
    WIP // age: add additionnal age weight allowing long date honest validator to increase their stake
    */
    balance: number,
    block: number,
    locked: boolean
}

type State = {
    ticker: string,
    balances: Record<string, number>,
    vault: Record<string, Vault>,
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

function transfer_XAV(state: State, caller: string, target: string, qty: number) {
    /*
    ** Transcation from caller wallet to target wallet
    **
    ** caller: wallet id of the interacting account
    ** target: wallet id of the receving account
    ** qty: Winston to transfer
    */

    const balances = state.balances;
    
    if (caller === "locked") {
        throw new (ContractError as any)(`Not allowed.`);
    }
    if (!(caller in balances)) {
        throw new (ContractError as any)(`No enough balance from '${caller}'.`);
    }
    if (balances[caller] < qty) {
        throw new (ContractError as any)(`No balance from '${caller}' in this contract.`);
    }
    balances[caller] -= qty;
    if (target in balances) {
        balances[target] += qty;
    } else {
        balances[target] = qty;
    }
}

function transfer_GMX_XAV(state: State, target: string, qty: number) {
    /*
    ** Incomming transcation from validated wiaiting transaction.
    **
    ** target: wallet id of the receving account
    ** qty: Winston to transfer
    */
    const balances = state.balances;
    
    balances["locked"] -= qty;
    if (target in balances) {
        balances[target] += qty;
    } else {
        balances[target] = qty;
    }
}

function transfer_XAV_GMX(state: State, caller: string, target: string, qty: number) {
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
        if (balances[caller] > qty) {
            balances[caller] -= qty;
            balances["locked"] += qty;
            
            waiting_txs[Smartweave.transaction.id] = {"owner": caller, "target": target, "target_ticker": "GMX", "ticker": "GMX", "qty": qty, "vote": {} as Vote};
        } else {
            throw new (ContractError as any)(`No enough balance from '${caller}'.`);
        }
    } else {
        throw new (ContractError as any)(`No enough balance from '${caller}'.`);
    }
}

function increase_vault(state: State, caller: string, qty: number) {
    const vault = state.vault;
    const balances = state.balances;

    if (!(caller in balances)) {
        throw new (ContractError as any)(`No enough balance from '${caller}'.`);
    }
    if (balances[caller] < qty) {
        throw new (ContractError as any)(`No balance from '${caller}' in this contract.`);
    }
    if (!(caller in vault)) {
        throw new (ContractError as any)(`'${caller}' is not referenced in vault`);
    }
    if (vault[caller].locked === false) {
        throw new (ContractError as any)(`'${caller}' vault is not lock. Increase vault balance isn't available.`);
    }
    balances[caller] -= qty;
    vault[caller].balance += qty;
}

function select_winner(state: State, waiting_tx_vote: Vote) {
    let tmp: number = 0
    let total_stake: number = 0
    
    for (let key in waiting_tx_vote.voter) {
        if (waiting_tx_vote.voter[key] > 0) {
            total_stake += state.vault[key].balance;
        }
    }

    let winner_stake: number = Math.floor(Math.random() * total_stake);
    for (let key in waiting_tx_vote.voter) {
        if (waiting_tx_vote.voter[key] > 0) {
            tmp += state.vault[key].balance;
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
    
    const vault = state.vault;
    const waiting_txs =  state.waiting_txs[target];
    const waiting_txs_vote = waiting_txs.vote;

    if (!(voter in vault)) {
        throw new (ContractError as any)(`'${voter}' is not referenced in vault. The vote is not allowed`);
    }
    if (vault[voter].locked === false) {
        throw new (ContractError as any)(`'${voter}' vault is not locked. The vote is not allowed`);
    }

    if (voter in waiting_txs_vote.voter) {
        throw new (ContractError as any)(`'${target}' already vote in this transaction`);
    } else {
        waiting_txs_vote.voter[voter] = qty
    }

    if (waiting_txs_vote.voter.length >= waiting_txs_vote.min_vote) {
        let validator: string = select_winner(state, waiting_txs_vote);
        if (validator === "error" || waiting_txs_vote.voter[validator] === 0) {
            // slashing penalty 120% fee
            vault[validator].balance -= SmartWeave.transaction.reward + SmartWeave.transaction.reward * 0.2;
        } else {
            transfer_GMX_XAV(state, waiting_txs.target, waiting_txs.qty);
            // pay validator 110% fee
            vault[validator].balance += SmartWeave.transaction.reward + SmartWeave.transaction.reward * 0.1;
        }
        delete state.waiting_txs[target];
    }
}

function balance_vault(state: State, target: string): number {
    ContractAssert(target, ERR_NOTARGET);
    return state.vault[target].balance ?? 0;
}

function balance(state: State, target: string): number {
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
        
        if (ticker === "XAV" && ticker_target === "XAV") {
            transfer_XAV(state, caller, target, qty);
        } else if (ticker === "XAV" && ticker_target === "GMX") {
            transfer_XAV_GMX(state, caller, target, qty);
        } else {
            throw new (ContractError as any)(`No transfer allowed between: 'XAV' and '${ticker_target}'.`);
        }
        return { state };
    }
    
    if (input.function == 'balance') {
        const target = input.target!;
        const ticker = state.ticker;
        
        if (ticker !== "XAV") {
            throw new (ContractError as any)(ERR_TICKER);
        }
        return { result: { target: ticker, balance: balance(state, target) } }
    }
    
    if (input.function == 'balance_vault') {
        const target = input.target!;
        const ticker = state.ticker;
        
        if (ticker !== "XAV") {
            throw new (ContractError as any)(ERR_TICKER);
        }
        return { result: { target: ticker, balance_vault: balance_vault(state, target) } }
    }

    if (input.function == 'lock_vault') {
        const qty = input.qty!;
        const vault = state.vault;
        const block_timer =  await SmartWeave.block.height + input.timer;

        if (caller in vault) {
            vault[caller] = {} as Vault;
        }
        state.vault[caller].locked = true;
        state.vault[caller].block = block_timer;
        increase_vault(state, caller, qty)
        return { state };
    }
    
    if (input.function == 'unlock_vault') {
        // trasnfer vault balance to caller balance and destroy vault
        const vault = state.vault
        const balances = state.balances;

        if (state.vault[caller].block < await SmartWeave.block.height) {
            throw new (ContractError as any)(`'${caller}' vault is currently locked. Can't be unlocked since block ${vault[caller].block} is reached`);
        }
        balances[caller] += vault[caller].balance;
        delete vault[caller];
        return { state };
    }
        
    if (input.function == 'increase_vault') {
        const qty = input.qty!;

        increase_vault(state, caller, qty)
        return { state };
    }

    if (input.function == 'vote') {
        const qty = input.qty!;
        const voter = input.voter!;
        const target = input.target!;
        
        vote_waiting_transaction(state, target, voter, qty);
        return { state };

    }
    
    throw new (ContractError as any)(`No function supplied or function not recognised: "${input.function}".`);
}
