import { Commands, Container } from "@solar-network/cli";
import { Managers, Networks } from "@solar-network/crypto";
import Joi from "joi";

import { Database } from "../database";
import { optionYesOrNo } from "../utils/validation";

@Container.injectable()
export class Command extends Commands.Command {
    public signature: string = "tbw:pay_fees";

    public description: string = "Get or update the option to pay fees to voters.";

    public configure(): void {
        this.definition
            .setFlag("token", "The name of the token", Joi.string().default("solar"))
            .setFlag("network", "The name of the network", Joi.string().valid(...Object.keys(Networks)))
            .setArgument("payFees", "New payfees option (y/n).", optionYesOrNo);
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

        const payFees: string | undefined = this.getArgument("payFees");

        if (payFees && payFees !== settings.payFees) {
            const { confirm } = await this.components.prompt({
                type: "confirm",
                name: "confirm",
                message: `Are you sure you want to change your pay fee option from ${settings.payFees} to ${payFees}?`,
            });

            if (confirm) {
                try {
                    db.updateSettings("payFees", payFees);
                } catch {
                    this.components.warning("Could not save settings. PayFees unchanged.");
                    return;
                }

                this.components.log(`PayFees set to ${payFees}`);
            }
        } else {
            this.components.log(`Current payFees option set to ${settings.payFees}`);
        }
    }
}
