/**
 * Close the menu's overlay: slide div up and update button svg
 */
const closeMenu = () => {
    let classes = ["tabler-icon", "menu-svg"];

    slideUp("menu-container", 300);
    setHTML("menu-switch", tablerSvg("settings", "menu-switch-svg", classes));
    dispatch("menu-switch", "blur");
    global.state.menuIsOpen = false;
};

/**
 * Open the menu's overlay: slide div down and update button svg
 */
const openMenu = () => {
    let classes = ["tabler-icon", "menu-svg"];
    slideDown("menu-container", 300);
    dispatch("menu-switch", "blur");
    setHTML("menu-switch", tablerSvg("circle-x", "close-menu-btn", classes));
    global.state.menuIsOpen = true;
};
/**
 * Parses menu options from the storage and adds events listeners for their change.
 * Notably, if a key in `menuCheckNames` is missing from `menu` it is set to true
 * @param {object} menu The menu retrieved from storage
 * @param {string []} menuCheckNames The array of all expected menu options
 */
const getAndTrackPopupMenuChecks = (menu, menuCheckNames) => {
    let setValues = {};
    for (const key of menuCheckNames) {
        setValues[key] = menu.hasOwnProperty(key)
            ? menu[key]
            : global.menuCheckDefaultFalse.indexOf(key) >= 0
            ? false
            : true;
        const el = findEl(key);
        if (el) {
            el.checked = setValues[key];
        }
    }
    chrome.storage.local.set(setValues);

    for (const key of menuCheckNames) {
        addListener(key, "change", handleMenuCheckChange);
    }
};

const showPopupModal = (name) => {
    document.querySelectorAll(".popup-modal-content").forEach(hideId);
    showId(`modal-${name}-content`, "contents");
    style("popup-modal-wrapper", "display", "flex");
};

/**
 * Creates click events on the popup
 */
const setStandardPopupClicks = () => {
    addListener("helpGithubLink", "click", () => {
        chrome.tabs.create({
            url: "https://github.com/vict0rsch/PaperMemory",
        });
    });

    addListener("whats-new-container", "click", () => {
        chrome.storage.local.get("whatsnew", ({ whatsnew }) => {
            const version = chrome.runtime.getManifest().version;
            if (typeof whatsnew === "undefined") {
                whatsnew = {};
            }
            if (!whatsnew.hasOwnProperty(version)) {
                hideId("whats-new-marker");
            }
            chrome.storage.local.set({
                whatsnew: { ...whatsnew, [version]: true },
            });
            showPopupModal("whatsnew");
        });
    });
    addListener("keyboardShortcuts", "click", () => {
        // button on the home page when not on a known source
        showPopupModal("keyboard");
    });
    addListener("keyboardShortcutsMenu", "click", () => {
        // button in the menu
        showPopupModal("keyboard");
    });
    addListener("close-popup-modal", "click", () => {
        style("popup-modal-wrapper", "display", "none");
    });

    // When the user clicks anywhere outside of the modal, close it
    addListener(window, "click", (event) => {
        if (event.target === findEl("popup-modal-wrapper")) {
            style("popup-modal-wrapper", "display", "none");
        }
    });

    addListener("menu-switch", "click", () => {
        global.state.menuIsOpen ? closeMenu() : openMenu();
    });

    addListener("memory-switch", "click", handleMemorySwitchClick);
};

/**
 * Main function when opening the window:
 * + Display the appropriate html depending on whether the user is currently looking at a paper
 * + Add event listeners (clicks and keyboard)
 * @param {str} url Currently focused and active tab's url.
 */
