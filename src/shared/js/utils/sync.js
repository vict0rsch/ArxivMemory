const getGist = async (pat, store = true) => {
    if (!pat) {
        pat = await getStorage("syncPAT");
    }
    if (!pat)
        return {
            ok: false,
            payload: "noPAT",
        };

    const githubGist = new GithubGist.default({
        personalAccessToken: pat,
        appIdentifier: "PaperMemorySync",
        isPublic: false,
    });

    try {
        await githubGist.touch();
        store && (await setStorage("syncPAT", pat));
        return { ok: true, payload: { gist: githubGist, pat } };
    } catch (e) {
        console.log(e);
        return {
            ok: false,
            payload: "wrongPAT",
            error: e,
        };
    }
};

const getDataFile = (gist) => {
    let dataFile = gist.getFile("PaperMemory-sync-data.json");
    if (!dataFile) {
        gist.createFile("PaperMemory-sync-data.json");
        dataFile = gist.getFile("PaperMemory-sync-data.json");
    }
    return dataFile;
};
