import { DocumentStateItem, MessageCollapseStateData, MessageRevealData, WebviewMessage } from "../src/types/index";

// tslint:disable-next-line:no-var-keyword
declare var vscode: any;
declare var documentId: string;
declare var documentStatesRaw: string;
declare var documentStates: DocumentStateItem[];

let lastActivatedItem: HTMLDivElement = null;

window.addEventListener("message", (event) => {
    const message = event.data; // The JSON data our extension sent
    console.log("onMessage=", message);
});

function runMessage(uri: string, s: number, e: number) {

    const o: WebviewMessage<MessageRevealData> = {
        command: "reveal",
        data: {
            end: e,
            start: s,
            uri,
        },
    };
    vscode.postMessage(o);

}

function setupItemListeners() {

    const collapseElements = document.querySelectorAll("div.collapse-action");

    for (let i = 0; i < collapseElements.length; i++) {
        const e: HTMLElement = collapseElements.item(i) as HTMLElement;
        e.addEventListener("mousedown", onCollapseAction.bind(e), false);
    }

    const matches = document.querySelectorAll("div.item");

    for (let i = 0; i < matches.length; i++) {
        const e: HTMLElement = matches.item(i) as HTMLElement;
        e.addEventListener("mousedown", onItemClick.bind(e), false);
        e.addEventListener("mouseup", onItemRelease.bind(e), false);
    }

    const searchElement: HTMLInputElement = document.getElementById("search") as HTMLInputElement;
    searchElement.addEventListener("keyup", () => { filterItems(searchElement.value); });

    document.addEventListener("mouseup", () => {
        if (lastActivatedItem != null) {
            lastActivatedItem.classList.remove("active");
        }
    }, true);

}
function onItemRelease(e: Event) {

    const element: HTMLElement = this;
    element.classList.remove("active");
}
function onItemClick(e: Event) {

    console.log("onItemClick");
    e.preventDefault();
    e.stopImmediatePropagation();
    e.stopPropagation();

    const element: HTMLElement = this;

    const uri = decodeURIComponent(element.getAttribute("uri"));
    const start = parseInt(element.getAttribute("start"), 10);
    const end = parseInt(element.getAttribute("end"), 10);
    console.log(`item=${uri} ${start} ${end}`);

    element.classList.add("active");
    lastActivatedItem = element as HTMLDivElement;
    runMessage(uri, start, end);

}
function onCollapseAction(e: Event) {

    console.log("onCollapseAction");
    e.preventDefault();
    e.stopImmediatePropagation();
    e.stopPropagation();

    const element = this;
    const collapse = element.getAttribute("collapse");
    console.log(`click => ${collapse}`);
    e.preventDefault();
    e.stopImmediatePropagation();
    e.stopPropagation();
    toggleCollapse(collapse);
}

function toggleCollapse(childId: string) {
    console.log(`toggling ${childId}`);
    const parent: HTMLDivElement = document.getElementById(`parent_${childId}`) as HTMLDivElement;

    if (parent == null) {
        return;
    }
    let state: boolean = false;
    const hasClass = parent.classList.contains("collapsed");
    const name = parent.getAttribute("name");

    if (hasClass) {
        doItemExpand(parent);
        state = false;
    } else {
        doItemCollapse(parent);
        state = true;
    }

    focusBackToEditor();

}
function doItemExpand(item: HTMLDivElement) {
    const hasClass = item.classList.contains("collapsed");
    if (hasClass) {
        item.classList.remove("collapsed");
    }
    const name = item.getAttribute("name");
    const o: WebviewMessage<MessageCollapseStateData> = {
        command: "toggleState",
        data: {
            document_id: documentId,
            id: name,
            state: false,
        },
    };

    vscode.postMessage(o);
}
function doItemCollapse(item: HTMLDivElement) {
    const hasClass = item.classList.contains("collapsed");
    if (!hasClass) {
        item.classList.add("collapsed");
    }
    const name = item.getAttribute("name");
    const o: WebviewMessage<MessageCollapseStateData> = {
        command: "toggleState",
        data: {
            document_id: documentId,
            id: name,
            state: true,
        },
    };

    vscode.postMessage(o);
}

function filterItems(val: string) {
    if (val == null) {
        val = "";
    }
    const filterIndicator = document.getElementById("filterActive");
    val = val.toLocaleLowerCase().trim();

    if (val === "") {
        filterIndicator.classList.add("hidden");
    } else {
        filterIndicator.classList.remove("hidden");
    }

    console.log(`filtering ${val}`);
    const items = document.querySelectorAll("div.item");
    for (let i = 0; i < items.length; i++) {
        const e: HTMLDivElement = items.item(i) as HTMLDivElement;
        const nameElement: HTMLDivElement = e.getElementsByClassName("name")[0] as HTMLDivElement;
        if (nameElement == null) {
            console.log(`name ois null`);
            continue;
        }
        const text = nameElement.innerText != null ? nameElement.innerText : "";
        const has = text.toLocaleLowerCase().search(val) === -1 ? false : true;

        if (has) {
            e.classList.remove("hidden");
        } else {
            e.classList.add("hidden");
        }

    }

}

function collapseAll() {
    const items = document.querySelectorAll("div.item");
    for (let i = 0; i < items.length; i++) {
        const e: HTMLDivElement = items.item(i) as HTMLDivElement;
        doItemCollapse(e);
    }
    focusBackToEditor();
}
function expandAll() {
    const items = document.querySelectorAll("div.item");
    for (let i = 0; i < items.length; i++) {
        const e: HTMLDivElement = items.item(i) as HTMLDivElement;
        doItemExpand(e);
    }
    focusBackToEditor();
}

function focusBackToEditor() {
    const o: WebviewMessage<any> = {
        command: "focusEditor",
        data: null,
    };

    vscode.postMessage(o);
}
