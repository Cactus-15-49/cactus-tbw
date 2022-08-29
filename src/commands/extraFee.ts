import { Commands, Container } from "@solar-network/cli";
import { Networks } from "@solar-network/crypto";
import Joi from "joi";

import { Database } from "../database";
import { validPercentage } from "../utils/validation";

@Container.injectable()
export class Command extends Commands.Command {
    public signature: string = "tbw:extra_fee";

    public description: string = "Get or update your extra fee.";

    public configure(): void {
        this.definition
            .setFlag("token", "The name of the token", Joi.string().default("solar"))
            .setFlag("network", "The name of the network", Joi.string().valid(...Object.keys(Networks)))
            .setArgument("extraFee", "New extra fee.", validPercentage);
    }

    public async execute(): Promise<void> {
        const dbPath: string = this.app.getCorePath("data", "tbw");
        const db = new Database(dbPath);
        const settings = db.getSettings();
        if (!settings) {
            this.components.warning("Please configure tbw before using any other command.");
            return;
        }

        const extraFee: number | undefined = this.getArgument("extraFee");

        if (extraFee !== undefined) {
            const { confirm } = await this.components.prompt({
                type: "confirm",
                name: "confirm",
                message: `Are you sure you want to change your extra fee option from ${settings.extraFee}% to ${extraFee}%?`,
            });

            if (confirm) {
                try {
                    db.updateSettings("extraFee", extraFee);
                } catch {
                    this.components.warning("Could not save settings. Extra fee unchanged.");
                    return;
                }

                this.components.log(`Extra fee percentage set to ${extraFee}%`);
            }
        } else {
            this.components.log(`Current extra fee percentage is ${settings.extraFee}%`);
        }
    }
}
