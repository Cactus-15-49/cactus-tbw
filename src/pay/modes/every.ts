import { Utils } from "@solar-network/crypto";

import { blockRewardType } from "../../interfaces";
import { modeHandler } from "./handler";

export class everyMode extends modeHandler {
    public handleRoundBlocks(roundBlocks: blockRewardType[], min: number | null, max: number | null) {
        const [totalRewards, totalFees] = this.calculateTotalRoundRewards(roundBlocks);
        if (totalRewards.isGreaterThan(0)) {
            const addressesWeights = roundBlocks.reduce((state, curr) => {
                let weight = curr.weight;
                if (weight.isLessThan(min ? min * 1e8 : 1)) {
                    return state;
                }
                if (max && weight.isGreaterThan(max * 1e8)) {
                    weight = Utils.BigNumber.make(max * 1e8);
                }
                state[curr.address] = (state[curr.address] || Utils.BigNumber.ZERO).plus(weight);
                return state;
            }, {} as { [key: string]: Utils.BigNumber });

            const biggerHeight = this.getBiggerHeight(roundBlocks);
            return Object.entries(addressesWeights).map(([address, weight]) => {
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

    public handleFidelity(
        lastNWeights: Array<{
            height: number;
            weight: Utils.BigNumber;
        }>,
        fidelity: number,
        currentWeight: Utils.BigNumber,
    ): Utils.BigNumber {
        if (lastNWeights.length < fidelity) {
            return Utils.BigNumber.ZERO;
        }
        return currentWeight;
    }
}
