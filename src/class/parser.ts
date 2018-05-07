import * as fs from "fs-extra";

import * as ts from "typescript";

import * as _ from "lodash";

import {
    ClassDeclaration,
    Declaration,
    EnumDeclaration,
    File,
    FunctionDeclaration, GenericDeclaration,
    getVisibilityText,
    InterfaceDeclaration,
    TypeAliasDeclaration,
    TypescriptParser,
    VariableDeclaration,
} from "typescript-parser";
import * as vscode from "vscode";
import { DocumentStateItem } from "../types";
import { CompilerConfig } from "./compiler";

// vscode.workspace.getConfiguration("root");

export class ContentParser {

    private static jsEmbedded: string = null;
    private static cssEmbedded: string = null;

    public parser = new TypescriptParser();
    public parsed: File = null;
    public textData: string = null;
    private fontFamily: string;
    private fontSize: number;

    private collapseEnums: boolean = false;
    private collapseInterfaces: boolean = false;
    private collapseClasses: boolean = false;
    private showVisibility: boolean = false;
    private showIcons: boolean = false;
    private showDataTypes: boolean = false;

    private compilerConfig: CompilerConfig = null;

    constructor(
        private context: vscode.ExtensionContext,
        public documentToParse: vscode.TextDocument,
        private docState: DocumentStateItem[]) {
        const c = vscode.workspace.getConfiguration(null, null);
        this.fontFamily = c.editor.fontFamily;
        this.fontSize = c.editor.fontSize;

        const config = vscode.workspace.getConfiguration();

        this.collapseEnums = config.get("typescript.navigator.collapseEnums") as boolean;
        this.collapseInterfaces = config.get("typescript.navigator.collapseInterfaces");
        this.collapseClasses = config.get("typescript.navigator.collapseClasses");

        this.showVisibility = config.get("typescript.navigator.showVisibilityLabels");
        this.showIcons = config.get("typescript.navigator.showIcons");
        this.showDataTypes = config.get("typescript.navigator.showDataTypes");

    }
    public generateHtml(): Promise<string> {
        return new Promise((resolve, reject) => {

            const d = this.documentToParse;
            console.log(`generateHtml ${d.uri.fsPath}`);

            if (d == null) {
                resolve("");
                return;
            }

            // this.compilerConfig = new CompilerConfig(d.uri);

            return this.loadResources()
                .then(() => {
                    // return this.parser.parseSource(d.getText());
                    const root = vscode.workspace.getWorkspaceFolder(this.documentToParse.uri);
                    return this.parser.parseFile(d.uri.fsPath, root.uri.fsPath);
                }).then((parsed: File) => {
                    return this.renderData(parsed);
                }).then((html) => {
                    resolve(html);
                }).catch((e) => {
                    console.error(e);
                    reject(e);
                });
        });
    }
    public loadResources(): Promise<void> {
        return new Promise((resolve, reject) => {

            if (ContentParser.jsEmbedded != null && ContentParser.cssEmbedded != null) {
                resolve();
                return;
            }

            Promise.all([
                fs.readFile(this.context.extensionPath + "/css/index.css"),
                fs.readFile(this.context.extensionPath + "/out/embedded/members.js"),
                fs.readFile(this.context.extensionPath + "/vendor/mark.min.js"),
            ]).then((results) => {
                const css = results[0];
                const js1 = results[1];
                const js2 = results[2];
                ContentParser.jsEmbedded = `${js1}\n${js2}`;
                ContentParser.cssEmbedded = `${css}`;

                resolve();

            });
        });
    }
    public renderData(data: File): Promise<string> {
        return new Promise((resolve, reject) => {
            console.log(data);

            const iconsPath = "vscode-resource:" + this.context.extensionPath + "/svg/symbol-sprite.svg";
            // const iconsPath = "vscode-resource:/symbol-sprite.svg";
            // var documentStatesRaw='${JSON.stringify(this.docState)}';
            // var documentStates= JSON.parse(documentStatesRaw);

            Promise.all([])
                .then((results) => {
                    return this.buildElements(data);
                }).then((elements) => {
                    resolve(`
                        <script>
                        var vscode = acquireVsCodeApi();
                        var documentId = '${this.documentToParse.uri.fsPath}';
                        ${ContentParser.jsEmbedded}
                        </script>
                        <style>
                            div.snippet .list{
                                font-size: ${this.fontSize}px;
                                font-family: ${this.fontFamily};
                            }
                            div.panel-top input{
                                font-family: ${this.fontFamily};
                            }
                            .quick-open-entry-icon {
	                            background-image: url("${iconsPath}");
	                            background-repeat: no-repeat;
                            }
				            ${ContentParser.cssEmbedded}
				        </style>
                        <div class="layout">
                            <div class="panel-top">
                                <input id="search" class="search" placeholder="Highlight..." />
                                <div id="filterActive" class="hidden">Filter active</div>
                                <div id="collapseAll" class="action" onclick="collapseAll()">Collapse all</div>
                                <div id="expandAll" class="action" onclick="expandAll()">Expand all</div>
                            </div>
                            <div class="snippet">
                                <div class="list">
                                ${elements}
                                </div>
                            </div>
                            <div class="panel-bottom">
                                <div id="showVisibility" class="action ${ this.showVisibility === true ? "enabled" : ""}"
                                     onclick="toggleShowVisibility()">VISIBILITY</div>
                                <div id="showIcons" class="action ${ this.showIcons === true ? "enabled" : ""}"
                                     onclick="toggleShowIcons()">ICONS</div>
                                <div id="showDataTypes" class="action ${ this.showDataTypes === true ? "enabled" : ""}"
                                    onclick="toggleShowDataTypes()">TYPES</div>
                                <div id="spinner" class="spinner invisible">
                                    <div class="rect1"></div>
                                    <div class="rect2"></div>
                                    <div class="rect3"></div>
                                    <div class="rect4"></div>
                                    <div class="rect5"></div>
                                </div>
                            </div>
                        </div>
                        <script>
                                var markInstance = new Mark(document.querySelectorAll("div.item .name, div.item .type"));
                                setupItemListeners();
                        </script>
                    `);
                }).catch((e) => {
                    console.log(e);
                    reject(e);
                });

        });
    }
    public buildElements(data: File): string {
        const ps = data.declarations.map((d) => this.buildDeclaration(d));
        return ps.join("");
    }
    public buildDeclaration(d: Declaration): string {

        const decltype = d.constructor.name;

        let p: string = "";

        switch (decltype) {

            case "AccessorDeclaration":
                break;
            case "ClassDeclaration":
                p = this.buildClassDeclaration(d as ClassDeclaration);
                break;
            case "ConstructorDeclaration":
                break;
            case "Declaration":
                break;
            case "DeclarationInfo":
                break;
            case "DeclarationVisibility":
                break;
            case "DefaultDeclaration":
                break;
            case "EnumDeclaration":
                p = this.buildEnumDeclaration(d as EnumDeclaration);
                break;
            case "FunctionDeclaration":
                p = this.buildFunctionDeclaration(d as FunctionDeclaration);
                break;
            case "InterfaceDeclaration":
                p = this.buildInterfaceDeclaration(d as InterfaceDeclaration);
                break;
            case "MethodDeclaration":
                break;
            case "ModuleDeclaration":
                break;
            case "ParameterDeclaration":
                break;
            case "PropertyDeclaration":
                break;
            case "TypeAliasDeclaration":
                p = this.buildTypeAliasDeclaration(d as TypeAliasDeclaration);
                break;
            case "VariableDeclaration":
                p = this.buildVariableDeclaration(d as VariableDeclaration);
                break;

        }
        return `<div class="root-declaration">${p}</div>`;
    }
    public buildEnumDeclaration(d: EnumDeclaration): string {

        const members = d.members != null ? _.sortBy(d.members, (i) => i) : [];
        const hasMembers = (members.length > 0 || members.length > 0) ? true : false;
        const memo = this.docState.find((e) => e.key === d.name);
        let isCollapsed: boolean = false;

        if (memo != null) {
            if (memo.value === "collapsed") {
                isCollapsed = true;
            }
        } else {
            if (this.collapseEnums) {
                isCollapsed = true;
            }
        }

        const id = this.generateId();
        const childId = hasMembers ? `child_${id}` : null;

        const elems: string[] = [this.renderPartial(d.start, d.end, "enum", d.name, d.isExported, null, null, null, childId, isCollapsed)];

        if (members.length > 0) {
            elems.push(`<div class="child methods">${members.map((dc) =>
                this.renderPartial(d.start, d.end, "field", dc)).join("")}</div>`);
        }

        return elems.join("");

    }
    public buildInterfaceDeclaration(d: InterfaceDeclaration): string {
        const props = d.properties != null ? _.sortBy(d.properties, (i) => i.name) : [];
        const methods = d.methods != null ? _.sortBy(d.methods, (i) => i.name) : [];
        const memo = this.docState.find((e) => e.key === d.name);

        const hasMembers = (props.length > 0 || methods.length > 0) ? true : false;
        const id = this.generateId();
        const childId = hasMembers ? `child_${id}` : null;

        let isCollapsed: boolean = false;

        if (memo != null) {
            if (memo.value === "collapsed") {
                isCollapsed = true;
            }
        } else {
            if (this.collapseInterfaces) {
                isCollapsed = true;
            }
        }

        const elems: string[] =
            [this.renderPartial(d.start, d.end, "interface", d.name, d.isExported, null, null, null, childId, isCollapsed)];

        if (props.length > 0 || methods.length > 0) {
            elems.push(`<div class="child" id="${childId}">
            ${props.map((dc) => {
                    return this.renderPartial(dc.start, dc.end, "property", dc.name, false, dc.type);
                }).join("")}
            ${methods.map((dc) => {
                    return this.renderPartial(dc.start, dc.end, "method", dc.name, false, dc.type);
                }).join("")}
            </div>`);
        }

        return elems.join("");

    }
    public buildClassDeclaration(d: ClassDeclaration): string {
        const props = d.properties != null ? _.sortBy(d.properties, (i) => i.name) : [];
        const methods = d.methods != null ? _.sortBy(d.methods, (i) => i.name) : [];

        const memo = this.docState.find((e) => e.key === d.name);

        const hasMembers = (props.length > 0 || methods.length > 0) ? true : false;
        const id = this.generateId();
        const childId = hasMembers ? `child_${id}` : null;

        let isCollapsed: boolean = false;
        if (memo != null) {
            if (memo.value === "collapsed") {
                isCollapsed = true;
            }
        } else {
            if (this.collapseClasses) {
                isCollapsed = true;
            }
        }

        const elems: string[] =
            [this.renderPartial(d.start, d.end, "class", d.name, d.isExported, null, null, null, childId, isCollapsed)];

        if (props.length > 0 || methods.length > 0) {
            elems.push(`<div class="child" id="${childId}">
            ${props.map((dc) => {
                    const pv = getVisibilityText(dc.visibility);
                    return this.renderPartial(dc.start, dc.end, "property", dc.name, false, dc.type, pv);
                }).join("")}
            ${methods.map((dc) => {
                    const mv = getVisibilityText(dc.visibility);
                    return this.renderPartial(dc.start, dc.end, "method", dc.name, false, dc.type, mv, dc.isAbstract);
                }).join("")}
            </div>`);
        }

        return elems.join("");

    }
    public buildVariableDeclaration(d: VariableDeclaration): string {

        const o = this.renderPartial(d.start, d.end, "variable", d.name, d.isExported, d.type);
        return o;

    }
    public buildFunctionDeclaration(d: FunctionDeclaration): string {

        const o = this.renderPartial(d.start, d.end, "function", d.name, d.isExported, d.type);
        return o;

    }
    public buildTypeAliasDeclaration(d: TypeAliasDeclaration): string {

        const o = this.renderPartial(d.start, d.end, "interface", d.name, d.isExported);
        return o;

    }
    public renderPartial(
        positionStart: number,
        positionEnd: number,
        context: string,
        name: string,
        exported: boolean = false,
        dataType?: string,
        visibility?: string,
        abstract?: boolean,
        collapseId?: string,
        isCollapsed?: boolean,
    ): string {

        const showVisibility = this.showVisibility === true ? true : false;
        const showDataTypes = this.showDataTypes === true ? true : false;

        const o = `
            <div id="parent_${collapseId}" name="${name}" class="item
            ${collapseId == null ? "" : "collapsable"}
            ${isCollapsed === true ? "collapsed" : ""}
            ${context}" uri="${encodeURIComponent(this.documentToParse.uri.toString())}"
            start="${positionStart}" end="${positionEnd}">
                <div class="collapse-wrapper">
                    <div class="collapse-action drop-down ${collapseId == null ? "hidden" : ""}" collapse="${collapseId}"></div>
                    <div class="collapse-action drop-up ${collapseId == null ? "hidden" : ""}" collapse="${collapseId}"></div>
                </div>
                <div class="icon quick-open-entry-icon ${context} ${this.showIcons === true ? "" : "hidden"}"></div>
                <div class="visibility private ${visibility === "private" && showVisibility ? "" : "hidden"}">pri</div>
                <div class="visibility public ${visibility === "public" && showVisibility ? "" : "hidden"}">pub</div>
                <div class="visibility protected ${visibility === "protected" && showVisibility ? "" : "hidden"}">pro</div>
                <div class="name">${name}</div>
                <div class="type ${dataType != null && showDataTypes === true ? "" : "hidden"}">${dataType}</div>
                <div class="abstract ${abstract === true ? "" : "hidden"}">abstract</div>
                <div class="exported ${exported === false ? "hidden" : ""}">exported</div>
           </div>`;

        return o;

    }
    private generateId(): string {
        return _.sampleSize("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789", 16).join("");
    }

}
