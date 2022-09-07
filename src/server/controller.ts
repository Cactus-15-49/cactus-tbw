import Hapi from "@hapi/hapi";
import { Repositories } from "@solar-network/database";
import { Container, Contracts } from "@solar-network/kernel";
import { closeSync, openSync } from "fs";

import { Pay } from "../pay/pay";

@Container.injectable()
export class Controller {
    @Container.inject(Container.Identifiers.LogService)
    protected readonly logger!: Contracts.Kernel.Logger;

    @Container.inject(Container.Identifiers.Application)
    private readonly app!: Contracts.Kernel.Application;

    @Container.inject(Container.Identifiers.DatabaseBlockRepository)
    private readonly blockRepository!: Repositories.BlockRepository;

    public async pay(request: Hapi.Request, h: Hapi.ResponseToolkit): Promise<Hapi.ResponseObject> {
        this.logger.info(`Paying out!`);

        const pay: Pay = this.app.get(Symbol.for("TBW<Pay>"));
        try {
            await pay.pay();
            return h.response({ success: true }).code(200);
        } catch (err) {
            return h.response({ success: false, error: err.message }).code(500);
        }
    }

    public async repay(request: Hapi.Request, h: Hapi.ResponseToolkit): Promise<Hapi.ResponseObject> {
        const id = (request as any).payload.id;
        this.logger.info(`Repaying transaction ${id}!`);

        const pay: Pay = this.app.get(Symbol.for("TBW<Pay>"));
        const result = await pay.replay(id);
        return h.response(result).code(result.success ? 200 : 500);
    }

    public async rollback(request: Hapi.Request, h: Hapi.ResponseToolkit): Promise<Hapi.ResponseObject> {
        const height = (request as any).payload.height;
        this.logger.info(`Rollback to height ${height}!`);

        const blockchain = this.app.get<Contracts.Blockchain.Blockchain>(Container.Identifiers.BlockchainService);

        const queue = blockchain.getQueue();
        await queue.stop();
        const lastBlock = (await this.blockRepository.findLatest())!.height;
        await this.blockRepository.deleteTopBlocks(this.app, lastBlock - height);
        closeSync(openSync(`${process.env.CORE_PATH_TEMP}/force-integrity-check.lock`, "w"));
        this.logger.info(`Core will now restart`);
        setImmediate(() => process.exit());
        return h.response().code(200);
    }

    public async unpaid(request: Hapi.Request, h: Hapi.ResponseToolkit): Promise<Hapi.ResponseObject> {
        const username = (request as any).payload.username;

        const pay: Pay = this.app.get(Symbol.for("TBW<Pay>"));
        try {
            const result = await pay.getPaytableFromWorker(username);
            return h.response(result.paytable).code(200);
        } catch {
            return h.response().code(500);
        }
    }
}
