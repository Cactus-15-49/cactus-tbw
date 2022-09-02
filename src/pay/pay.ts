import { Identities, Interfaces, Managers, Transactions, Utils } from "@solar-network/crypto";
import { Container, Contracts, Providers, Utils as AppUtils } from "@solar-network/kernel";
import delay from "delay";

import { Database } from "../database";
import { blockRewardType, blockType } from "../interfaces";
import { modeFactory } from "./modes/factory";
import { modeHandler } from "./modes/handler";

@Container.injectable()
export class Pay {
    @Container.inject(Container.Identifiers.LogService)
    private readonly logger!: Contracts.Kernel.Logger;

    @Container.inject(Container.Identifiers.WalletRepository)
    @Container.tagged("state", "blockchain")
    private readonly walletRepository!: Contracts.State.WalletRepository;

    @Container.inject(Container.Identifiers.BlockchainService)
    private readonly blockchain!: Contracts.Blockchain.Blockchain;

    @Container.inject(Container.Identifiers.PluginConfiguration)
    @Container.tagged("plugin", "@cactus1549/cactus-tbw")
    private readonly configuration!: Providers.PluginConfiguration;

    @Container.inject(Container.Identifiers.PluginConfiguration)
    @Container.tagged("plugin", "@solar-network/pool")
    private readonly transactionPoolConfiguration!: Providers.PluginConfiguration;

    @Container.inject(Container.Identifiers.PoolProcessor)
    private readonly processor!: Contracts.Pool.Processor;

    private db!: Database;

    public async boot(): Promise<void> {
        this.db = new Database(this.configuration.get("dbPath") as string);
    }

    public async pay(): Promise<void> {
        const settings = this.db.getSettings();
        if (!settings) {
            throw new Error("Settings file not found or invalid");
        }

        const pp = [settings.pp1, settings.pp2];

        if (!pp[0]) {
            throw new Error("No delegate registered");
        }

        const publicKey = Identities.PublicKey.fromPassphrase(pp[0]);
        if (!this.walletRepository.hasByPublicKey(publicKey)) {
            throw new Error("No delegate registered");
        }

        const wallet = this.walletRepository.findByPublicKey(publicKey);
        if (!wallet.isDelegate()) {
            throw new Error("No delegate registered");
        }

        const hasSecondSignature = wallet.hasSecondSignature();
        if (hasSecondSignature) {
            if (!pp[1]) {
                throw new Error("Second passphrase not provided.");
            }

            const secondPublicKey = Identities.PublicKey.fromPassphrase(pp[1]);
            if (secondPublicKey !== wallet.getAttribute<string>("secondPublicKey")) {
                throw new Error("Second passphrase provided does not match the delegate.");
            }
        }

        const username = wallet.getAttribute<string>("delegate.username");

        const { maxHeight, totalToPay, paytable } = this.getPaytable(username);
        const { reserve, memo, extraFee } = settings;

        const transactions: Interfaces.ITransactionData[] = [];

        let nonce = wallet.getNonce().plus(1);
        const balance = wallet.getBalance();
        const milestone = Managers.configManager.getMilestone();
        const transfersMax = milestone.transfer?.maximum || 64;

        const walletsToPay =
            Object.keys(paytable).length +
            Object.keys(reserve).filter((a) => !Object.keys(paytable).includes(a) && reserve[a] > 0).length;

        const transfersRequired = Math.ceil(walletsToPay / transfersMax);
        const transfersInLastTransfer = walletsToPay % transfersMax;

        const fullTransferFee = this.calculateFees(transfersMax, memo, hasSecondSignature, extraFee);

        const lastTransferFee =
            transfersInLastTransfer > 0
                ? this.calculateFees(transfersInLastTransfer, memo, hasSecondSignature, extraFee)
                : fullTransferFee;

        const totalFee = fullTransferFee.times(transfersRequired - 1).plus(lastTransferFee);

        const surplus = balance.minus(totalFee).minus(totalToPay);

        if (surplus.isNegative()) {
            throw new Error("Not enough balance");
        }

        let remainingSurplus = surplus;

        for (const adminAddress of Object.keys(reserve).slice(1)) {
            const payout = surplus.times(reserve[adminAddress]).div(100);
            if (payout.isGreaterThan(0)) {
                paytable[adminAddress] = (paytable[adminAddress] || Utils.BigNumber.ZERO).plus(payout);
                remainingSurplus = remainingSurplus.minus(payout);
            }
        }

        if (remainingSurplus.isGreaterThan(0) && Object.keys(reserve).length > 0) {
            const firstAdmin = Object.keys(reserve)[0];
            paytable[firstAdmin] = (paytable[firstAdmin] || Utils.BigNumber.ZERO).plus(remainingSurplus);
        }

        if (remainingSurplus.isNegative()) {
            throw new Error("Not enough balance to pay reserve (probably misconfiguration)");
        }

        const txChunks = this.chunk(
            this.convert(paytable).filter((p) => !p.balance.isZero()),
            transfersMax,
        );

        for (const chunk of txChunks) {
            const tx = Transactions.BuilderFactory.transfer()
                .nonce(nonce.toString())
                .fee((chunk.length === transfersMax ? fullTransferFee : lastTransferFee).toString())
                .memo(memo);
            for (const payout of chunk) {
                tx.addPayment(payout.address, payout.balance);
            }
            nonce = nonce.plus(1);
            tx.sign(pp[0]);
            if (hasSecondSignature) {
                tx.secondSign(pp[1]!);
            }
            const transaction = tx.getStruct();
            transactions.push(transaction);
            this.db.addHistory(maxHeight, transaction, username);
        }

        const chunks = this.chunk(
            transactions,
            this.transactionPoolConfiguration.get<number>("maxTransactionsPerRequest") || 40,
        );
        for (const chunk of chunks) {
            await this.sendTransaction(chunk);
            await delay(1000);
        }
    }

