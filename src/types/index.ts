import { Declaration } from "typescript-parser";
import * as vscode from "vscode";

export interface WebviewMessage<T> {
    command: string;
    data: T;
}
export interface MessageRevealData {
    start: number;
    end: number;
    uri: string;
}
export interface MessageCollapseStateData {
    id: string;
    state: boolean;
    document_id: string;
}
export interface WebviewMessage<T> {
    command: string;
    data: T;
}

export interface DocumentStateItem {
    document_id: string;
    family: string;
    key: string;
    value: string;
}
export interface DocumentMemory {
    [key: string]: DocumentStateItem[];
}
export interface DocumentUpdateBundle {
    ignoreFsPathCheck: boolean;
    document: vscode.TextDocument;
}

export interface ClassMember {
    type: string;
    declaration: Declaration;
}
