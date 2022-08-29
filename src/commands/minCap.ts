import { Commands, Container } from "@solar-network/cli";
import { Networks } from "@solar-network/crypto";
import Joi from "joi";

import { Database } from "../database";
import { validPositiveNumber } from "../utils/validation";

@Container.injectable()
export class Command extends Commands.Command {
    public signature: string = "tbw:min";

    public description: string = "Get or update your min cap.";

    public configure(): void {
        this.definition
            .setFlag("token", "The name of the token", Joi.string().default("solar"))
            .setFlag("network", "The name of the network", Joi.string().valid(...Object.keys(Networks)))
            .setArgument("min", "New min cap (0 for none).", validPositiveNumber);
    }

    public async execute(): Promise<void> {
        const dbPath: string = this.app.getCorePath("data", "tbw");
        const db = new Database(dbPath);
        const settings = db.getSettings();
        if (!settings) {
            this.components.warning("Please configure tbw before using any other command.");
            return;
        }

        const min: number | undefined = this.getArgument("min");

        if (min !== undefined) {
            const { confirm } = await this.components.prompt({
                type: "confirm",
                name: "confirm",
                message: `Are you sure you want to change your min cap from ${settings.min || "None"} to ${
                    min === 0 ? "None" : min
                }?`,
            });

            if (confirm) {
                try {
                    db.updateSettings("min", min === 0 ? null : min);
                } catch {
                    this.components.warning("Could not save settings. Min cap unchanged.");
                    return;
                }

                this.components.log(`Min cap set to ${min === 0 ? "None" : min}`);
            }
        } else {
            this.components.log(`Current min cap is ${settings.min || "None"}`);
        }
    }
}
