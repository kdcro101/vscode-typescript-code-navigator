import * as path from "path";
import { Subject } from "rxjs";
import * as vscode from "vscode";
import { ExtensionContext } from "vscode";

export class PanelManager {
    public webViewPanel: vscode.WebviewPanel = null;
    public dontDeactivate: boolean = false;
    public eventCreate = new Subject<PanelManager>();
    public eventDispose = new Subject<void>();

    constructor(private context: ExtensionContext) {

    }

    public create(): vscode.WebviewPanel {
        if (this.webViewPanel != null) {
            return this.webViewPanel;
        }

        this.webViewPanel = vscode.window.createWebviewPanel("typescriptNavigator", "Navigator", {
            viewColumn: vscode.ViewColumn.Three,
            preserveFocus: true,
        }, {
                enableScripts: true,
                retainContextWhenHidden: true,

                localResourceRoots: [
                    vscode.Uri.file(path.join(this.context.extensionPath, "svg")),
                ],
            });

        this.webViewPanel.iconPath = vscode.Uri.file(path.join(this.context.extensionPath, "icon", "icon.png"));

        this.webViewPanel.onDidDispose(() => {
            this.webViewPanel = null;
            this.eventDispose.next();
        }, null, this.context.subscriptions);

        this.eventCreate.next(this);
        return this.webViewPanel;
    }

    public close() {
        console.log(`panelManager.close()`);
        if (this.webViewPanel == null) {
            console.log(`panel is null`);
            return;
        }
        this.webViewPanel.dispose();
        this.webViewPanel = null;

    }

}
