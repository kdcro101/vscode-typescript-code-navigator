
import * as path from "path";
import * as ts from "typescript";
import { File, TypescriptParser } from "typescript-parser";
import * as vscode from "vscode";
import { CompilerConfig } from "./class/compiler";

import { ContentParser } from "./class/parser";
import { MessageRevealData, WebviewMessage } from "./types/index";

import { Subject } from "rxjs";
import { debounceTime, delay, filter, map, take } from "rxjs/operators";
import { EditorMonitor } from "./class/editor-monitor";
import { PanelManager } from "./class/panel";

export function activate(context: vscode.ExtensionContext) {

    (global as any).vscode = vscode;
    const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    const config = vscode.workspace.getConfiguration();
    const monitor = new EditorMonitor(context);
    const panelManager = new PanelManager(context);
    const updateStatusbar = (active: boolean) => {
        if (active) {
            status.text = "TS Code navigator [ON]";
        } else {
            status.text = "TS Code navigator [OFF]";
        }
        status.show();
    };

    panelManager.eventCreate
        .subscribe((w) => monitor.setPanel(w));
    panelManager.eventDispose
        .subscribe(() => monitor.setPanel(null));

    context.subscriptions.push(vscode.commands.registerCommand("extension.showTypescriptMembers", () => {

        config.update("typescript.navigator.active", true, false);

        const _tsDoc = vscode.workspace.textDocuments.filter((sd) => sd.isClosed === false && sd.languageId === "typescript");
        if (_tsDoc.length > 0) {
            panelManager.create();

        }

    }));
    vscode.workspace.onDidChangeConfiguration((event: vscode.ConfigurationChangeEvent) => {
        setTimeout(() => {
            const active: boolean =  vscode.workspace.getConfiguration().get("typescript.navigator.active");
            updateStatusbar(active);
        });
    }, null, context.subscriptions);

    vscode.commands.registerCommand("extension.revealTypescriptMember", (uri: vscode.Uri, propStart: number, propEnd: number) => {

        for (const editor of vscode.window.visibleTextEditors) {
            if (editor.document.uri.toString() === uri.toString()) {
                const start = editor.document.positionAt(propStart);
                const end = editor.document.positionAt(propEnd + 1);

                const ps = editor.document.positionAt(propStart);
                const pe = editor.document.positionAt(propStart);
                // const pe = editor.document.positionAt(propEnd);

                editor.setDecorations(highlight, [new vscode.Range(start, end)]);
                setTimeout(() => editor.setDecorations(highlight, []), 1500);

                editor.revealRange(new vscode.Range(ps, pe), vscode.TextEditorRevealType.InCenter);

                vscode.window.showTextDocument(editor.document);
            }
        }
    });
    const highlight = vscode.window.createTextEditorDecorationType({ backgroundColor: "rgba(200,200,200,.35)" });

    const isActive: boolean = config.get("typescript.navigator.active");

    updateStatusbar(isActive);

    if (isActive) {
        vscode.commands.executeCommand("extension.showTypescriptMembers");
    }
}
