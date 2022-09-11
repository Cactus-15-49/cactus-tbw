import { Commands, Container } from "@solar-network/cli";
import { Managers, Networks } from "@solar-network/crypto";
import Joi from "joi";

import { Database } from "../database";
import {
    addressToPercentageObjects,
    optionYesOrNo,
    validate,
    validMemo,
    validPassphrase,
    validPercentage,
    validPositiveNumber,
} from "../utils/validation";

@Container.injectable()
export class Command extends Commands.Command {
    public signature: string = "tbw:configure";

    public description: string = "Configure TBW.";

    private modes = ["classic", "every", "min", "last"];

    public configure(): void {
        this.definition
            .setFlag("token", "The name of the token.", Joi.string().default("solar"))
            .setFlag("network", "The name of the network.", Joi.string().valid(...Object.keys(Networks)));
    }

    public async execute(): Promise<void> {
        Managers.configManager.setFromPreset(this.getFlag("network"));
        const dbPath: string = this.app.getCorePath("data", "tbw");
        const db = new Database(dbPath);

        const { sharing } = await this.components.prompt({
            type: "number",
            name: "sharing",
            message: "Insert sharing (0-100): ",
            initial: 100,
            validate: (value) => (validate(validPercentage, value) ? "Sharing not valid" : true),
        });

        if (sharing === undefined) {
            return;
        }

        const { mode } = await this.components.prompt({
            type: "select",
            name: "mode",
            message: "Choose mode:",
            choices: this.modes.map((e, i) => {
                return { title: e, value: i };
            }),
        });

        this.components.log(`${mode}`);
        if (mode === undefined) {
            return;
        }

        const { extraFee } = await this.components.prompt({
            type: "number",
            name: "extraFee",
            message: "Insert extra fee (0-100): ",
            initial: 0,
            validate: (value) => (validate(validPercentage, value) ? "Extra fee not valid" : true),
        });

        if (extraFee === undefined) {
            return;
        }

        const { max } = await this.components.prompt({
            type: "number",
            name: "max",
            message: "Insert max cap (0 for none): ",
            initial: 0,
            validate: (value) => (validate(validPositiveNumber, value) ? "Max cap not valid" : true),
        });

        if (max === undefined) {
            return;
        }

        const { min } = await this.components.prompt({
            type: "number",
            name: "min",
            message: "Insert min cap (0 for none): ",
            initial: 0,
            validate: (value) => (validate(validPositiveNumber, value) ? "Min cap not valid" : true),
        });

        if (min === undefined) {
            return;
        }

        const { fidelity } = await this.components.prompt({
            type: "number",
            name: "fidelity",
            message: "Insert fidelity (0 for none): ",
            initial: 0,
            validate: (value) => (validate(validPositiveNumber, value) ? "Fidelity not valid" : true),
        });

        if (fidelity === undefined) {
            return;
        }

        const { memo } = await this.components.prompt({
            type: "text",
            name: "memo",
            message: "Insert memo: ",
            initial: "Thanks for voting",
            validate: (value) => (validate(validMemo, value) ? "Memo not valid" : true),
        });

        if (memo === undefined) {
            return;
        }

        const { payFees } = await this.components.prompt({
            type: "text",
            name: "payFees",
            message: "Do you want to pay transaction fees to voters? (y/n) ",
            initial: "y",
            validate: (value) => {
                return validate(optionYesOrNo, value) ? "Option not valid" : true;
            },
        });

        if (payFees === undefined) {
            return;
        }

        let reserve: { [key: string]: number } = {};
        const { reserveString } = await this.components.prompt({
            type: "text",
            name: "reserveString",
            message: "Insert reserve (format addr1:percentage,addr2:percentage): ",
            initial: "",
            validate: (value) => {
                reserve = {};
                if (value === "") {
                    return true;
                }
                const reserveArray = value.split(",").map((v) => v.split(":"));
                if (reserveArray.some((a) => a.length !== 2)) {
                    return "Wrong format for reserve";
                }
                for (const [address, percentage] of reserveArray) {
                    if (address.length !== 34) {
                        return "Addresses must be 34 char long";
                    }
                    const validatedPercentage = parseInt(percentage);
                    if (isNaN(validatedPercentage) || validatedPercentage < 0 || validatedPercentage > 100) {
                        return "Number must be a percentage";
                    }
                    reserve[address] = (reserve[address] || 0) + validatedPercentage;
                }

                if (Object.values(reserve).reduce((p, c) => p + c, 0) !== 100) {
                    return "Total is not 100%";
                }
                return validate(addressToPercentageObjects, reserve) ? "Wrong format for reserve" : true;
            },
        });

        if (reserveString === undefined) {
            return;
        }

        const { pp1 } = await this.components.prompt({
            type: "password",
            name: "pp1",
            message: "Insert delegate first passphrase:",
            initial: "",
            validate: (value) => (validate(validPassphrase, value) ? "Passphrase not valid" : true),
        });

        if (pp1 === undefined) {
            return;
        }

        const { pp2 } = await this.components.prompt({
            type: "password",
            name: "pp2",
            message: "Insert delegate second passphrase (empty if none): ",
            initial: "",
            validate: (value) => (!validate(validPassphrase, value) || value === "" ? true : "Passphrase not valid"),
        });

        if (pp2 === undefined) {
            return;
        }

        const { confirm } = await this.components.prompt({
            type: "confirm",
            name: "confirm",
            message: `Do you confirm? It will overwrite any current setting and delete any previous forged block from the TBW database.`,
        });

        if (confirm) {
            try {
                const settings = db.getSettings();
                if (!settings) {
                    db.createSettingsFile();
                }
                db.updateSettings("sharing", sharing as number);
                db.updateSettings("mode", mode as number);
                db.updateSettings("extraFee", extraFee as number);
                db.updateSettings("max", max === 0 ? null : (max as number));
                db.updateSettings("min", min === 0 ? null : (min as number));
                db.updateSettings("fidelity", fidelity === 0 ? null : (fidelity as number));
                db.updateSettings("memo", memo as string);
                db.updateSettings("payFees", payFees as string);
                db.updateReserve(reserve);
                db.updateSettings("pp1", pp1 as string);
                db.updateSettings("pp2", pp2 === "" ? null : (pp2 as string));
                db.setup();
                db.deleteVotesAfterHeight(0);
                db.saveAndDeleteHistory();
            } catch (err) {
                this.components.warning("Could not save settings.");
                this.components.warning(err);
                return;
            }

            this.components.log(`Saved successfully.`);
        }
    }
}
