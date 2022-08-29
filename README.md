# Cactus TBW

## How to install
To install the tbw just run: `solar plugin:install https://github.com/Cactus-15-49/cactus-tbw.git` .  
Once installed, run `solar tbw:enable` to enable TBW and run `solar tbw:configure` to configure the TBW.  
Once configured, restart core and you should see `Delegates configured for true block weight: [delegate name]`.  
If you want to set a starting height, you can run `solar tbw:database set_start [height]`. Please bear in mind that this command will temporarily stop core and do a rollback.  
To run the payout, just use `solar tbw:pay`. The run can be executed automatically by running the command through a cronjob.
## Modes
0. **Classic** : Classic mode is the standard mode of TBW. The rewards are based only on the weight of voters at the time of forging.
1. **Every** : The rewards are calculated considering the weight of the voters on **all** blocks, including the one you are not forging. For this mode, fidelity will not consider the weight on the past blocks but only if the vote was cast or not.
2. **Min** : The rewards are calculated based on the minimum weight every voter had during every round.
3. **Last** : The rewards are calculated based on the weight every voter had on the last block of every round.

## Config file
The config file is located in `$HOME/.local/share/solar-core/{NETWORK}/tbw/config.json`. The file can be edited manually or through CLI commands. The latter way is advised as an invalid configuration will cause the TBW to stop working.

- **blacklist** : List of addresses you want to exclude from the payout. Their weight will not be considered during payout.
- **routes** : Object with addresses as key and values called respectively source and destination used when you want to redirect a payout of an address (source) to another address (destination).
- **whitelist** : List of addresses you want to exclusively pay. Any other address not in this array will not be included in the payout. Leave empty to disable whitelist.
- **sharing** : The percentage of the rewards you want to share with voters. It's a number between 0 and 100.
- **extraFee**: The percent to add on top of the minimal fee for payout transactions to avoid not being forged during congestions. It's a number between 0 and 100.
- **max** : Cap for weight. Any weight exceeding the max cap will be ignored. `null` for none.
- **min** : Min weight to be eligeble to receive rewards. `null` for none.
- **memo** : Memo to include in the payout transactions. Empty string for none.
- **payFees** : Either pay or keep rewards from transaction fees. It can be either y or n.
- **reserve** : An object with addresses as keys and a percentage as values specifying what percentage of the delegate rewards go to which addresses. The sum of all percentages has to be 100.
- **pp1** : First passphrases of the delegate.
- **pp2** : Second passphrase of the delegate. `null` for none.
- **fidelity** : Number of blocks required for an address to be voting before receiving rewards. Behaviour may vary depending on the mode.
- **mode** : Mode of operation for calculating rewards. See [Modes](#modes).

## CLI commands
### `tbw:blacklist`
- Show the current blacklist.
- add [address] : Add a new address to the blacklist.
- remove [address] : Remove an existing address from the blacklist.
- disable: Empty and disable the blacklist.
### `tbw:configure`
- Configure TBW script. Any existing configuration will be overwritten.
### `tbw:disable`
- Disable the TBW plugin. Core must be restarted to completely disable.
### `tbw:enable`
- Enable the TBW plugin. Core must be restarted.
### `tbw:extra_fee`
- Show the current extra fee.
- [value] : Set a new extra fee. `value` must be a number between 0 and 100.
### `tbw:fidelity`
- Show the current fidelity.
- [value] : Set a new fidelity. `value` must be a number bigger than 0 or 0 for disabling.
### `tbw:max`
- Show the current max cap.
- [value] : Set a new max cap. `value` must be a number bigger than 0 or 0 for disabling.
### `tbw:memo`
- Show the current memo.
- [value] : Set a new memo. `value` must be a string.
### `tbw:min`
- Show the current min cap.
- [value] : Set a new min cap. `value` must be a number bigger than 0 or 0 for disabling.
### `tbw:mode`
- Show the current mode.
- [value] : Set a new mode. `value` must be either classic, every, min or last.
### `tbw:passphrase`
- Set the new passphrases (Changing the first passphrase will empty the block table of the TBW database). Use flags `pp1` or `pp2` to selectively change only one of the 2 passphrases.
### `tbw:pay`
- Run the payout.
### `tbw:pay_fees`
- Show the current payFees option.
- [value] : Set a new payFees option. `value` must be either y or n.
### `tbw:reserve`
- Show the current reserve.
- set [value] : Set a new reserve. `value` must be a correctly formatted string `addr1:80,addr2:20` where `addr` is the reserve address and the number is the percentage of the total reserve to send to that address. The sum of all percentages must be 100.
### `tbw:routes`
- Show the current routes.
- add [source address] [destination address] : Add a new source/destination to routes.
- remove [source address] : Remove an existing source from routes.
- disable: Empty and disable routes.
### `tbw:sharing`
- Show the current sharing percentage.
- [value] : Set a new sharing percentage. `value` must be a number between 0 and 100.
### `tbw:unconfirmed`
- Show all the currently unconfirmed transactions.
- show [id]: Show details of one of the unconfirmed transactions 
- replay [id] : Replay one of the unconfimed transactions.
### `tbw:whitelist`
- Show the current whitelist.
- add [address] : Add a new address to the whitelist.
- remove [address] : Remove an existing address from the whitelist.
- disable: Empty and disable the whitelist.
