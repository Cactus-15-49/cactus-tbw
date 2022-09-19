import { Utils } from "@solar-network/crypto";

import { blocksStructType } from "../../interfaces";
import { modeHandler } from "./handler";

export class minMode extends modeHandler {
    public handleRoundBlocks(roundBlocks: blocksStructType[], min: number | null, max: number | null) {
        const [totalRewards, totalFees] = this.calculateTotalRoundRewards(roundBlocks);
        if (totalRewards.isGreaterThan(0)) {
            let eligibleAddresses = roundBlocks[0].balances.map((b) => b.address);

            for (const block of roundBlocks) {
                eligibleAddresses = eligibleAddresses.filter((a) => block.balances.find((b) => b.address === a));
            }

            let addressesWeights: { [key: string]: Utils.BigNumber } = {};

            for (const block of roundBlocks) {
                addressesWeights = block.balances.reduce((state, curr) => {
                    if (!eligibleAddresses.includes(curr.address)) {
                        return state;
                    }
                    let weight = curr.weight;
                    if (weight.isLessThan(min ? min * 1e8 : -1)) {
                        weight = weight.times(0);
                    }
                    if (max && weight.isGreaterThan(max * 1e8)) {
                        weight = Utils.BigNumber.make(max * 1e8);
                    }
                    if (!state[curr.address] || weight.isLessThan(state[curr.address])) {
                        state[curr.address] = weight;
                    }
                    return state;
                }, addressesWeights);
            }

            const biggerHeight = this.getBiggerHeight(roundBlocks);

            return [
                {
                    height: biggerHeight,
                    round: roundBlocks[0].round,
                    rewards: totalRewards,
                    fees: totalFees,
                    balances: Object.entries(addressesWeights)
                        .filter(([address, weight]) => !weight.isZero())
                        .map(([address, weight]) => {
                            return {
                                weight,
                                address,
                            };
                        }),
                },
            ];
        }
        return [];
    }
}
