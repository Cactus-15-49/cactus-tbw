import { Identities, Interfaces, Utils } from "@solar-network/crypto";
import Sqlite from "better-sqlite3";
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from "fs";

import { history, modes, settingsType } from "./interfaces";
import { validateSettings } from "./utils/validation";

export class Database {
    private db;
    private configFile: string;
    private path: string;
    public constructor(path: string) {
        if (!existsSync(path) || !lstatSync(path).isDirectory()) {
            mkdirSync(path, { recursive: true });
        }
        this.path = `${path}${path.endsWith("/") ? "" : "/"}`;
        this.db = new Sqlite(`${this.path}tbw.db`);
        this.configFile = `${this.path}config.json`;
    }

    public setup() {
        this.db
            .prepare(
                `
            CREATE TABLE IF NOT EXISTS history (
                num INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                height INTEGER NOT NULL,
                confirmHeight INTEGER DEFAULT NULL,
                id TEXT NOT NULL UNIQUE,
                addresses TEXT NOT NULL,
                totalAmount TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                tx TEXT NOT NULL,
                status TEXT DEFAULT "PENDING" NOT NULL
            );
        `,
            )
            .run();
        this.db
            .prepare(
                `
            CREATE TABLE IF NOT EXISTS tbw (
                height INTEGER NOT NULL,
                timestamp INTEGER NOT NULL,
                reward TEXT NOT NULL,
                fees TEXT NOT NULL,
                address TEXT NOT NULL,
                weight TEXT NOT NULL,
                PRIMARY KEY (height, address)
            );
        `,
            )
            .run();
    }

    // Whitelist

    public getWhitelist(): string[] {
        const settings = this.readFile();
        return settings.whitelist;
    }

    public addToWhitelist(address: string, desc?: string) {
        const settings = this.readFile();
        settings.whitelist.push(address);
        this.writeFile(settings);
    }

    public removeFromWhitelist(address: string) {
        const settings = this.readFile();
        settings.whitelist = settings.whitelist.filter((a) => a !== address);
        this.writeFile(settings);
    }

    public removeWhitelist() {
        const settings = this.readFile();
        settings.whitelist = [];
        this.writeFile(settings);
    }

    // Blacklist

    public getBlacklist(): string[] {
        const settings = this.readFile();
        return settings.blacklist;
    }

    public addToBlacklist(address: string, reason?: string) {
        const settings = this.readFile();
        settings.blacklist.push(address);
        this.writeFile(settings);
    }

    public removeFromBlacklist(address: string) {
        const settings = this.readFile();
        settings.blacklist = settings.blacklist.filter((a) => a !== address);
        this.writeFile(settings);
    }

    public removeBlacklist() {
        const settings = this.readFile();
        settings.blacklist = [];
        this.writeFile(settings);
    }

    // History

    public addHistory(height: number, tx: Interfaces.ITransactionData) {
        if (tx.typeGroup !== 1 || tx.type !== 6) {
            throw new Error("Trying to save in history a transaction that is not transfer");
        }

        this.db
            .prepare(
                "INSERT INTO history (height, id, addresses, totalAmount, timestamp, tx) VALUES (?, ?, ?, ?, ?, ?)",
            )
            .run(
                height,
                tx.id,
                JSON.stringify([...new Set(tx.asset!.transfers!.map((t) => t.recipientId))]),
                tx
                    .asset!.transfers!.map((t) => t.amount)
                    .reduce((partialSum, a) => partialSum.plus(a), Utils.BigNumber.ZERO)
                    .toString(),
                Math.round(Date.now() / 1000),
                JSON.stringify(tx),
            );
    }

    public setTransactionToConfimed(id: string, height: number): boolean {
        const info = this.db
            .prepare("UPDATE history SET status = 'CONFIRMED', confirmHeight = ? WHERE id = ?")
            .run(height, id);
        if (info.changes < 1) {
            return false;
        }
        return true;
    }

    public setTransactionToAcceptedById(id: string): boolean {
        const info = this.db.prepare("UPDATE history SET status = 'ACCEPTED' WHERE id = ?").run(id);
        if (info.changes < 1) {
            return false;
        }
        return true;
    }

    public setTransactionToAcceptedByHeightDuringRollback(height: number): boolean {
        const info = this.db
            .prepare(
                "UPDATE history SET status = 'ACCEPTED', confirmHeight = NULL WHERE confirmHeight = ? AND status = 'CONFIRMED'",
            )
            .run(height);
        if (info.changes < 1) {
            return false;
        }
        return true;
    }

    public setTransactionToError(id: string): boolean {
        const info = this.db.prepare("UPDATE history SET status = 'ERROR' WHERE id = ?").run(id);
        if (info.changes < 1) {
            return false;
        }
        return true;
    }

    public setTransactionToRepaid(id: string): boolean {
        const info = this.db.prepare("UPDATE history SET status = 'REPAID' WHERE id = ?").run(id);
        if (info.changes < 1) {
            return false;
        }
        return true;
    }

