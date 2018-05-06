import * as fs from "fs-extra";
import * as path from "path";
import * as ts from "typescript";
import * as vscode from "vscode";

export class CompilerConfig {
    public target: string = null;
    public compilerOptions: ts.CompilerOptions = null;

    public parseConfigHost: ts.ParseConfigHost = {
        fileExists: ts.sys.fileExists,
        readDirectory: ts.sys.readDirectory,
        readFile: (file) => fs.readFileSync(file, "utf8"),
        useCaseSensitiveFileNames: true,
    };

    constructor(uri: vscode.Uri) {

        try {

        const bp = path.dirname(uri.fsPath);
        const configFile = ts.findConfigFile(bp, ts.sys.fileExists);
        const configData = ts.readConfigFile(configFile, (configPath: string) => {
            return fs.readFileSync(configPath).toString();
        });
        this.target = configData.config.compilerOptions.target;
        const converted = ts.convertCompilerOptionsFromJson(configData.config.compilerOptions, bp);
        if (converted == null || converted.errors.length > 0) {
            vscode.window.showErrorMessage(converted.errors.join(" "));
            return;
        }
        this.compilerOptions = converted.options;
        } catch (e) {
            console.error("Error in CompilerConfig");
            console.log(e);
        }

    }

}
