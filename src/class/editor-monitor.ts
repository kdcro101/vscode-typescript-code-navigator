import { fromEventPattern, merge as observableMerge, Subject } from "rxjs";
import { debounceTime, filter, map, tap } from "rxjs/operators";
import * as vscode from "vscode";
import { DocumentMemory, DocumentUpdateBundle, MessageCollapseStateData, WebviewMessage } from "../types";
import { DocumentStateItem } from "../types/index";
import { PanelManager } from "./panel";
import { ContentParser } from "./parser";

export interface ChangeActiveTextEditorEvent {
    editor: vscode.TextEditor;
    path: string;
}
export class EditorMonitor {
    public eventChangeConfiguration = new Subject<vscode.ConfigurationChangeEvent>();
    public eventChangeActiveTextEditor = new Subject<vscode.TextEditor>();
    public eventChangeTextDocument = new Subject<vscode.TextDocumentChangeEvent>();
    public eventChangeTextEditorSelection = new Subject<vscode.TextEditorSelectionChangeEvent>();
    public eventCloseTextDocument = new Subject<vscode.TextDocument>();
    public eventDocumentNotTypescript = new Subject<void>();

    public eventDocumentLoad = new Subject<void>();
    public eventDocumentUpdate = new Subject<DocumentUpdateBundle>();
    public eventMessage = new Subject<WebviewMessage<any>>();

    public lastUri: vscode.Uri = null;
    public lastFsPath: string = null;
    public lastHtml: string = null;

    public lastEditor: vscode.TextEditor = null;
    public lastDocumentActionable: vscode.TextDocument = null;
    public lastDocumentFocusable: vscode.TextDocument = null;
    private panel: vscode.WebviewPanel = null;
    private panelManager: PanelManager = null;

    private memo: DocumentMemory = {};

    private visibleEditors: vscode.TextEditor[] = [];

    constructor(private context: vscode.ExtensionContext) {

        fromEventPattern<vscode.TextEditor[]>((f: (e: any) => any) => {
            return vscode.window.onDidChangeVisibleTextEditors(f, null, context.subscriptions);
        }, (f: any, d: vscode.Disposable) => {
            d.dispose();
        }).pipe(
            debounceTime(300),
            filter((e) => e.length === 0),
            filter(() => this.panelManager != null),
        ).subscribe((m) => {
            this.panel = null;
            this.panelManager.close();
        });

        context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration((e: vscode.ConfigurationChangeEvent) => {
                this.eventChangeConfiguration.next(e);
            }),
        );
        context.subscriptions.push(
            vscode.workspace.onDidCloseTextDocument((e: vscode.TextDocument) => {
                this.eventCloseTextDocument.next(e);
            }),
        );
        context.subscriptions.push(
            vscode.window.onDidChangeVisibleTextEditors((e: vscode.TextEditor[]) => {
                this.visibleEditors = e;
            }),
        );
        context.subscriptions.push(
            vscode.window.onDidChangeActiveTextEditor((e: vscode.TextEditor) => {
                this.eventChangeActiveTextEditor.next(e);
            }),
        );
        context.subscriptions.push(
            vscode.workspace.onDidChangeTextDocument((e: vscode.TextDocumentChangeEvent) => {
                this.eventChangeTextDocument.next(e);
            }),
        );
        context.subscriptions.push(
            vscode.window.onDidChangeTextEditorSelection((e: vscode.TextEditorSelectionChangeEvent) => {
                this.eventChangeTextEditorSelection.next(e);
            }));

        this.eventCloseTextDocument.pipe(
            filter((d) => d != null),
        ).subscribe((d) => {
            const id = d.uri.fsPath;
            delete this.memo[id];
        });

        this.eventChangeConfiguration.pipe(
        ).subscribe((d) => {
            this.eventDocumentUpdate.next({
                document: this.lastDocumentActionable,
                ignoreFsPathCheck: false,
            });
        });

        observableMerge(
            this.eventChangeActiveTextEditor.pipe(
                filter((d) => d == null || (d != null && d.document != null && d.document.languageId !== "typescript")),
            ),
        ).pipe(
            filter(() => this.panel != null),
            map<vscode.TextEditor, vscode.TextDocument>((d) => d != null && d.document != null ? d.document : null),
            // filter(() => this.panel.visible === false),
        ).subscribe((d) => {
            this.updatePanelNotTypescript(d);
        });

        this.eventChangeActiveTextEditor.pipe(
            filter((d) => d != null && d.document != null),
        ).subscribe((d) => {

            this.lastEditor = d;
            this.lastDocumentFocusable = d.document;
        });

        this.eventChangeActiveTextEditor.pipe(
            filter(() => this.panel != null),
            filter((d) => d != null && d.document != null),
            map<vscode.TextEditor, ChangeActiveTextEditorEvent>((d) => {
                return {
                    editor: d,
                    path: d.document.uri.fsPath,
                };
            }),
            filter((d) => d.editor.document.languageId === "typescript"),
        ).subscribe((d) => this.eventDocumentUpdate.next({
            document: d.editor.document,
            ignoreFsPathCheck: false,
        }));

