import { Commands, Container } from "@solar-network/cli";
import { Networks } from "@solar-network/crypto";
import Joi from "joi";

import { Database } from "../database";
import { validMemo } from "../utils/validation";

@Container.injectable()
export class Command extends Commands.Command {
    public signature: string = "tbw:memo";

    public description: string = "Get or update your memo.";

    public configure(): void {
        this.definition
            .setFlag("token", "The name of the token", Joi.string().default("solar"))
            .setFlag("network", "The name of the network", Joi.string().valid(...Object.keys(Networks)))
            .setArgument("memo", "New memo.", validMemo);
    }

    public async execute(): Promise<void> {
        const dbPath: string = this.app.getCorePath("data", "tbw");
        const db = new Database(dbPath);
        const settings = db.getSettings();
        if (!settings) {
            this.components.warning("Please configure tbw before using any other command.");
            return;
        }

        const memo: string | undefined = this.getArgument("memo");

        if (memo !== undefined) {
            const { confirm } = await this.components.prompt({
                type: "confirm",
                name: "confirm",
                message: `Are you sure you want to change your memo from "${settings.memo}" to "${memo}"?`,
            });

            if (confirm) {
                try {
                    db.updateSettings("memo", memo);
                } catch {
                    this.components.warning("Could not save settings. Memo unchanged.");
                    return;
                }

                this.components.log(`Memo set to "${memo}"`);
            }
        } else {
            this.components.log(`Current memo is "${settings.memo}"`);
        }
    }
}
