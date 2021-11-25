const { src, dest, parallel, watch, series } = require("gulp");
const concat = require("gulp-concat");
const uglify = require("gulp-uglify");
const cleanCss = require("gulp-clean-css");
const rename = require("gulp-rename");
const preprocess = require("gulp-preprocess");
const htmlmin = require("gulp-html-minifier-terser");
const minifyJSTemplate = require("gulp-minify-html-literals");
const readlineSync = require("readline-sync");
const fs = require("fs");
const zip = require("gulp-zip");
const { v4: uuidv4 } = require("uuid");

function popupJS() {
    return src([
        "src/popup/js/handlers.js",
        "src/popup/js/templates.js",
        "src/popup/js/memory.js",
        "src/popup/js/popup.js",
    ])
        .pipe(concat("popup.js"))
        .pipe(
            minifyJSTemplate({
                minifyOptions: { minifyCSS: false, collapseWhitespace: true },
                shouldMinify: (template) => true,
            })
        )
        .pipe(uglify({ mangle: false }))
        .pipe(rename({ suffix: ".min" }))
        .pipe(dest("src/popup/min/"));
}

function utilsJS() {
    return src([
        "src/shared/utils/miniquery.js",
        "src/shared/utils/config.js",
        "src/shared/utils/functions.js",
        "src/shared/utils/parsers.js",
    ])
        .pipe(concat("utils.js"))
        .pipe(
            minifyJSTemplate({
                minifyOptions: { minifyCSS: false, collapseWhitespace: true },
                shouldMinify: (template) => true,
            })
        )
        .pipe(uglify({ mangle: false }))
        .pipe(rename({ suffix: ".min" }))
        .pipe(dest("src/shared/"));
}

function themeJS() {
    return src(["src/popup/js/theme.js"])
        .pipe(uglify({ mangle: false }))
        .pipe(rename({ suffix: ".min" }))
        .pipe(dest("src/popup/min/"));
}

function popupHTMLDev() {
    return src(["src/popup/popup.html"])
        .pipe(preprocess({ context: { DEV: true } }))
        .pipe(rename("popup.min.html"))
        .pipe(htmlmin({ collapseWhitespace: true, removeComments: true }))
        .pipe(dest("src/popup/min/"));
}
function popupHTML() {
    return src(["src/popup/popup.html"])
        .pipe(preprocess({ context: { DEV: false } }))
        .pipe(rename("popup.min.html"))
        .pipe(htmlmin({ collapseWhitespace: true, removeComments: true }))
        .pipe(dest("src/popup/min/"));
}

function popupCSS() {
    return src([
        "src/popup/css/options.css",
        "src/popup/css/popup.css",
        "src/shared/loader.css",
    ])
        .pipe(concat("popup.css"))
        .pipe(cleanCss())
        .pipe(rename({ suffix: ".min" }))
        .pipe(dest("src/popup/min/"));
}
function popupDarkCSS() {
    return src(["src/popup/css/dark.css"])
        .pipe(cleanCss())
        .pipe(rename({ suffix: ".min" }))
        .pipe(dest("src/popup/min/"));
}

function watchFiles() {
    watch("src/popup/js/*.js", popupJS);
    watch("src/popup/theme.js", themeJS);
    watch("src/popup/css/*.css", parallel(popupCSS, popupDarkCSS));
    watch("src/popup/popup.html", popupHTMLDev);
    watch("src/shared/utils/*.js", utilsJS);
}

function createArchive(cb) {
    var manifest = JSON.parse(fs.readFileSync("./manifest.json"));
    let archiveName = `Archive-${manifest.version}.zip`;
    let archiveFolder = "extra/archives/";
    const archivePath = `${archiveFolder}${archiveName}`;
    if (fs.existsSync(archivePath)) {
        console.log(archivePath + " already exists");
        const index = readlineSync.keyInSelect(
            ["Create temporary archive", "Overwrite"],
            "What now ?"
        );
        if (index < 0) {
            return cb();
        }
        if (index === 0) {
            archiveName = uuidv4().split("-")[0] + "-" + archiveName;
            archiveFolder = "extra/archives/tmp/";
            console.log("Creating zip: " + archiveFolder + archiveName);
        }
    }
    return src(["./**", "!extra/**", "!node_modules/**", "!./.vscode/**"])
        .pipe(zip(archiveName))
        .pipe(dest(archiveFolder));
}

exports.build = series(
    parallel(popupJS, themeJS, utilsJS, popupCSS, popupDarkCSS, popupHTML),
    createArchive
);
exports.dev = parallel(popupJS, themeJS, utilsJS, popupCSS, popupDarkCSS, popupHTMLDev);
exports.watch = series(popupHTMLDev, watchFiles);
exports.archive = createArchive;