import { Commands, Container } from "@solar-network/cli";
import { Managers, Networks } from "@solar-network/crypto";
import Joi from "joi";

import { Database } from "../database";
import { validAddress } from "../utils/validation";

@Container.injectable()
export class Command extends Commands.Command {
    public signature: string = "tbw:blacklist";

    public description: string = "Get or update the blacklist.";

    public configure(): void {
        this.definition
            .setFlag("token", "The name of the token", Joi.string().default("solar"))
            .setFlag("network", "The name of the network", Joi.string().valid(...Object.keys(Networks)))
            .setArgument(
                "command",
                "add, remove or disable. Empty to show blacklist.",
                Joi.string().valid("add", "remove", "disable"),
            )
            .setArgument("value", "Address to add or remove.", validAddress);
    }

    public async execute(): Promise<void> {
        Managers.configManager.setFromPreset(this.getFlag("network"));
        const dbPath: string = this.app.getCorePath("data", "tbw");
        const db = new Database(dbPath);
        const settings = db.getSettings();
        if (!settings) {
            this.components.warning("Please configure tbw before using any other command.");
            return;
        }

        const command: string | undefined = this.getArgument("command");
        const value: string | undefined = this.getArgument("value");

        if ((command === "add" || command === "remove") && !value) {
            this.components.warning(`Please specify the address to ${command}.`);
            return;
        }

        switch (command) {
            case "add": {
                const alreadyInserted = settings.blacklist.some((a) => value === a);
                if (alreadyInserted) {
                    this.components.warning("Address already in blacklist.");
                    return;
                }
                const { confirm } = await this.components.prompt({
                    type: "confirm",
                    name: "confirm",
                    message: `Are you sure you want to add ${value} to the blacklist table?`,
                });

                if (confirm) {
                    try {
                        db.addToBlacklist(value!);
                    } catch {
                        this.components.warning("Could not save settings. Blacklist unchanged.");
                        return;
                    }

                    this.components.log(`${value} added to the blacklist.`);
                }
                break;
            }
            case "remove": {
                const isPresent = settings.blacklist.some((a) => value === a);
                if (!isPresent) {
                    this.components.warning("Address already not in blacklist.");
                    return;
                }
                const { confirm } = await this.components.prompt({
                    type: "confirm",
                    name: "confirm",
                    message: `Are you sure you want to remove ${value} from the blacklist table?`,
                });

                if (confirm) {
                    try {
                        db.removeFromBlacklist(value!);
                    } catch {
                        this.components.warning("Could not save settings. Blacklist unchanged.");
                        return;
                    }

                    this.components.log(`${value} removed from the blacklist.`);
                }
                break;
            }
            case "disable": {
                if (settings.blacklist.length) {
                    const { confirm } = await this.components.prompt({
                        type: "confirm",
                        name: "confirm",
                        message: `Are you sure you want to empty the blacklist table?`,
                    });

                    if (confirm) {
                        try {
                            db.removeBlacklist();
                        } catch {
                            this.components.warning("Could not save settings. Blacklist unchanged.");
                            return;
                        }

                        this.components.log(`Blacklist emptied.`);
                    }
                } else {
                    this.components.warning("Blacklist already disabled.");
                }
                break;
            }
            default: {
                if (settings.blacklist.length) {
                    this.components.log(`Blacklisted addresses:`);
                    for (const address of settings.blacklist) {
                        this.components.log(`- ${address}`);
                    }
                } else {
                    this.components.log(`Blacklist is not enabled.`);
                }
            }
        }
    }
}
