import { Server as HapiServer } from "@hapi/hapi";
import { Container, Contracts } from "@solar-network/kernel";
import { existsSync, unlinkSync } from "fs";

import { PayRoute, RepayRoute, RollbackRoute } from "./routes";

@Container.injectable()
export class Server {
    @Container.inject(Container.Identifiers.Application)
    private readonly app!: Contracts.Kernel.Application;

    private name!: string;
    private unixSocket!: HapiServer;
    private unixSocketPath = `${process.env.CORE_PATH_TEMP}/tbw-pay.sock`;

    public async initialize(name: string): Promise<void> {
        this.name = name;

        this.unixSocket = new HapiServer({ port: this.unixSocketPath });

        this.app.resolve(PayRoute).register(this.unixSocket);
        this.app.resolve(RepayRoute).register(this.unixSocket);
        this.app.resolve(RollbackRoute).register(this.unixSocket);
    }

    public async boot(): Promise<void> {
        try {
            if (existsSync(this.unixSocketPath)) {
                unlinkSync(this.unixSocketPath);
            }

            await this.unixSocket.start();
        } catch {
            await this.app.terminate(`Failed to start ${this.name}!`);
        }
    }

    public async dispose(): Promise<void> {
        try {
            if (existsSync(this.unixSocketPath)) {
                unlinkSync(this.unixSocketPath);
            }
            await this.unixSocket.stop();
        } catch {
            await this.app.terminate(`Failed to stop ${this.name}!`);
        }
    }
}
