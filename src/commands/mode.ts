import { Commands, Container } from "@solar-network/cli";
import { Networks } from "@solar-network/crypto";
import Joi from "joi";

import { Database } from "../database";

@Container.injectable()
export class Command extends Commands.Command {
    public signature: string = "tbw:mode";

    public description: string = "Get or update your mode.";

    private modes = ["classic", "every", "min", "last"];

    public configure(): void {
        this.definition
            .setFlag("token", "The name of the token", Joi.string().default("solar"))
            .setFlag("network", "The name of the network", Joi.string().valid(...Object.keys(Networks)))
            .setArgument("mode", `New mode (${this.modes.join(", ")}).`, Joi.string().valid(...this.modes));
    }

    public async execute(): Promise<void> {
        const dbPath: string = this.app.getCorePath("data", "tbw");
        const db = new Database(dbPath);
        const settings = db.getSettings();
        if (!settings) {
            this.components.warning("Please configure tbw before using any other command.");
            return;
        }

        const mode: string | undefined = this.getArgument("mode");

        if (mode !== undefined) {
            const { confirm } = await this.components.prompt({
                type: "confirm",
                name: "confirm",
                message: `Are you sure you want to change your mode from ${this.modes[settings.mode]} to ${mode}?`,
            });

            if (confirm) {
                try {
                    db.updateSettings(
                        "mode",
                        this.modes.findIndex((m) => m === mode),
                    );
                } catch {
                    this.components.warning("Could not save settings. Mode unchanged.");
                    return;
                }

                this.components.log(`Mode set to ${mode}`);
            }
        } else {
            this.components.log(`Current mode is ${this.modes[settings.mode]}`);
        }
    }
}
