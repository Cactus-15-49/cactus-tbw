import { Commands, Container } from "@solar-network/cli";
import { Managers, Networks } from "@solar-network/crypto";
import Joi from "joi";

import { Database } from "../database";
import { validate, validPassphrase } from "../utils/validation";

@Container.injectable()
export class Command extends Commands.Command {
    public signature: string = "tbw:passphrase";

    public description: string = "Update your delegate passphrases.";

    public configure(): void {
        this.definition
            .setFlag("token", "The name of the token", Joi.string().default("solar"))
            .setFlag("network", "The name of the network", Joi.string().valid(...Object.keys(Networks)))
            .setFlag("pp1", "Update pp1 only", Joi.boolean().default(false))
            .setFlag("pp2", "Update pp2 only", Joi.boolean().default(false));
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

        const updatepp1: boolean = this.getFlag("pp1");
        const updatepp2: boolean = this.getFlag("pp2");

        let pp1: string | undefined = undefined;
        let pp2: string | undefined = undefined;

        if ((!updatepp1 && !updatepp2) || updatepp1) {
            pp1 = (
                await this.components.prompt({
                    type: "password",
                    name: "value",
                    message: "Insert delegate pp1: (empty if none)",
                    initial: "",
                    validate: (value) =>
                        !validate(validPassphrase, value) || value === "" ? true : "Passphrase not valid",
                })
            ).value as string;
        }

        if ((!updatepp1 && !updatepp2) || updatepp2) {
            pp2 = (
                await this.components.prompt({
                    type: "password",
                    name: "value",
                    message: "Insert delegate pp2 (empty if none): ",
                    initial: "",
                    validate: (value) =>
                        !validate(validPassphrase, value) || value === "" ? true : "Passphrase not valid",
                })
            ).value as string;
        }

        const { confirm } = await this.components.prompt({
            type: "confirm",
            name: "confirm",
            message: `${
                pp1 !== undefined ? "This operation will empty the tbw database from all the forged blocks." : ""
            } Do you confirm?`,
        });

        if (confirm) {
            try {
                if (pp1 !== undefined) {
                    db.deleteVotesAfterHeight(0);
                    db.saveAndDeleteHistory();
                    db.updateSettings("pp1", pp1 === "" ? null : pp1);
                }
                if (pp2 !== undefined) {
                    db.updateSettings("pp2", pp2 === "" ? null : pp2);
                }
            } catch {
                this.components.warning("Could not save settings. Passphrase unchanged.");
                return;
            }

            this.components.log(`Passphrases updated.`);
        }
    }
}
