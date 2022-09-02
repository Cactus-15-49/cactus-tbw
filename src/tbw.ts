import { Interfaces, Utils } from "@solar-network/crypto";
import { Repositories } from "@solar-network/database";
import { Container, Contracts, Enums, Providers } from "@solar-network/kernel";
import delay from "delay";

import { Database } from "./database";

@Container.injectable()
export class TBW {
    @Container.inject(Container.Identifiers.Application)
    private readonly app!: Contracts.Kernel.Application;

    @Container.inject(Container.Identifiers.PluginConfiguration)
    @Container.tagged("plugin", "@cactus1549/cactus-tbw")
    private readonly configuration!: Providers.PluginConfiguration;

    @Container.inject(Container.Identifiers.LogService)
    private readonly logger!: Contracts.Kernel.Logger;

    @Container.inject(Container.Identifiers.EventDispatcherService)
    private readonly events!: Contracts.Kernel.EventDispatcher;

    @Container.inject(Container.Identifiers.WalletRepository)
    @Container.tagged("state", "blockchain")
    private readonly walletRepository!: Contracts.State.WalletRepository;

    @Container.inject(Container.Identifiers.DatabaseTransactionRepository)
    private readonly transactionRepository!: Repositories.TransactionRepository;

    @Container.inject(Container.Identifiers.BlockHistoryService)
    private readonly blockHistoryService!: Contracts.Shared.BlockHistoryService;

    @Container.inject(Container.Identifiers.TransactionHistoryService)
    private readonly transactionHistoryService!: Contracts.Shared.TransactionHistoryService;

    private db!: Database;

    public async boot(): Promise<void> {
        this.events.listen(Enums.StateEvent.BuilderFinished, {
            handle: () => this.initialise(),
        });
    }

    public async initialise(): Promise<void> {
        this.db = new Database(this.configuration.get("dbPath") as string);
        this.db.setup();
        let delegate = this.getDelegate();
        if (!delegate) {
            this.logger.error(`TBW error: no delegate configured`);
            return;
        }

        this.logger.info(`Delegates configured for true block weight: ${delegate.getAttribute("delegate.username")}`);

        this.events.listen(Enums.BlockEvent.Applied, {
            handle: async ({ data }: { data: Interfaces.IBlockData }) => {
                const unconfirmed = this.db.getNotConfirmedTransactions();

                if (unconfirmed.length > 0) {
                    const forged = await this.transactionRepository.getForgedTransactionsIds(
                        unconfirmed.map((u) => u.id),
                    );
                    for (const id of forged) {
                        this.logger.info(`TRANSACTION SET TO CONFIRMED ${id}`);
                        const transaction = await this.transactionHistoryService.findOneByCriteria({ id: id });
                        if (!transaction) {
                            continue;
                        }
                        const blockData = await this.blockHistoryService.findOneByCriteria({
                            id: transaction.blockId!,
                        });
                        if (!blockData) {
                            continue;
                        }
                        this.db.setTransactionToConfimed(id, blockData.height);
                    }
                }

                delegate = this.getDelegate();
                if (!delegate) {
                    return;
                }

                while (data.height > (await this.getLastBlockHeight())) {
                    await delay(100);
                }

                const username = delegate.getAttribute("delegate.username");
                const walletsArray = this.walletRepository
                    .allByAddress()
                    .filter((wallet) => wallet.getVoteBalance(username)?.isGreaterThan(0));
                if (walletsArray.length) {
                    const blockReward =
                        delegate.getPublicKey() === data.generatorPublicKey
                            ? data.reward.minus(
                                  Object.values(data.donations! as { [key: string]: Utils.BigNumber }).reduce(
                                      (prev, curr) => prev.plus(curr),
                                      Utils.BigNumber.ZERO,
                                  ),
                              )
                            : Utils.BigNumber.ZERO;
                    const fees =
                        delegate.getPublicKey() === data.generatorPublicKey
                            ? data.totalFee.minus(data.burnedFee || 0)
                            : Utils.BigNumber.ZERO;
                    this.db.deleteVotesAfterHeight(data.height);
                    for (const wallet of walletsArray) {
                        this.db.insertVote(
                            data.height,
                            data.timestamp,
                            blockReward,
                            fees,
                            wallet.getAddress(),
                            wallet.getVoteBalance(username),
                        );
                    }

                    if (delegate.getPublicKey() === data.generatorPublicKey) {
                        this.logger.info(
                            `Calculated ${username}'s true block weight for height ${data.height.toLocaleString()}`,
                        );
                    }
                }
            },
        });

        this.events.listen(Enums.BlockEvent.Reverted, {
            handle: async ({ data }: { data: Interfaces.IBlockData }) => {
                this.db.deleteVotesAfterHeight(data.height);
                this.db.setTransactionToAcceptedByHeightDuringRollback(data.height);
            },
        });
    }

    private getDelegate(): Contracts.State.Wallet | undefined {
        const pkey = this.db.getDelegatePublicKey();
        if (!pkey || !this.walletRepository.hasByPublicKey(pkey)) {
            return undefined;
        }
        const delegate = this.walletRepository.findByPublicKey(pkey);
        return delegate.isDelegate() ? delegate : undefined;
    }

    private async getLastBlockHeight(): Promise<number> {
        const block = this.app.get<Contracts.State.StateStore>(Container.Identifiers.StateStore).getLastBlock();
        return block.data.height;
    }
}
