import * as path from "path";
import { Subject } from "rxjs";
import { debounceTime, filter, map } from "rxjs/operators";
import { ExtensionContext, TextDocument } from "vscode";
import * as vscode from "vscode";

export class PanelManager {
    public webViewPanel: vscode.WebviewPanel = null;
    public dontDeactivate: boolean = false;
    public eventCreate = new Subject<vscode.WebviewPanel>();
    public eventDispose = new Subject<void>();

    private eventWebviewDispose = new Subject<void>();
    private eventChangeDocumentList = new Subject<void>();
    private config = vscode.workspace.getConfiguration();
    private isActive: boolean = vscode.workspace.getConfiguration().get("typescript.navigator.active");

    constructor(private context: ExtensionContext) {

        vscode.workspace.onDidChangeConfiguration(() => {
            this.isActive = vscode.workspace.getConfiguration().get("typescript.navigator.active");
        }, null, this.context.subscriptions);

        vscode.window.onDidChangeActiveTextEditor((e: vscode.TextEditor) => {
            console.log("onDidChangeActiveTextEditor");
            this.eventChangeDocumentList.next();
        }, null, this.context.subscriptions);

        this.eventWebviewDispose.pipe(
            map<void, boolean>(() => this.dontDeactivate),
        ).subscribe((dontDeactivate) => {
            if (!dontDeactivate) {
                this.config.update("typescript.navigator.active", false, false);
            } else {
                // this.config.get("typescript.navigator.active", true);
            }
            // reset state!
            this.dontDeactivate = false;
            this.eventDispose.next();
            this.webViewPanel = null;
        });

    }

    public create(): vscode.WebviewPanel {
        if (this.webViewPanel != null) {
            return this.webViewPanel;
        }
        // const ae = vscode.window.activeTextEditor;

        this.webViewPanel = vscode.window.createWebviewPanel("typescriptNavigator", "Navigator", vscode.ViewColumn.Three, {
            enableScripts: true,
            retainContextWhenHidden: true,
            // And restric the webview to only loading content from our extension's `media` directory.
            localResourceRoots: [
                vscode.Uri.file(path.join(this.context.extensionPath, "svg")),
            ],
        });
        this.webViewPanel.onDidDispose(() => {
            this.eventWebviewDispose.next();
        }, null, this.context.subscriptions);

        this.eventCreate.next(this.webViewPanel);
        return this.webViewPanel;
    }
    private disposeTemporarily() {
        this.dontDeactivate = true;
        this.webViewPanel.dispose();

    }

}
