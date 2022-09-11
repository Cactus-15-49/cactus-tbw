import { Utils } from "@solar-network/crypto";

export interface settingsType {
    mode: modes;
    blacklist: string[];
    routes: {
        [key: string]: string;
    };
    whitelist: string[];
    sharing: number;
    extraFee: number;
    max: number | null;
    min: number | null;
    fidelity: number | null;
    memo: string;
    payFees: string;
    reserve: {
        [key: string]: number;
    };
    pp1: string | null;
    pp2: string | null;
}

export interface history {
    height: number;
    id: string;
    addresses: string;
    totalAmount: string;
    timestamp: number;
    tx: string;
    status: string;
}

export interface blockRewardType {
    height: number;
    weight: Utils.BigNumber;
    address: string;
    rewards: Utils.BigNumber;
    fees: Utils.BigNumber;
}

export interface blockType {
    height: number;
    rewards: Utils.BigNumber;
    fees: Utils.BigNumber;
}

export interface paytable {
    [key: string]: Utils.BigNumber;
}

export interface paytableWorkerResult {
    maxHeight: number;
    totalToPay: string;
    paytable: { [key: string]: string };
}

export interface paytableResult {
    maxHeight: number;
    totalToPay: Utils.BigNumber;
    paytable: paytable;
}

export enum modes {
    classic,
    every,
    min,
    last,
}