        this.eventChangeTextDocument.pipe(
            filter(() => this.panel != null),
            filter((d) => d != null && d.document != null),
            filter((d) => d.document.languageId === "typescript"),
            debounceTime(500),
        ).subscribe((d) => this.eventDocumentUpdate.next({
            document: d.document,
            ignoreFsPathCheck: true,
        }));

        this.eventDocumentUpdate.pipe(
            filter(() => this.panel != null),
            filter((d) => d.document.languageId === "typescript"),
            filter((d) => d.ignoreFsPathCheck || (this.lastFsPath !== d.document.uri.fsPath)),
            tap((d) => {
                this.lastFsPath = d.document.uri.fsPath;
                this.lastUri = d.document.uri;

                const documentId = d.document.uri.fsPath;
                if (this.memo[documentId] == null) {
                    this.memo[documentId] = [];
                }
            }),
            tap((d) => this.lastDocumentActionable = d.document),
        ).subscribe((d) => this.updatePanel(d.document));

        this.eventMessage.pipe(
            filter((d) => d.command === "toggleState"),
        ).subscribe((d) => this.saveCollapseState(d));

        this.eventMessage.pipe(
            filter((d) => d.command === "toggleShowIcons"),
        ).subscribe((d) => this.toggleShowIcons());

        this.eventMessage.pipe(
            filter((d) => d.command === "toggleShowVisibility"),
        ).subscribe((d) => this.toggleShowVisibility());

        this.eventMessage.pipe(
            filter((d) => d.command === "toggleShowDataTypes"),
        ).subscribe((d) => this.toggleShowDataTypes());

        this.eventMessage.pipe(
            filter((d) => d.command === "focusEditor"),
            filter(() => this.lastEditor != null),
        ).subscribe((d) => {
            // vscode.window.showTextDocument(this.lastUri, {
            //     viewColumn: ViewColumn.Active,
            // });
            // this.lastEditor.show();
        });

        this.eventMessage.pipe(
            filter((d) => d.command === "reveal"),
        ).subscribe((d) => {
            const data = d.data;
            vscode.commands.executeCommand("extension.revealTypescriptMember", data.uri, data.start, data.end);
        });

    }
    public updatePanel(d: vscode.TextDocument) {
        const data = this.memo[d.uri.fsPath];

        const parser = new ContentParser(this.context, d, data);
        this.panel.title = "Code Navigator";

        parser.generateHtml()
            .then((result) => {
                this.panel.webview.html = result;
            })
            .catch((error) => {
                this.panel.webview.html = "Error";
            });

    }
    public updatePanelNotTypescript(d: vscode.TextDocument) {
        this.lastFsPath = null;

        this.panel.title = "Code Navigator";
        this.panel.webview.html = ``;

    }
    public setPanel(p: PanelManager) {

        if (p == null) {
            this.panel = null;
            this.panelManager = null;
            return;
        }
        this.panelManager = p;
        this.panel = p.webViewPanel;
        const ae = vscode.window.activeTextEditor;

        if (ae != null) {
            this.eventDocumentUpdate.next({
                document: ae.document,
                ignoreFsPathCheck: false,
            });
        }

        this.panel.webview.onDidReceiveMessage((m: WebviewMessage<any>) => {
            this.eventMessage.next(m);
        }, null, this.context.subscriptions);

        this.panel.onDidDispose(() => {
            this.lastFsPath = null;
            this.lastUri = null;
        }, null, this.context.subscriptions);
    }
    public saveCollapseState(m: WebviewMessage<MessageCollapseStateData>) {

        const data = this.memo[m.data.document_id];
        const oldIndex = data.findIndex((d) => d.family === "toggleState" && d.key === m.data.id);

        const o: DocumentStateItem = {
            document_id: m.data.document_id,
            family: "toggleState",
            key: m.data.id,
            value: m.data.state === true ? "collapsed" : "expanded",
        };

        if (oldIndex > -1) {
            data.splice(oldIndex, 1);
        }
        data.push(o);
        this.memo[m.data.document_id] = data;
        return;
    }

    private toggleShowIcons() {
        const config = vscode.workspace.getConfiguration();

        const current = config.get("typescript.navigator.showIcons");
        const next = !current;
        config.update("typescript.navigator.showIcons", next)
            .then((result) => {

                const m: WebviewMessage<boolean> = {
                    command: "toggleShowIconsDone",
                    data: next,
                };

                setTimeout(() => this.panel.webview.postMessage(m), 100);
            });

    }
    private toggleShowVisibility() {
        const config = vscode.workspace.getConfiguration();

        const current = config.get("typescript.navigator.showVisibilityLabels");
        const next = !current;
        config.update("typescript.navigator.showVisibilityLabels", next)
            .then((result) => {

                const m: WebviewMessage<boolean> = {
                    command: "toggleShowVisibilityDone",
                    data: next,
                };
                setTimeout(() => this.panel.webview.postMessage(m), 100);
            });

    }
    private toggleShowDataTypes() {
        const config = vscode.workspace.getConfiguration();

        const current = config.get("typescript.navigator.showDataTypes");
        const next = !current;
        config.update("typescript.navigator.showDataTypes", next)
            .then((result) => {

                const m: WebviewMessage<boolean> = {
                    command: "toggleShowDataTypesDone",
                    data: next,
                };
                setTimeout(() => this.panel.webview.postMessage(m), 100);

            });

    }
}