const popupMain = async (url, is, manualTrigger = false) => {
    console.log(navigator.userAgent);
    if (navigator.userAgent === "PuppeteerAgent") {
        info("Is puppet");
        style(document.body, "min-width", "500px");
        style(document.body, "max-width", "500px");
        style(document.body, "width", "500px");
        style("popup-modal-wrapper", "min-width", "500px");
        style("popup-modal-wrapper", "max-width", "500px");
        style("popup-modal-wrapper", "width", "500px");
    }

    addListener(document, "keydown", handlePopupKeydown);

    chrome.storage.local.get("whatsnew", ({ whatsnew }) => {
        const version = chrome.runtime.getManifest().version;
        if (!whatsnew || !whatsnew.hasOwnProperty(version)) {
            showId("whats-new-marker");
        }
    });

    if (manualTrigger) {
        // manual trigger: do not re-create standard listeners
        // but update the current state and rebuild the Memory's HTML
        hideId("memory-switch");
        showId("memory-spinner");
        await initState();
        hideId("memory-spinner");
        showId("memory-switch");
        makeMemoryHTML();
    } else {
        // Set click events (regardless of paper)
        setStandardPopupClicks();
    }
    const menu = (await getStorage(global.menuStorageKeys)) ?? {};
    // Set checkboxes
    getAndTrackPopupMenuChecks(menu, global.menuCheckNames);

    // Set options page link
    addListener("advanced-configuration", "click", () => {
        chrome.runtime.openOptionsPage();
    });
    // Set fullMemory page link
    addListener("full-memory", "click", () => {
        chrome.tabs.create({
            url: chrome.extension.getURL("src/fullMemory/fullMemory.html"),
        });
    });
    // Open stats page
    addListener("stats-page", "click", () => {
        chrome.tabs.create({
            url: chrome.extension.getURL("src/stats/stats.html"),
        });
    });

    // Set PDF title function
    // setAndHandleCustomPDFFunction(menu);

    // Display popup metadata
    if (Object.values(is).some((i) => i)) {
        setTimeout(() => {
            document.body.style.height = "auto";
            document.body.style.minHeight = "450px";
        }, 0);
        showId("isArxiv", "flex");

        const id = await parseIdFromUrl(url);
        global.state.currentId = id;

        if (!id || !global.state.papers.hasOwnProperty(id)) {
            // Unknown paper, probably deleted by the user
            log("Unknown id " + id);
            await updatePopupPaperNoMemory(url);
            if (menu.checkDirectOpen && !menu.checkNoAuto) {
                dispatch("memory-switch", "click");
            }
            return;
        }

        const paper = global.state.papers[id];
        const eid = paper.id.replaceAll(".", "\\.");

        // -----------------------------
        // -----  Fill Paper Data  -----
        // -----------------------------
        setTextId("popup-paper-title", paper.title.replaceAll("\n", ""));
        setTextId("popup-authors", cutAuthors(paper.author, 350));
        if (paper.codeLink) {
            showId("popup-code-link");
            setTextId("popup-code-link", paper.codeLink.replace(/^https?:\/\//, ""));
        }

        // ----------------------------------
        // -----  Customize Popup html  -----
        // ----------------------------------
        log("Popup paper:", paper);
        setHTML("popup-memory-edit", getPopupEditFormHTML(paper));
        setHTML("popup-copy-icons", getPopupPaperIconsHTML(paper, url, is));
        findEl(`checkFavorite--${id}`).checked = paper.favorite;

        // --------------------------
        // -----  Paper  edits  -----
        // --------------------------
        $(`#popup-item-tags--${eid}`).select2({
            ...global.select2Options,
            width: "87%",
        });
        addListener(`popup-form-note-textarea--${id}`, "focus", () => {
            var that = this;
            textareaFocusEnd(that);
        });
        setFormChangeListener(id, true);
        addListener("popup-delete-paper", "click", handlePopupDeletePaper(id));

        // ------------------------
        // -----  SVG clicks  -----
        // ------------------------
        addListener(`popup-memory-item-scirate--${id}`, "click", () => {
            const arxivId = paper.id.split("-").last();
            const scirateURL = `https://scirate.com/arxiv/${arxivId}`;
            chrome.tabs.update({ url: scirateURL });
            window.close();
        });
        addListener(`popup-memory-item-link--${id}`, "click", () => {
            const pdfURL = paperToPDF(paper);
            const absURL = paperToAbs(paper);
            chrome.tabs.update({ url: isPdfUrl(url) ? absURL : pdfURL });
            window.close();
        });
        addListener(`popup-code-link`, "click", () => {
            const codeLink = findEl(`popup-code-link`).textContent;
            if (codeLink) {
                focusExistingOrCreateNewCodeTab(codeLink);
            }
        });
        addListener(`popup-memory-item-copy-link--${id}`, "click", () => {
            const link = menu.checkPreferPdf ? paperToPDF(paper) : paperToAbs(paper);
            const text = menu.checkPreferPdf ? "PDF" : "Abstract";
            copyAndConfirmMemoryItem(id, link, `${text} link copied!`, true);
        });
        addListener(`popup-memory-item-md--${id}`, "click", () => {
            const menu = global.state.menu;
            console.log("state.menu: ", state.menu);
            const md = makeMdLink(paper, menu);
            const text = menu.checkPreferPdf ? "PDF" : "Abstract";
            copyAndConfirmMemoryItem(id, md, `Markdown link to ${text} copied!`, true);
        });
        addListener(`popup-memory-item-bibtex--${id}`, "click", () => {
            const bibtex = bibtexToString(global.state.papers[id].bibtex);
            copyAndConfirmMemoryItem(id, bibtex, "Bibtex citation copied!", true);
        });
        addListener(`popup-memory-item-openLocal--${id}`, "click", async () => {
            const file = await findLocalFile(paper);
            if (file) {
                chrome.downloads.open(file.id);
            } else {
                chrome.tabs.create({ url: paper.pdfLink });
            }
        });
        addListener(`popup-memory-item-download--${id}`, "click", async () => {
            let title = stateTitleFunction(paper);
            if (global.state.menu.checkStore) {
                title = "PaperMemoryStore/" + title;
                const storedFiles = await getStoredFiles();
                if (storedFiles.length === 0) {
                    chrome.downloads.download({
                        url: URL.createObjectURL(new Blob([global.storeReadme])),
                        filename: "PaperMemoryStore/IMPORTANT_README.txt",
                        saveAs: false,
                    });
                }
            }
            log({ title });
            if (!title.endsWith(".pdf")) {
                title += ".pdf";
            }
            title = title.replaceAll(":", " ");
            chrome.downloads.download({
                url: paperToPDF(paper),
                filename: title,
            });
        });
    } else {
        if (menu.checkDirectOpen) {
            dispatch("memory-switch", "click");
        }
    }
};

// ------------------------------
// -----  Script Execution  -----
// ------------------------------

const query = { active: true, lastFocusedWindow: true };
if (window.location.href.includes("popup")) {
    chrome.tabs.query(query, async (tabs) => {
        const url = tabs[0].url;
        await initState();

        const is = await isPaper(url);
        const isKnown = Object.values(is).some((i) => i);

        if (!isKnown) showId("notArxiv");

        hideId("memory-spinner");
        showId("memory-switch");
        makeMemoryHTML();
        popupMain(url, is);
        if (navigator.userAgent.search("Firefox") > -1) {
            hideId("overwrite-container");
        }
    });
}
