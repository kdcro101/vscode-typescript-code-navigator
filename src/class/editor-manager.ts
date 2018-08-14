import { fromEventPattern, Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";
import * as vscode from "vscode";

export class EditorManager {

    public list: vscode.TextEditor[] = [];
    private eventDestroy = new Subject<void>();

    constructor(private context: vscode.ExtensionContext) {

        // fromEventPattern<vscode.TextDocument>((f: (e: any) => any) => {
        //     return vscode.workspace.onDidOpenTextDocument(f, null, context.subscriptions);
        // }, (f: any, d: vscode.Disposable) => {
        //     d.dispose();
        // }).pipe(
        //     takeUntil(this.eventDestroy),
        // ).subscribe((m) => {

        // });

    }

    // public destroy() {

    // }

}
