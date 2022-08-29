import { Commands, Container } from "@solar-network/cli";
import { Networks } from "@solar-network/crypto";
import Joi from "joi";

import { Database } from "../database";
import { validPercentage } from "../utils/validation";

@Container.injectable()
export class Command extends Commands.Command {
    public signature: string = "tbw:sharing";

    public description: string = "Get or update your sharing.";

    public configure(): void {
        this.definition
            .setFlag("token", "The name of the token", Joi.string().default("solar"))
            .setFlag("network", "The name of the network", Joi.string().valid(...Object.keys(Networks)))
            .setArgument("sharing", "New sharing percentage.", validPercentage);
    }

    public async execute(): Promise<void> {
        const dbPath: string = this.app.getCorePath("data", "tbw");
        const db = new Database(dbPath);
        const settings = db.getSettings();
        if (!settings) {
            this.components.warning("Please configure tbw before using any other command.");
            return;
        }

        const sharing: number | undefined = this.getArgument("sharing");

        if (sharing !== undefined) {
            const { confirm } = await this.components.prompt({
                type: "confirm",
                name: "confirm",
                message: `Are you sure you want to change your sharing from ${settings.sharing}% to ${sharing}%?`,
            });

            if (confirm) {
                try {
                    db.updateSettings("sharing", sharing);
                } catch {
                    this.components.warning("Could not save settings. Sharing unchanged.");
                    return;
                }

                this.components.log(`Sharing percentage set to ${sharing}%`);
            }
        } else {
            this.components.log(`Current sharing percentage is ${settings.sharing}%`);
        }
    }
}
