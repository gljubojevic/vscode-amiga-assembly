//
// Tests of the Amiga Hunk file Parser
//

import { expect } from 'chai';
import { HunkParser, HunkType } from '../amigaHunkParser';
import * as Path from 'path';

// tslint:disable:no-unused-expression
describe("AmigaHunkFile", function () {
    it("Should open a hunk file", function () {
        const PROJECT_ROOT = Path.join(__dirname, '..', '..');
        const programFilename = Path.join(PROJECT_ROOT, 'test_files', 'debug', 'fs-uae', 'hd0', 'gencop');
        let parser = new HunkParser();
        let hunks = parser.parse_file(programFilename);
        expect(hunks.length).to.be.equal(1);
        let hunk = hunks[0];
        if (hunk.symbols) {
            expect(hunk.symbols.length).to.be.equal(15);
            expect(hunk.symbols[0].name).to.be.equal("init");
            expect(hunk.symbols[0].offset).to.be.equal(0);
        } else {
            expect.fail("hunk has no symbol");
        }
        expect(hunk.codeData).to.exist;
        expect(hunk.lineDebugInfo).to.exist;
        if (hunk.lineDebugInfo) {
            expect(hunk.lineDebugInfo.length).to.be.equal(1);
            let sourceFile = hunk.lineDebugInfo[0];
            expect(sourceFile.lines.length).to.be.equal(106);
            expect(sourceFile.name).to.be.equal("/Users/papa/developpements/amiga/projects/helloworld/gencop.s");
        }
    });

    it("Should parse the symbols of a multi hunk file", function () {
        const PROJECT_ROOT = Path.join(__dirname, '..', '..');
        const programFilename = Path.join(PROJECT_ROOT, 'test_files', 'debug', 'fs-uae', 'hd0', 'tutorial');
        let parser = new HunkParser();
        let hunks = parser.parse_file(programFilename);
        expect(hunks.length).to.be.equal(3);
        // Code hunk
        let hunk = hunks[0];
        expect(hunk.hunkType).to.be.equal(HunkType.Code);
        if (hunk.symbols) {
            expect(hunk.symbols.length).to.be.equal(13);
            expect(hunk.symbols[0].name).to.be.equal("start");
            expect(hunk.symbols[0].offset).to.be.equal(0);
        } else {
            expect.fail("hunk has no symbol");
        }
        expect(hunk.codeData).to.exist;
        expect(hunk.lineDebugInfo).to.exist;
        // Data hunk
        hunk = hunks[1];
        expect(hunk.hunkType).to.be.equal(HunkType.Data);
        if (hunk.symbols) {
            expect(hunk.symbols.length).to.be.equal(16);
            expect(hunk.symbols[0].name).to.be.equal("Spr");
            expect(hunk.symbols[0].offset).to.be.equal(0);
        } else {
            expect.fail("hunk has no symbol");
        }
        // Data hunk
        hunk = hunks[2];
        expect(hunk.hunkType).to.be.equal(HunkType.Bss);
        if (hunk.symbols) {
            expect(hunk.symbols.length).to.be.equal(1);
            expect(hunk.symbols[0].name).to.be.equal("Screen");
            expect(hunk.symbols[0].offset).to.be.equal(0);
        } else {
            expect.fail("hunk has no symbol");
        }
    });
    it("Should parse the a vbcc generated file", function () {
        const PROJECT_ROOT = Path.join(__dirname, '..', '..');
        const programFilename = Path.join(PROJECT_ROOT, 'test_files', 'debug', 'fs-uae', 'hd0', 'hello-vbcc');
        let parser = new HunkParser();
        let hunks = parser.parse_file(programFilename);
        expect(hunks.length).to.be.equal(7);
        // Code hunk
        let hunk = hunks[0];
        expect(hunk.codeData).to.exist;
        expect(hunk.lineDebugInfo).to.exist;
        if (hunk.lineDebugInfo) {
            expect(hunk.lineDebugInfo.length).to.be.equal(1);
            let sourceFile = hunk.lineDebugInfo[0];
            expect(sourceFile.lines.length).to.be.equal(11);
            expect(sourceFile.name).to.be.equal("hello.c");
        }
    });
});