    public getLastPayHeight(): number {
        return this.db.prepare("SELECT MAX(height) AS height FROM history").get().height || 0;
    }

    public getNotConfirmedTransactions(): history[] {
        return this.db.prepare("SELECT * FROM history WHERE status <> 'CONFIRMED' AND status <> 'REPAID'").all();
    }

    public getAllHistory() {
        return this.db.prepare("SELECT * FROM history").all();
    }

    public saveAndDeleteHistory(): boolean {
        const history = this.getAllHistory();
        if (history) {
            writeFileSync(`${this.path}history-${Date.now() / 1000}`, JSON.stringify(history, null, 4));
        }
        const info = this.db.prepare("DELETE FROM history").run();
        if (info.changes < 1) {
            return false;
        }
        return true;
    }

    // Routes

    public getRoutes(): { [key: string]: string } {
        const settings = this.readFile();
        return settings.routes;
    }

    public addRoute(source: string, destination: string) {
        const settings = this.readFile();
        settings.routes[source] = destination;
        this.writeFile(settings);
    }

    public removeFromRoute(source: string) {
        const settings = this.readFile();
        delete settings.routes[source];
        this.writeFile(settings);
    }

    public removeRoutes() {
        const settings = this.readFile();
        settings.routes = {};
        this.writeFile(settings);
    }

    // Settings

    public updateReserve(reserve: { [key: string]: number }) {
        const settings = this.readFile();
        settings.reserve = reserve;
        this.writeFile(settings);
    }

    public updateSettings(key: string, value: string | number | null) {
        const settings = this.readFile();
        settings[key] = value;
        this.writeFile(settings);
    }

    public getSettings(): settingsType | undefined {
        try {
            return this.readFile();
        } catch {
            return undefined;
        }
    }

    public getDelegatePublicKey(): string | undefined {
        try {
            const settings = this.readFile();
            const passphrase = settings.pp1;
            return passphrase ? Identities.PublicKey.fromPassphrase(passphrase) : undefined;
        } catch {
            return undefined;
        }
    }

    public createSettingsFile(): settingsType {
        const config: settingsType = {
            blacklist: [],
            mode: modes.classic,
            routes: {},
            whitelist: [],
            sharing: 0,
            extraFee: 0,
            max: null,
            min: null,
            fidelity: null,
            memo: "",
            payFees: "n",
            reserve: {},
            pp1: null,
            pp2: null,
        };
        this.writeFile(config);
        return config;
    }

    // Tbw

    public getTbwBlocksFromHeight(height: number): Array<{
        height: number;
        weight: Utils.BigNumber;
        address: string;
        rewards: Utils.BigNumber;
        fees: Utils.BigNumber;
    }> {
        const voters = this.db
            .prepare(`SELECT address, weight, height, reward, fees FROM tbw WHERE height >= ?`)
            .all(height);
        return voters.map((v) => {
            return {
                height: v.height,
                weight: Utils.BigNumber.make(v.weight),
                address: v.address,
                rewards: Utils.BigNumber.make(v.reward),
                fees: Utils.BigNumber.make(v.fees),
            };
        });
    }

    public getBalancesBetweenHeights(
        startHeight: number,
        endHeight: number,
    ): Array<{ height: number; weight: Utils.BigNumber; address: string }> {
        const weights = this.db
            .prepare(`SELECT weight, height, address FROM tbw WHERE height >= ? AND height <= ?`)
            .all(startHeight, endHeight);
        return weights.map((w) => {
            return {
                weight: Utils.BigNumber.make(w.weight),
                height: w.height,
                address: w.address,
            };
        });
    }

    public insertVote(
        height: number,
        timestamp: number,
        reward: Utils.BigNumber,
        fees: Utils.BigNumber,
        address: string,
        weight: Utils.BigNumber,
    ) {
        this.db
            .prepare(`INSERT INTO tbw (height, timestamp, reward, fees, address, weight) VALUES (?, ?, ?, ?, ?, ?)`)
            .run(height, timestamp, reward.toString(), fees.toString(), address, weight.toString());
    }

    public deleteVotesAfterHeight(height: number): boolean {
        const info = this.db.prepare("DELETE FROM tbw WHERE height >= ?").run(height);
        if (info.changes < 1) {
            return false;
        }
        return true;
    }

    private writeFile(settings: settingsType) {
        const isInvalid = validateSettings(settings);
        if (isInvalid) {
            throw new Error(`Trying to write an invalid settings file. ${isInvalid}`);
        }
        writeFileSync(this.configFile, JSON.stringify(settings, null, 4));
    }

    private readFile(): settingsType {
        if (!existsSync(this.configFile) || !lstatSync(this.configFile).isFile()) {
            throw new Error("Could not read settings.");
        }
        const settings = JSON.parse(readFileSync(this.configFile).toString());
        const isInvalid = validateSettings(settings);
        if (isInvalid) {
            throw new Error(`Settings json is invalid. ${isInvalid}`);
        }
        return settings;
    }
}
