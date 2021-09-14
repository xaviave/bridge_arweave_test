# Bridge Proposal

Allowing PST transfering from different Blockchain while keeping PST properties and ownership.
___

## Operating mode

### Converting AR PST to ETH or SOL PST:

1. Owner send PST amount to `Arweave Smart Contract`, this amount is subtracted from the Owner's wallet.
2. PST amount is transfered and locked under the `Target addr` (maybe use tags for ticker saving or parse addr format) in `Arweave Smart Contract` state's balance allowing `Smartweave.selectWeightedPstHolder()` to work.
3. PST amount is minted under a `wrapped PST` (custom token) in the target's `Blockchain Smart Contrat`.

### Converting ETH or SOL PST:

1. Owner burns `wrapped PST` amount in actual Blockchain.
2. Owner's address is unlock in `AR Smart Contract` and PST amount is subtract.
3. PST amount is transfered to `Target wallet` if exists else create one.

### Selling wrapped PST in ETH or SOL:

1. Owner transfers `wrapped PST` to target.
2. Owner's balance is update in `AR Smart Contract` locked balance state.
3. Target's addr is created or update in `AR Smart Contract` as locked balance.
