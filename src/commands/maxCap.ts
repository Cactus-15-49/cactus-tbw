import { Commands, Container } from "@solar-network/cli";
import { Managers, Networks } from "@solar-network/crypto";
import Joi from "joi";

import { Database } from "../database";
import { validPositiveNumber } from "../utils/validation";

@Container.injectable()
export class Command extends Commands.Command {
    public signature: string = "tbw:max";

    public description: string = "Get or update your max cap.";

    public configure(): void {
        this.definition
            .setFlag("token", "The name of the token", Joi.string().default("solar"))
            .setFlag("network", "The name of the network", Joi.string().valid(...Object.keys(Networks)))
            .setArgument("max", "New max cap (0 for none).", validPositiveNumber);
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

        const max: number | undefined = this.getArgument("max");

        if (max !== undefined) {
            const { confirm } = await this.components.prompt({
                type: "confirm",
                name: "confirm",
                message: `Are you sure you want to change your max cap from ${settings.max || "None"} to ${
                    max === 0 ? "None" : max
                }?`,
            });

            if (confirm) {
                try {
                    db.updateSettings("max", max === 0 ? null : max);
                } catch {
                    this.components.warning("Could not save settings. Max cap unchanged.");
                    return;
                }

                this.components.log(`Max cap set to ${max === 0 ? "None" : max}`);
            }
        } else {
            this.components.log(`Current max cap is ${settings.max || "None"}`);
        }
    }
}
