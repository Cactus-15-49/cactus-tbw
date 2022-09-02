import Hapi from "@hapi/hapi";
import { Container, Contracts } from "@solar-network/kernel";

import { Controller } from "./controller";

export type RouteConfig = {
    id: string;
    handler: any;
};

@Container.injectable()
export abstract class Route {
    @Container.inject(Container.Identifiers.Application)
    protected readonly app!: Contracts.Kernel.Application;

    public register(server: Hapi.Server): void {
        const controller = this.getController();
        server.bind(controller);

        for (const [path, config] of Object.entries(this.getRoutesConfigByPath())) {
            server.route({
                method: "POST",
                path,
                handler: config.handler,
            });
        }
    }

    protected getController(): Controller {
        return this.app.resolve(Controller);
    }

    public abstract getRoutesConfigByPath(): { [path: string]: RouteConfig };
}

export class PayRoute extends Route {
    public getRoutesConfigByPath(): { [path: string]: RouteConfig } {
        const controller = this.getController();
        return {
            "/pay": {
                id: "pay",
                handler: controller.pay,
            },
        };
    }
}

export class RepayRoute extends Route {
    public getRoutesConfigByPath(): { [path: string]: RouteConfig } {
        const controller = this.getController();
        return {
            "/repay": {
                id: "repay",
                handler: controller.repay,
            },
        };
    }
}

export class RollbackRoute extends Route {
    public getRoutesConfigByPath(): { [path: string]: RouteConfig } {
        const controller = this.getController();
        return {
            "/rollback": {
                id: "rollback",
                handler: controller.rollback,
            },
        };
    }
}

export class UnpaidRoute extends Route {
    public getRoutesConfigByPath(): { [path: string]: RouteConfig } {
        const controller = this.getController();
        return {
            "/unpaid": {
                id: "unpaid",
                handler: controller.unpaid,
            },
        };
    }
}
