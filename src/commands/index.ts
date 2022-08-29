import { Command as Blacklist } from "./blacklist";
import { Command as Configure } from "./configure";
import { Command as Database } from "./database";
import { Command as Disable } from "./disable";
import { Command as Enable } from "./enable";
import { Command as extraFee } from "./extraFee";
import { Command as Fidelity } from "./fidelity";
import { Command as MaxCap } from "./maxCap";
import { Command as Memo } from "./memo";
import { Command as MinCap } from "./minCap";
import { Command as Mode } from "./mode";
import { Command as Passphrase } from "./passphrase";
import { Command as Pay } from "./pay";
import { Command as PayFees } from "./payFees";
import { Command as Reserve } from "./reserve";
import { Command as Routes } from "./routes";
import { Command as Sharing } from "./sharing";
import { Command as Unconfirmed } from "./unconfirmed";
import { Command as Whitelist } from "./whitelist";

export const Commands = [
    Blacklist,
    Configure,
    Disable,
    Enable,
    extraFee,
    MaxCap,
    Memo,
    MinCap,
    Passphrase,
    Pay,
    PayFees,
    Reserve,
    Routes,
    Sharing,
    Whitelist,
    Fidelity,
    Unconfirmed,
    Mode,
    Database,
];
