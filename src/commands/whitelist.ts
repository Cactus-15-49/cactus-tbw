import { Commands, Container } from "@solar-network/cli";
import { Managers, Networks } from "@solar-network/crypto";
import Joi from "joi";

import { Database } from "../database";
import { validAddress } from "../utils/validation";

@Container.injectable()
export class Command extends Commands.Command {
    public signature: string = "tbw:whitelist";

    public description: string = "Get or update the whitelist.";

    public configure(): void {
        this.definition
            .setFlag("token", "The name of the token", Joi.string().default("solar"))
            .setFlag("network", "The name of the network", Joi.string().valid(...Object.keys(Networks)))
            .setArgument(
                "command",
                "Add, remove, disable whitelist. Empty to show.",
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
                const alreadyInserted = settings.whitelist.some((a) => value === a);
                if (alreadyInserted) {
                    this.components.warning("Address already in whitelist");
                    return;
                }
                const { confirm } = await this.components.prompt({
                    type: "confirm",
                    name: "confirm",
                    message: `Are you sure you want to add ${value} to the whitelist table?`,
                });

                if (confirm) {
                    try {
                        db.addToWhitelist(value!);
                    } catch {
                        this.components.warning("Could not save settings. Whitelist unchanged.");
                        return;
                    }

                    this.components.log(`${value} added to the whitelist.`);
                }
                break;
            }
            case "remove": {
                const isPresent = settings.whitelist.some((a) => value === a);
                if (!isPresent) {
                    this.components.warning("Address already not in whitelist");
                    return;
                }
                const { confirm } = await this.components.prompt({
                    type: "confirm",
                    name: "confirm",
                    message: `Are you sure you want to remove ${value} from the whitelist table? ${
                        settings.whitelist.length > 2 ? "" : "By removing the last address, whitelist WILL BE DISABLED"
                    }`,
                });

                if (confirm) {
                    try {
                        db.removeFromWhitelist(value!);
                    } catch {
                        this.components.warning("Could not save settings. Whitelist unchanged.");
                        return;
                    }

                    this.components.log(
                        `${value} removed from the whitelist. ${
                            settings.whitelist.length > 2 ? "" : "Whitelist is now empty and it has been disabled"
                        }`,
                    );
                }
                break;
            }
            case "disable": {
                if (settings.whitelist.length) {
                    const { confirm } = await this.components.prompt({
                        type: "confirm",
                        name: "confirm",
                        message: `Are you sure you want to empty the whitelist table?`,
                    });

                    if (confirm) {
                        try {
                            db.removeWhitelist();
                        } catch {
                            this.components.warning("Could not save settings. Whitelist unchanged.");
                            return;
                        }

                        this.components.log(`Whitelist emptied.`);
                    }
                } else {
                    this.components.warning("Whitelist already disabled.");
                }
                break;
            }
            default: {
                if (settings.whitelist.length) {
                    this.components.log(`Whitelisted addresses:`);
                    for (const address of settings.whitelist) {
                        this.components.log(`- ${address}`);
                    }
                } else {
                    this.components.log(`Whitelist is not enabled.`);
                }
            }
        }
    }
}
