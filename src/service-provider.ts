import { Providers } from "@solar-network/kernel";

import { Pay } from "./pay/pay";
import { Server } from "./server/server";
import { TBW } from "./tbw";

export class ServiceProvider extends Providers.ServiceProvider {
    private tbwSymbol = Symbol.for("TBW<TBW>");
    private serverSymbol = Symbol.for("TBW<Server>");
    private paySymbol = Symbol.for("TBW<Pay>");

    public async register(): Promise<void> {
        this.app.bind<TBW>(this.tbwSymbol).to(TBW).inSingletonScope();
        this.app.bind<Server>(this.serverSymbol).to(Server).inSingletonScope();
        this.app.bind<Pay>(this.paySymbol).to(Pay).inSingletonScope();

        const server: Server = this.app.get<Server>(this.serverSymbol);

        await server.initialize("TBW server");
    }

    public async bootWhen(): Promise<boolean> {
        return !!this.config().get("enabled");
    }

    public async boot(): Promise<void> {
        this.app.get<TBW>(this.tbwSymbol).boot();
        this.app.get<Pay>(this.paySymbol).boot();
        this.app.get<Server>(this.serverSymbol).boot();
    }

    public async dispose(): Promise<void> {
        if (!this.config().get("enabled")) {
            return;
        }

        this.app.get<Server>(this.serverSymbol).dispose();
    }
}
