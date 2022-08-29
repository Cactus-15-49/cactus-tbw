import { Identities } from "@solar-network/crypto";
import Joi from "joi";

const checkValidAddress = (address: string) => {
    if (!Identities.Address.validate(address)) {
        throw new Error("Addresses must be valid.");
    }
    return address;
};

export const validAddress = Joi.string().length(34).custom(checkValidAddress);
export const validMemo = Joi.string().max(255).allow("");
export const validPercentage = Joi.number().integer().min(0).max(100);
export const validPositiveNumber = Joi.number().integer().min(0);
export const validPositiveNumberOrNull = Joi.number().integer().min(1).allow(null);
export const optionYesOrNo = Joi.string().valid("y", "n");
export const validPassphrase = Joi.string().min(1);
export const validId = Joi.string().length(64);
export const validMode = Joi.number().integer().min(0).max(3);

export const addressList = Joi.array().items(validAddress).unique();
export const addressToAddressObjects = Joi.object().pattern(validAddress, validAddress);
export const addressToPercentageObjects = Joi.object()
    .pattern(validAddress, Joi.number().integer().min(1).max(100))
    .custom((object: { [key: string]: number }) => {
        const total = Object.values(object).reduce((sum, curr) => sum + curr, 0);
        if (total !== 100 && total !== 0) {
            throw new Error("Total sum is not 100");
        }
    });

export const validSettings = Joi.object({
    mode: validMode.required(),
    blacklist: addressList.required(),
    routes: addressToAddressObjects.required(),
    whitelist: addressList.required(),
    sharing: validPercentage.required(),
    extraFee: validPercentage.required(),
    max: validPositiveNumberOrNull.required(),
    min: validPositiveNumberOrNull.required(),
    fidelity: validPositiveNumberOrNull.required(),
    memo: validMemo.required(),
    payFees: optionYesOrNo.required(),
    reserve: addressToPercentageObjects.required(),
    pp1: validPassphrase.allow(null).required(),
    pp2: validPassphrase.allow(null).required(),
});

export function validate(schema: Joi.Schema, value: any) {
    return schema.validate(value).error;
}

export function validateSettings(value: any) {
    return validSettings.validate(value).error;
}