    public getPaytable(username: string): {
        maxHeight: number;
        totalToPay: Utils.BigNumber;
        paytable: { [key: string]: Utils.BigNumber };
    } {
        const settings = this.db.getSettings();
        if (!settings) {
            throw new Error("Settings file not found or invalid");
        }
        const { blacklist, mode, routes, whitelist, sharing, max: maxCap, min: minCap, fidelity, payFees } = settings;

        const paytable = {};
        let maxHeight = 0;
        let totalToPay = Utils.BigNumber.ZERO;

        const lastHeight = this.db.getLastPayHeight(username);
        const rawBlocks = this.db.getTbwBlocksFromHeight(lastHeight + 1);

        const modeClass = modeFactory.getMode(mode);

        const voters = this.processRawBlocks(rawBlocks, modeClass, minCap, maxCap);

        const forgedBlocks = Object.values(
            voters.reduce((state, curr) => {
                if (!state.some((b) => curr.height === b.height)) {
                    state.push({
                        height: curr.height,
                        rewards: curr.rewards,
                        fees: curr.fees,
                    });
                }
                return state;
            }, [] as blockType[]),
        );

        for (const block of forgedBlocks) {
            this.logger.debug(`---------------------`);
            this.logger.debug(`Block: ${block.height}`);
            this.logger.debug(`Reward: ${block.rewards.toString()}`);
            this.logger.debug(`Fees: ${block.fees.toString()}`);
            this.logger.debug(`Original: ${JSON.stringify(voters.filter((w) => w.height === block.height))}`);

            maxHeight = block.height > maxHeight ? block.height : maxHeight;

            const wallets = voters
                .filter((w) => w.height === block.height)
                .filter((w) => !blacklist.includes(w.address))
                .filter((w) => whitelist.length === 0 || whitelist.includes(w.address))
                .map((w) => {
                    if (fidelity) {
                        const balances = this.db.getAddressBalancesForNPreviousBlocks(
                            w.address,
                            block.height,
                            fidelity,
                        );
                        w.weight = modeClass.handleFidelity(balances, fidelity, w.weight);
                    }
                    if (routes[w.address]) {
                        w.address = routes[w.address];
                    }
                    return w;
                });
            this.logger.debug(`Wallets: ${JSON.stringify(wallets)}`);

            const totalWeight = wallets.reduce((sum, curr) => sum.plus(curr.weight), Utils.BigNumber.ZERO);

            this.logger.debug(`total weight: ${totalWeight.toString()}`);

            if (totalWeight.isZero()) {
                this.logger.debug(`Total weight is zero, continuing`);
                continue;
            }

            const blockReward = block.rewards;
            this.logger.debug(`blockReward: ${blockReward.toString()}`);
            const fees = payFees === "y" ? block.fees : Utils.BigNumber.ZERO;
            this.logger.debug(`fees: ${fees.toString()}`);
            const totalReward = blockReward.plus(fees);
            this.logger.debug(`totalReward: ${totalReward.toString()}`);

            let toPayInThisBlock = Utils.BigNumber.ZERO;

            for (const wallet of wallets) {
                const payout = totalReward.times(wallet.weight).times(sharing).div(totalWeight).div(100);
                if (payout.isGreaterThan(0)) {
                    paytable[wallet.address] = (paytable[wallet.address] || Utils.BigNumber.ZERO).plus(payout);
                    toPayInThisBlock = toPayInThisBlock.plus(payout);
                }
                this.logger.debug(`${wallet.address}: ${paytable[wallet.address].toString()} +${payout.toString()}`);
            }
            this.logger.debug(`total in this block: ${toPayInThisBlock.toString()}`);
            totalToPay = totalToPay.plus(toPayInThisBlock);

            this.logger.debug(
                `Total for ${block.height}: ${toPayInThisBlock.toString()} (${toPayInThisBlock
                    .times(100)
                    .div(totalReward)
                    .toString()}%)`,
            );
        }

        return { maxHeight, totalToPay, paytable };
    }

