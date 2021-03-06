import { Hunk, HunkParser, SourceLine, HunkType, Symbol } from './amigaHunkParser';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export class DebugInfo {
    public hunks = new Array<Hunk>();
    private pathReplacements?: Map<string, string>;
    private sourcesRootPaths?: Array<string>;
    private resolvedSourceFilesNames = new Map<string, string>();
    private sourceFilesCacheMap = new Map<string, Array<string>>();

    constructor(pathReplacements?: Map<string, string>, sourcesRootPaths?: Array<string>) {
        this.pathReplacements = pathReplacements;
        this.sourcesRootPaths = sourcesRootPaths;
    }

    public loadInfo(filePath: string): boolean {
        // Does the file exists
        if (fs.existsSync(filePath)) {
            let parser = new HunkParser();
            this.hunks = parser.parse_file(filePath);
            return true;
        } else {
            return false;
        }
    }

    public getCodeData(): Uint32Array[] {
        let codeDataArray = new Array<Uint32Array>();
        for (let i = 0; i < this.hunks.length; i++) {
            let hunk = this.hunks[i];
            if ((hunk.hunkType === HunkType.Code) && hunk.codeData) {
                codeDataArray.push(hunk.codeData);
            }
        }
        return codeDataArray;
    }

    public getSymbols(filename: string | undefined): Array<[Symbol, number | undefined]> {
        let symbols = Array<[Symbol, number | undefined]>();
        let normFilename = filename;
        if (normFilename) {
            normFilename = this.normalize(normFilename);
        }
        for (let i = 0; i < this.hunks.length; i++) {
            let hunk = this.hunks[i];
            if (hunk.symbols) {
                if (normFilename) {
                    let sourceFiles = hunk.lineDebugInfo;
                    if (sourceFiles) {
                        for (let j = 0; j < sourceFiles.length; j++) {
                            let srcFile = sourceFiles[j];
                            // Is there a path replacement
                            let name = this.resolveFileName(srcFile.name);
                            if (this.areSameSourceFileNames(name, normFilename)) {
                                for (let s of hunk.symbols) {
                                    symbols.push([s, hunk.segmentsId]);
                                }
                                break;
                            }
                        }
                    }
                } else {
                    for (let s of hunk.symbols) {
                        symbols.push([s, hunk.segmentsId]);
                    }
                }
            }
        }
        return symbols;
    }

    protected tryFindLine(filename: string, lines: Array<SourceLine>, offset: number): ([string, number] | null) {
        let sourceLine = 0;
        let wasOver = false;

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            if (line.offset === offset) {
                //println!("Matching source {} line {}", filename, line.line);
                return [filename, line.line];
            }
            if (line.offset <= offset) {
                sourceLine = line.line;
            } else if (line.offset > offset) {
                wasOver = true;
            }
        }

        if (wasOver) {
            //println!("Partial Matching source {} line {}", filename, sourceLine);
            return [filename, sourceLine];
        } else {
            return null;
        }
    }

    private getSourceLineText(filename: string, line: number): [string, string | null] {
        let resolvedFileName = this.resolveFileName(filename);
        let contents: Array<string> | undefined = this.sourceFilesCacheMap.get(resolvedFileName);
        if (!contents) {
            // Load source file
            contents = fs.readFileSync(resolvedFileName).toString().split(/\r\n|\r|\n/g);
            this.sourceFilesCacheMap.set(resolvedFileName, contents);
        }
        if (contents && (line < contents.length)) {
            return [resolvedFileName, contents[line]];
        }
        return [resolvedFileName, null];
    }

    public resolveFileLine(segId: number, offset: number): ([string, number, string | null] | null) {
        if (segId >= this.hunks.length) {
            return null;
        }
        let hunk = this.hunks[segId];
        let sourceLineText = null;

        let source_files = hunk.lineDebugInfo;
        if (source_files) {
            for (let i = 0; i < source_files.length; i++) {
                let srcFile = source_files[i];
                //if offset > src_file.base_offset {
                //    continue;
                //}
                let data = this.tryFindLine(srcFile.name, srcFile.lines, offset);
                if (data) {
                    // transform the file path to a local one
                    let resolvedFileName = this.resolveFileName(data[0]);
                    if (data[1] > 0) {
                        [resolvedFileName, sourceLineText] = this.getSourceLineText(resolvedFileName, data[1] - 1);
                    }
                    return [resolvedFileName, data[1], sourceLineText];
                }
            }
        }
        return null;
    }

    findFileInWorkspace(filename: string): string {
        // fall back to the first workspace
        let folders = vscode.workspace.workspaceFolders;
        if (folders) {
            for (let folder of folders) {
                let folderPath = path.join(folder.uri.fsPath, filename);
                if (fs.existsSync(folderPath)) {
                    return folderPath;
                }
            }
        }
        return filename;
    }

    private resolveFileName(filename: string): string {
        let resolvedFileName = this.resolvedSourceFilesNames.get(filename);
        if (!resolvedFileName) {
            resolvedFileName = filename;
            if (this.pathReplacements) {
                for (let key of Array.from(this.pathReplacements.keys())) {
                    if (resolvedFileName.indexOf(key) >= 0) {
                        let value = this.pathReplacements.get(key);
                        if (value) {
                            resolvedFileName = resolvedFileName.replace(key, value);
                            break;
                        }
                    }
                }
            }
            // search the file in the workspace
            resolvedFileName = this.findFileInWorkspace(resolvedFileName);
            if (this.sourcesRootPaths && !fs.existsSync(resolvedFileName)) {
                for (let rootPath of this.sourcesRootPaths) {
                    let checkedPath = path.join(rootPath, resolvedFileName);
                    if (fs.existsSync(checkedPath)) {
                        resolvedFileName = checkedPath;
                        break;
                    }
                }
            }
            resolvedFileName = this.normalize(resolvedFileName);
            this.resolvedSourceFilesNames.set(filename, resolvedFileName);
        }
        return resolvedFileName;
    }

    private areSameSourceFileNames(sourcea: string, sourceb: string): boolean {
        if (path.isAbsolute(sourcea) && path.isAbsolute(sourceb)) {
            return sourcea === sourceb;
        }
        return path.basename(sourceb) === path.basename(sourcea);
    }

    public getAddressSeg(filename: string, fileLine: number): ([number, number] | null) {
        let normFilename = this.normalize(filename);
        for (let i = 0; i < this.hunks.length; i++) {
            let hunk = this.hunks[i];
            let sourceFiles = hunk.lineDebugInfo;
            if (sourceFiles) {
                for (let j = 0; j < sourceFiles.length; j++) {
                    let srcFile = sourceFiles[j];
                    // Is there a path replacement
                    let name = this.resolveFileName(srcFile.name);
                    if (this.areSameSourceFileNames(name, normFilename)) {
                        for (let k = 0; k < srcFile.lines.length; k++) {
                            let line = srcFile.lines[k];
                            if (line.line === fileLine) {
                                return [i, line.offset];
                            }
                        }
                    }
                }
            }
        }
        return null;
    }

    public getAllSegmentIds(filename: string): number[] {
        let segIds: number[] = [];
        let normFilename = this.normalize(filename);
        for (let i = 0; i < this.hunks.length; i++) {
            let hunk = this.hunks[i];
            let sourceFiles = hunk.lineDebugInfo;
            if (sourceFiles) {
                for (let j = 0; j < sourceFiles.length; j++) {
                    let srcFile = sourceFiles[j];
                    // Is there a path replacement
                    let name = this.resolveFileName(srcFile.name);
                    if (this.areSameSourceFileNames(name, normFilename)) {
                        segIds.push(i);
                    }
                }
            }
        }
        return segIds;
    }

    public normalize(dirName: string): string {
        if (path.sep === '/') {
            return dirName.replace(/\\+/g, path.sep);
        } else {
            return dirName.replace(/\/+/g, path.sep).toUpperCase();
        }
    }
}
