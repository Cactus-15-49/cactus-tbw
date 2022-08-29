import { modes } from "../../interfaces";
import { classicMode } from "./classic";
import { everyMode } from "./every";
import { lastMode } from "./last";
import { minMode } from "./min";

export class modeFactory {
    public static getMode(mode: modes) {
        switch (mode) {
            case modes.classic:
                return new classicMode();
            case modes.every:
                return new everyMode();
            case modes.last:
                return new lastMode();
            case modes.min:
                return new minMode();
            default:
                throw new Error("Mode doesn't exist");
        }
    }
}
