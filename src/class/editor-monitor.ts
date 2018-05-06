import * as path from "path";
import { Subject } from "rxjs";
import { debounceTime, distinctUntilChanged, distinctUntilKeyChanged, filter, map, tap } from "rxjs/operators";
import * as vscode from "vscode";

import { DocumentMemory, MessageCollapseStateData, WebviewMessage } from "../types";
import { DocumentStateItem } from "../types/index";
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
    public eventDocumentUpdate = new Subject<vscode.TextDocument>();
    public eventMessage = new Subject<WebviewMessage<any>>();

    public lastUri: vscode.Uri = null;
    public lastFsPath: string = null;
    public lastHtml: string = null;
    private panel: vscode.WebviewPanel = null;
    private diposableMessage: vscode.Disposable = null;

    private memo: DocumentMemory = {};

    constructor(private context: vscode.ExtensionContext) {

        context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration((e: vscode.ConfigurationChangeEvent) => this.eventChangeConfiguration.next(e)),
        );
        context.subscriptions.push(
            vscode.workspace.onDidCloseTextDocument((e: vscode.TextDocument) => this.eventCloseTextDocument.next(e)),
        );
        context.subscriptions.push(
            vscode.window.onDidChangeActiveTextEditor((e: vscode.TextEditor) => this.eventChangeActiveTextEditor.next(e)),
        );
        context.subscriptions.push(
            vscode.workspace.onDidChangeTextDocument((e: vscode.TextDocumentChangeEvent) => this.eventChangeTextDocument.next(e)),
        );
        context.subscriptions.push(
            vscode.window.onDidChangeTextEditorSelection((e: vscode.TextEditorSelectionChangeEvent) =>
                this.eventChangeTextEditorSelection.next(e)));

        this.eventCloseTextDocument.pipe(
            filter((d) => d != null),
        ).subscribe((d) => {
            const id = d.uri.fsPath;
            delete this.memo[id];
        });

        this.eventChangeConfiguration.pipe(
            filter(() => vscode.window.activeTextEditor != null),
            filter(() => vscode.window.activeTextEditor.document != null),
            filter(() => vscode.window.activeTextEditor.document.languageId === "typescript"),
            map<any, vscode.TextDocument>(() => vscode.window.activeTextEditor.document),
        ).subscribe((d) => this.eventDocumentUpdate.next(d));

        this.eventChangeActiveTextEditor.pipe(
            filter((d) => d != null && d.document != null),
            filter((d) => d.document.languageId !== "typescript"),
        ).subscribe((d) => this.updatePanelNotTypescript(d.document));

        this.eventChangeActiveTextEditor.pipe(
            filter((d) => d != null && d.document != null),
            map<vscode.TextEditor, ChangeActiveTextEditorEvent>((d) => {
                return {
                    editor: d,
                    path: d.document.uri.fsPath,
                };
            }),
            distinctUntilKeyChanged("path"),
            filter((d) => d.editor.document.languageId === "typescript"),
            tap((d) => {
                this.lastFsPath = d.path;
                this.lastUri = d.editor.document.uri;
            }),
        ).subscribe((d) => this.eventDocumentUpdate.next(d.editor.document));

        this.eventChangeTextDocument.pipe(
            filter((d) => d != null && d.document != null),
            debounceTime(500),
        ).subscribe((d) => this.eventDocumentUpdate.next(d.document));

        this.eventDocumentUpdate.pipe(
            tap((d) => {
                const documentId = d.uri.fsPath;
                if (this.memo[documentId] == null) {
                    this.memo[documentId] = [];
                }
            }),
        ).subscribe((d) => this.updatePanel(d));

        this.eventMessage.pipe(
            filter((d) => d.command === "toggleState"),
        ).subscribe((d) => this.saveCollapseState(d));
        this.eventMessage.pipe(
            filter((d) => d.command === "focusEditor"),
            filter(() => this.lastUri != null),
        ).subscribe((d) => {
            vscode.window.showTextDocument(this.lastUri);
        });

    }
    public updatePanel(d: vscode.TextDocument) {
        const data = this.memo[d.uri.fsPath];

        const parser = new ContentParser(this.context, d, data);
        this.panel.title = path.basename(d.uri.fsPath);

        parser.generateHtml()
            .then((result) => {
                this.panel.webview.html = result;
            })
            .catch((error) => {
                this.panel.webview.html = error;
            });

    }
    public updatePanelNotTypescript(d: vscode.TextDocument) {
        const data = this.memo[d.uri.fsPath];

        const parser = new ContentParser(this.context, d, data);
        this.panel.title = path.basename(d.uri.fsPath);

        this.panel.webview.html = `
                <style>
                    .error{
                        padding:16px;
                        color:red;
                    }
                </style>
                <div class="error">Opened document is not typescript file</div>
        `;

    }
    public setPanel(val: vscode.WebviewPanel) {
        this.panel = val;
        const ae = vscode.window.activeTextEditor;

        if (val == null) {
            if (this.diposableMessage != null) {
                this.diposableMessage.dispose();
            }
            return;
        }

        if (val != null && ae != null) {
            this.eventDocumentUpdate.next(ae.document);
        }
        this.diposableMessage = this.panel.webview.onDidReceiveMessage((m: WebviewMessage<any>) => this.eventMessage.next(m));
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
}
