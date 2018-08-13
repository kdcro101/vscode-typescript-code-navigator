
import * as vscode from "vscode";
import { EditorMonitor } from "./class/editor-monitor";
import { PanelManager } from "./class/panel";

export function activate(context: vscode.ExtensionContext) {

    (global as any).vscode = vscode;

    const config = vscode.workspace.getConfiguration();
    const monitor = new EditorMonitor(context);
    const panelManager = new PanelManager(context);
    const highlight = vscode.window.createTextEditorDecorationType({ backgroundColor: "rgba(200,200,200,.35)" });
    const isActive: boolean = config.get("typescript.navigator.active");

    panelManager.eventCreate
        .subscribe((w) => monitor.setPanel(w));
    panelManager.eventDispose
        .subscribe(() => monitor.setPanel(null));

    context.subscriptions.push(vscode.commands.registerCommand("extension.showTypescriptMembers", () => {
        config.update("typescript.navigator.active", true, false);
        panelManager.create();
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

            }
        }
    });

    if (isActive) {
        vscode.commands.executeCommand("extension.showTypescriptMembers");
    }
}
