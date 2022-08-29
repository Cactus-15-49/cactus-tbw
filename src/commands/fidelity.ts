import { Commands, Container } from "@solar-network/cli";
import { Networks } from "@solar-network/crypto";
import Joi from "joi";

import { Database } from "../database";
import { validPositiveNumber } from "../utils/validation";

@Container.injectable()
export class Command extends Commands.Command {
    public signature: string = "tbw:fidelity";

    public description: string = "Get or update your fidelity.";

    public configure(): void {
        this.definition
            .setFlag("token", "The name of the token", Joi.string().default("solar"))
            .setFlag("network", "The name of the network", Joi.string().valid(...Object.keys(Networks)))
            .setArgument("fidelity", "New fidelity (0 for none).", validPositiveNumber);
    }

    public async execute(): Promise<void> {
        const dbPath: string = this.app.getCorePath("data", "tbw");
        const db = new Database(dbPath);
        const settings = db.getSettings();
        if (!settings) {
            this.components.warning("Please configure tbw before using any other command.");
            return;
        }

        const fidelity: number | undefined = this.getArgument("fidelity");

        if (fidelity !== undefined) {
            const { confirm } = await this.components.prompt({
                type: "confirm",
                name: "confirm",
                message: `Are you sure you want to change your fidelity from ${settings.fidelity || "None"} blocks to ${
                    fidelity || "None"
                } blocks?`,
            });

            if (confirm) {
                try {
                    db.updateSettings("fidelity", fidelity || null);
                } catch {
                    this.components.warning("Could not save settings. Fidelity unchanged.");
                    return;
                }

                this.components.log(`Fidelity set to ${fidelity || "None"}`);
            }
        } else {
            this.components.log(`Current fidelity is ${settings.fidelity || "None"}`);
        }
    }
}
