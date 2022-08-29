import { Utils } from "@solar-network/crypto";

import { blockRewardType } from "../../interfaces";
import { modeHandler } from "./handler";

export class minMode extends modeHandler {
    public handleRoundBlocks(roundBlocks: blockRewardType[], min: number | null, max: number | null) {
        const [totalRewards, totalFees] = this.calculateTotalRoundRewards(roundBlocks);
        if (totalRewards.isGreaterThan(0)) {
            const blocksAddresses: Array<Array<string>> = Object.values(
                roundBlocks.reduce((state, curr) => {
                    state[curr.height] = [...(state[curr.height] || []), curr.address];
                    return state;
                }, {}),
            );
            const eligibleAddresses = blocksAddresses.reduce(
                (state, curr) => state.filter((a) => curr.includes(a)),
                blocksAddresses[0] || [],
            );
            const addressesWeights = roundBlocks.reduce((state, curr) => {
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
            }, {} as { [key: string]: Utils.BigNumber });

            const biggerHeight = this.getBiggerHeight(roundBlocks);

            return Object.entries(addressesWeights)
                .filter(([address, weight]) => weight.isGreaterThan(0))
                .map(([address, weight]) => {
                    return {
                        height: biggerHeight,
                        weight,
                        address,
                        rewards: totalRewards,
                        fees: totalFees,
                    };
                });
        }
        return [];
    }
}
