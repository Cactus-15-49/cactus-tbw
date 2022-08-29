import { Commands, Container } from "@solar-network/cli";
import { Networks } from "@solar-network/crypto";
import Joi from "joi";

import { Database } from "../database";
import { validAddress } from "../utils/validation";

@Container.injectable()
export class Command extends Commands.Command {
    public signature: string = "tbw:routes";

    public description: string = "Get or update the routes.";

    public configure(): void {
        this.definition
            .setFlag("token", "The name of the token", Joi.string().default("solar"))
            .setFlag("network", "The name of the network", Joi.string().valid(...Object.keys(Networks)))
            .setArgument(
                "command",
                "add, remove and disable routes. Empty to show.",
                Joi.string().valid("add", "remove", "disable"),
            )
            .setArgument("source", "Source address to add or remove.", validAddress)
            .setArgument("destination", "Destination address to add.", validAddress);
    }

    public async execute(): Promise<void> {
        const dbPath: string = this.app.getCorePath("data", "tbw");
        const db = new Database(dbPath);
        const settings = db.getSettings();
        if (!settings) {
            this.components.warning("Please configure tbw before using any other command.");
            return;
        }

        const command: string | undefined = this.getArgument("command");
        const source: string | undefined = this.getArgument("source");
        const destination: string | undefined = this.getArgument("destination");

        if (command === "remove" && !source) {
            this.components.warning(`Please specify the address to remove.`);
            return;
        }

        if (command === "add" && (!source || !destination)) {
            this.components.warning(`Please specify the address source and destination.`);
            return;
        }

        switch (command) {
            case "add": {
                const alreadyInserted = !!settings.routes[source!];
                if (alreadyInserted) {
                    this.components.warning("Source address already in routes");
                    return;
                }
                const { confirm } = await this.components.prompt({
                    type: "confirm",
                    name: "confirm",
                    message: `Are you sure you want to add ${source}->${destination} to the routes table?`,
                });

                if (confirm) {
                    try {
                        db.addRoute(source!, destination!);
                    } catch {
                        this.components.warning("Could not save settings. Routes unchanged.");
                        return;
                    }

                    this.components.log(`${source}->${destination} added to the routes.`);
                }
                break;
            }
            case "remove": {
                const isPresent = !!settings.routes[source!];
                if (!isPresent) {
                    this.components.warning("Source address already not in routes");
                    return;
                }
                const { confirm } = await this.components.prompt({
                    type: "confirm",
                    name: "confirm",
                    message: `Are you sure you want to remove ${source}->${
                        settings.routes[source!]
                    } from the routes table?`,
                });

                if (confirm) {
                    try {
                        db.removeFromRoute(source!);
                    } catch {
                        this.components.warning("Could not save settings. Routes unchanged.");
                        return;
                    }

                    this.components.log(`${source}->${settings.routes[source!]} removed from routes.`);
                }
                break;
            }
            case "disable": {
                if (Object.keys(settings.routes).length) {
                    const { confirm } = await this.components.prompt({
                        type: "confirm",
                        name: "confirm",
                        message: `Are you sure you want to empty the routes table?`,
                    });

                    if (confirm) {
                        try {
                            db.removeRoutes();
                        } catch {
                            this.components.warning("Could not save settings. Routes unchanged.");
                            return;
                        }

                        this.components.log(`Routes emptied.`);
                    }
                } else {
                    this.components.warning("Routes already disabled.");
                }
                break;
            }
            default: {
                if (Object.keys(settings.routes).length) {
                    this.components.log(`Routes:`);
                    for (const address in settings.routes) {
                        this.components.log(`- ${address} -> ${settings.routes[address]}`);
                    }
                } else {
                    this.components.log(`Routes is not enabled.`);
                }
            }
        }
    }
}
