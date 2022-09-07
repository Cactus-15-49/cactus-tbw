import { Managers, Utils } from "@solar-network/crypto";
import { Utils as AppUtils } from "@solar-network/kernel";
import { parentPort, workerData } from "worker_threads";

import { Database } from "../database";
import { blockRewardType, blockType, paytable, paytableWorkerResult } from "../interfaces";
import { modeFactory } from "./modes/factory";
import { modeHandler } from "./modes/handler";

const processRawBlocks = (
    rawBlocks: blockRewardType[],
    modeClass: modeHandler,
    min: number | null,
    max: number | null,
) => {
    const blocks: blockRewardType[] = [];
    const rounds: Array<Array<blockRewardType>> = Object.values(
        rawBlocks.reduce((state, curr) => {
            const currRound = AppUtils.roundCalculator.calculateRound(curr.height).round;
            state[currRound] = [...(state[currRound] || []), curr];
            return state;
        }, {}),
    );
    for (const round of rounds) {
        blocks.push(...modeClass.handleRoundBlocks(round, min, max));
    }
    return blocks;
};

const getPaytable = (username: string, dbPath: string): paytableWorkerResult => {
    const db = new Database(dbPath);
    const settings = db.getSettings();
    if (!settings) {
        throw new Error("Settings file not found or invalid");
    }
    const { blacklist, mode, routes, whitelist, sharing, max: maxCap, min: minCap, fidelity, payFees } = settings;

    const paytable: paytable = {};
    let maxHeight = 0;
    let totalToPay = Utils.BigNumber.ZERO;

    const lastHeight = db.getLastPayHeight(username);
    const rawBlocks = db.getTbwBlocksFromHeight(lastHeight + 1);

    const modeClass = modeFactory.getMode(mode);

    const voters = processRawBlocks(rawBlocks, modeClass, minCap, maxCap);

    const forgedBlocks = Object.values(
        voters.reduce((state, curr) => {
            if (!state.some((b) => curr.height === b.height)) {
                state.push({
                    height: curr.height,
                    rewards: curr.rewards,
                    fees: curr.fees,
                });
            }
            return state;
        }, [] as blockType[]),
    );

    for (const block of forgedBlocks) {
        log(`---------------------`);
        log(`Block: ${block.height}`);
        log(`Reward: ${block.rewards.toString()}`);
        log(`Fees: ${block.fees.toString()}`);
        log(`Original: ${JSON.stringify(voters.filter((w) => w.height === block.height))}`);

        maxHeight = block.height > maxHeight ? block.height : maxHeight;

        const fidelityObject: {
            fidelityBalances: Array<{ height: number; weight: Utils.BigNumber; address: string }>;
            startHeight: number;
        } = {
            fidelityBalances: [],
            startHeight: 0,
        };
        if (fidelity) {
            const currentRound = AppUtils.roundCalculator.calculateRound(block.height);
            fidelityObject.startHeight = Math.max(0, currentRound.roundHeight - fidelity * currentRound.maxDelegates);
            fidelityObject.fidelityBalances = db.getBalancesBetweenHeights(
                fidelityObject.startHeight,
                block.height - 1,
            );
        }
        const wallets = voters
            .filter((w) => w.height === block.height)
            .filter((w) => !blacklist.includes(w.address))
            .filter((w) => whitelist.length === 0 || whitelist.includes(w.address))
            .map((w) => {
                if (fidelity) {
                    const balances = fidelityObject.fidelityBalances.filter((f) => f.address === w.address);
                    w.weight = modeClass.handleFidelity(balances, block.height - fidelityObject.startHeight, w.weight);
                }
                if (routes[w.address]) {
                    w.address = routes[w.address];
                }
                return w;
            });
        log(`Wallets: ${JSON.stringify(wallets)}`);

        const totalWeight = wallets.reduce((sum, curr) => sum.plus(curr.weight), Utils.BigNumber.ZERO);

        log(`total weight: ${totalWeight.toString()}`);

        if (totalWeight.isZero()) {
            log(`Total weight is zero, continuing`);
            continue;
        }

        const blockReward = block.rewards;
        log(`blockReward: ${blockReward.toString()}`);
        const fees = payFees === "y" ? block.fees : Utils.BigNumber.ZERO;
        log(`fees: ${fees.toString()}`);
        const totalReward = blockReward.plus(fees);
        log(`totalReward: ${totalReward.toString()}`);

        let toPayInThisBlock = Utils.BigNumber.ZERO;

        for (const wallet of wallets) {
            const payout = totalReward.times(wallet.weight).times(sharing).div(totalWeight).div(100);
            if (payout.isGreaterThan(0)) {
                paytable[wallet.address] = (paytable[wallet.address] || Utils.BigNumber.ZERO).plus(payout);
                toPayInThisBlock = toPayInThisBlock.plus(payout);
            }
            log(`${wallet.address}: ${paytable[wallet.address].toString()} +${payout.toString()}`);
        }
        log(`total in this block: ${toPayInThisBlock.toString()}`);
        totalToPay = totalToPay.plus(toPayInThisBlock);

        log(
            `Total for ${block.height}: ${toPayInThisBlock.toString()} (${toPayInThisBlock
                .times(100)
                .div(totalReward)
                .toString()}%)`,
        );
    }

    const serialisedPaytable: { [key: string]: string } = {};
    for (const [address, balance] of Object.entries(paytable)) {
        serialisedPaytable[address] = balance.toString();
    }

    return { maxHeight, totalToPay: totalToPay.toString(), paytable: serialisedPaytable };
};

const log = (message: string) => {
    parentPort?.postMessage({
        type: "log",
        data: message,
    });
};
Managers.configManager.setFromPreset(workerData.network);
parentPort?.postMessage({ type: "result", data: getPaytable(workerData.username, workerData.dbPath) });