    public async replay(id: string): Promise<{ success: boolean; error?: string }> {
        const settings = this.db.getSettings();
        if (!settings) {
            return { success: false, error: "Tbw not set up. Will not replay." };
        }
        const unconfirmed = this.db.getNotConfirmedTransactions();
        const databaseTx = unconfirmed.find((u) => u.id === id);
        if (!databaseTx) {
            return { success: false, error: "No unconfirmed transaction with this id." };
        }
        const tx: Interfaces.ITransactionJson = JSON.parse(databaseTx.tx);
        const pp = [settings.pp1, settings.pp2];

        if (!pp[0]) {
            return { success: false, error: "Tbw not set up. Will not replay." };
        }

        const wallet = this.walletRepository.findByPublicKey(Identities.PublicKey.fromPassphrase(pp[0]));

        const hasSecondSignature = wallet.hasSecondSignature();

        if (hasSecondSignature) {
            if (!pp[1]) {
                return { success: false, error: "Second passphrase not provided. Will not replay." };
            }
            const secondPublicKey = Identities.PublicKey.fromPassphrase(pp[1]);

            if (secondPublicKey !== wallet.getAttribute<string>("secondPublicKey")) {
                return {
                    success: false,
                    error: "Second passphrase provided does not match the delegate. Will not replay.",
                };
            }
        }

        const nonce = wallet.getNonce().plus(1);
        const balance = wallet.getBalance();

        if (balance.minus(tx.fee).isLessThan(databaseTx.totalAmount)) {
            return { success: false, error: "Insufficient balance to pay." };
        }

        const newTx = Transactions.BuilderFactory.transfer().nonce(nonce.toString()).fee(tx.fee);
        if (tx.memo) {
            newTx.memo(tx.memo);
        }

        for (const payout of tx.asset!.transfers!) {
            newTx.addPayment(payout.recipientId, payout.amount.toString());
        }
        newTx.sign(pp[0]);
        if (hasSecondSignature) {
            newTx.secondSign(pp[1]!);
        }
        const transaction = newTx.getStruct();
        this.db.addHistory(databaseTx.height, transaction, wallet.getAttribute<string>("delegate.username"));
        this.db.setTransactionToRepaid(id);
        await this.sendTransaction([transaction]);
        return { success: true };
    }

    private async sendTransaction(transactions: Interfaces.ITransactionData[]) {
        const result = await this.processor.process(transactions);
        for (const accepted of result.accept) {
            this.logger.debug(`TRANSACTION SET TO ACCEPTED ${accepted}`);
            this.db.setTransactionToAcceptedById(accepted);
        }

        for (const excess of result.excess) {
            this.logger.debug(`TRANSACTION SET TO ERROR ${excess}`);
            this.db.setTransactionToError(excess);
        }

        for (const invalid of result.invalid) {
            this.logger.debug(`TRANSACTION SET TO ERROR ${invalid}`);
            this.db.setTransactionToError(invalid);
        }

        const errors = result.errors;

        if (errors) {
            for (const error of Object.keys(errors)) {
                this.logger.debug(`TRANSACTION SET TO ERROR ${error}`);
                this.db.setTransactionToError(error);
                this.logger.error(`Transaction ${error} failed to send because ${errors[error].message}`);
            }
        }
        return;
    }

    private processRawBlocks(
        rawBlocks: blockRewardType[],
        modeClass: modeHandler,
        min: number | null,
        max: number | null,
    ) {
        const blocks: blockRewardType[] = [];
        const rounds: Array<Array<blockRewardType>> = Object.values(
            rawBlocks.reduce((state, curr) => {
                const currRound = AppUtils.roundCalculator.calculateRound(curr.height).round;
                state[currRound] = [...(state[currRound] || []), curr];
                return state;
            }, {}),
        );
        for (const round of rounds) {
            blocks.push(...modeClass.handleRoundBlocks(round, min, max));
        }
        return blocks;
    }

    private convert(paytable: { [key: string]: Utils.BigNumber }) {
        return Object.keys(paytable).map((payout) => ({
            address: payout,
            balance: paytable[payout],
        }));
    }

    private chunk(array: Array<any>, size: number): Array<any> {
        const chunked: Array<any> = [];
        let index = 0;
        while (index < array.length) {
            chunked.push(array.slice(index, size + index));
            index += size;
        }
        return chunked;
    }

    private calculateFees(
        paymentsInTransaction: number,
        memo: string,
        hasSecondSignature: boolean,
        extraFee: number,
    ): Utils.BigNumber {
        const constants = { ...Managers.configManager.getMilestone(this.blockchain.getLastHeight()) };

        let dynamicFees = this.transactionPoolConfiguration.getRequired<{
            enabled?: boolean;
            minFee?: number;
        }>("dynamicFees");

        if (constants.dynamicFees && constants.dynamicFees.enabled) {
            dynamicFees = {
                ...constants.dynamicFees,
                minFeeBroadcast: constants.dynamicFees.minFee,
                minFeePool: constants.dynamicFees.minFee,
            };
            delete dynamicFees.minFee;
        }

        const addonBytes = (dynamicFees as any).addonBytes.transfer;

        const memoLength = Buffer.from(memo, "utf8").length;

        const size = 59 + 64 + (hasSecondSignature ? 64 : 0) + memoLength + 2 + 29 * paymentsInTransaction;
        const fee = Utils.BigNumber.make((addonBytes + Math.round(size / 2)) * (dynamicFees as any).minFeePool);
        return fee.plus(fee.times(extraFee).div(100));
    }
}
