
import * as path from "path";
import * as ts from "typescript";
import { File, TypescriptParser } from "typescript-parser";
import * as vscode from "vscode";
import { CompilerConfig } from "./class/compiler";

import { ContentParser } from "./class/parser";
import { MessageRevealData, WebviewMessage } from "./types/index";

import { Subject } from "rxjs";
import { debounceTime, delay, filter, map } from "rxjs/operators";
import { EditorMonitor } from "./class/editor-monitor";

export function activate(context: vscode.ExtensionContext) {

    (global as any).vscode = vscode;

    let navigatorPanel: vscode.WebviewPanel = null;
    const monitor = new EditorMonitor(context);

    context.subscriptions.push(vscode.commands.registerCommand("extension.showTypescriptMembers", () => {

        if (navigatorPanel) {
            navigatorPanel.reveal(vscode.ViewColumn.Three);
            return;
        }

        navigatorPanel = vscode.window.createWebviewPanel("typescriptNavigator", "Navigator", vscode.ViewColumn.Three, {
            enableScripts: true,
            // And restric the webview to only loading content from our extension's `media` directory.
            localResourceRoots: [
                vscode.Uri.file(path.join(context.extensionPath, "svg")),
            ],
        });
        monitor.setPanel(navigatorPanel);
        navigatorPanel.webview.onDidReceiveMessage((message: WebviewMessage<MessageRevealData>) => {
            switch (message.command) {
                case "reveal":
                    const data = message.data;
                    vscode.commands.executeCommand("extension.revealTypescriptMember", data.uri, data.start, data.end);
                    return;
            }
        }, undefined, context.subscriptions);

        navigatorPanel.onDidDispose(() => {
            navigatorPanel = null;
            monitor.setPanel(null);
        });

    }));

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
    vscode.commands.executeCommand("extension.showTypescriptMembers");

}
