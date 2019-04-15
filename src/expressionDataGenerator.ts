import { MathCalc } from "./mathcalc";
import * as vscode from "vscode";

export class ExpressionDataVariable {
    name: string;
    startValue: number;
    endValue: number;
    step: number;
    constructor(name: string, startValue: number, endValue: number, step: number) {
        this.name = name;
        this.startValue = startValue;
        this.endValue = endValue;
        this.step = step;
        if (step === 0) {
            throw new Error("Vriable step cannot be 0");
        }
    }
}

export enum OutputDataType {
    LONG,
    WORD,
    BYTE
}

export class ExpressionDataGenerator {
    calc = new MathCalc();
    expression: string;
    variable: ExpressionDataVariable;
    outputDataType: OutputDataType = OutputDataType.WORD;
    outputInHex = false;
    valuesPerLine = 10;
    constructor(expression: string, variable: ExpressionDataVariable) {
        this.expression = expression;
        this.variable = variable;
    }
    public eval(): Array<number> {
        let values = new Array<number>();
        var expr = this.calc.parse(this.expression);
        if (expr.error) {
            throw new Error('Parsing error at ' + expr.error.pos + ': ' + expr.error.text);
        } else {
            for (let x = this.variable.startValue; x <= this.variable.endValue; x += this.variable.step) {
                let value = expr.eval({ x: x });
                if (expr.scope.runtimeError) {
                    throw new Error('Error: ' + expr.error.text);
                }
                values.push(value);
            }
        }
        return values;
    }

    public evalString(): string {
        let posLine = 0;
        let value = "";
        let type = 'b';
        if (this.outputDataType === OutputDataType.WORD) {
            type = 'w';
        } else if (this.outputDataType === OutputDataType.LONG) {
            type = 'l';
        }
        for (let v of this.eval()) {
            // check validity
            if ((this.outputDataType === OutputDataType.BYTE) && (v > 255)) {
                throw new Error(`Value ${v} does not fit in a byte register`);
            } else if ((this.outputDataType === OutputDataType.WORD) && (v > (Math.pow(2, 15)))) {
                throw new Error(`Value ${v} does not fit in a word (16bits) register`);
            } else if ((this.outputDataType === OutputDataType.LONG) && (v > (Math.pow(2, 31)))) {
                throw new Error(`Value ${v} does not fit in a long (32bits) register`);
            }
            if ((this.valuesPerLine > 0) && (posLine >= this.valuesPerLine)) {
                value += '\n';
                posLine = 0;
            }
            let outV: string;
            if (this.outputInHex) {
                outV = "$" + v.toString(16);
            } else {
                outV = v.toString();
            }
            if (posLine === 0) {
                value += `dc.${type} `;
            } else if (posLine > 0) {
                value += ", ";
            }
            value += `${outV}`;
            posLine++;
        }
        return value;
    }
    public setOutputInHex(outputInHex: boolean) {
        this.outputInHex = outputInHex;
    }
    public setOutputDataType(outputDataType: OutputDataType) {
        this.outputDataType = outputDataType;
    }
    public setValuesPerLine(valuesPerLine: number) {
        this.valuesPerLine = valuesPerLine;
    }
}

export class ExpressionDataGeneratorSerializer {
    static readonly START_KEYWORD = "@generated-datagen-start";
    static readonly END_KEYWORD = "@generated-datagen-end";
    static readonly EXPRESSION_KEYWORD = "expression";
    static readonly VARIABLE_KEYWORD = "variable";
    static readonly VARIABLE_NAME_KEYWORD = "name";
    static readonly VARIABLE_STARTVALUE_KEYWORD = "startValue";
    static readonly VARIABLE_ENDVALUE_KEYWORD = "endValue";
    static readonly VARIABLE_STEP_KEYWORD = "step";
    static readonly OUTPUTTYPE_KEYWORD = "outputType";
    static readonly OUTPUTHEX_KEYWORD = "outputInHex";
    static readonly VALUES_PER_LINE_KEYWORD = "valuesPerLine";

    public parse(comment: string): ExpressionDataGenerator {
        let expression = "";
        let name = "";
        let startValue = 0;
        let endValue = 0;
        let step = 1;
        let lines = comment.split('\n');
        let parsing = false;
        let parsingVariable = false;
        let variables = new Array<ExpressionDataVariable>();
        let outputDataType: OutputDataType | null = null;
        let outputInHex = false;
        let valuesPerLine = -1;
        for (let line of lines) {
            if (line.includes(ExpressionDataGeneratorSerializer.START_KEYWORD)) {
                parsing = true;
            }
            if (parsing) {
                if (line.includes(ExpressionDataGeneratorSerializer.END_KEYWORD)) {
                    break;
                } else if (line.includes(ExpressionDataGeneratorSerializer.EXPRESSION_KEYWORD)) {
                    expression = this.retrieveString(line);
                } else if (line.includes(ExpressionDataGeneratorSerializer.VARIABLE_KEYWORD)) {
                    if (parsingVariable) {
                        // End of current variable
                        variables.push(new ExpressionDataVariable(name, startValue, endValue, step));
                    } else {
                        parsingVariable = true;
                    }
                } else if (line.includes(ExpressionDataGeneratorSerializer.VARIABLE_NAME_KEYWORD)) {
                    name = this.retrieveString(line);
                } else if (line.includes(ExpressionDataGeneratorSerializer.VARIABLE_STARTVALUE_KEYWORD)) {
                    startValue = this.retrieveNumber(line);
                } else if (line.includes(ExpressionDataGeneratorSerializer.VARIABLE_ENDVALUE_KEYWORD)) {
                    endValue = this.retrieveNumber(line);
                } else if (line.includes(ExpressionDataGeneratorSerializer.VARIABLE_STEP_KEYWORD)) {
                    step = this.retrieveNumber(line);
                } else if (line.includes(ExpressionDataGeneratorSerializer.OUTPUTTYPE_KEYWORD)) {
                    let outtypestr = this.retrieveString(line).toLocaleLowerCase();
                    if (outtypestr === 'b') {
                        outputDataType = OutputDataType.BYTE;
                    } else if (outtypestr === 'w') {
                        outputDataType = OutputDataType.WORD;
                    } else if (outtypestr === 'l') {
                        outputDataType = OutputDataType.LONG;
                    }
                } else if (line.includes(ExpressionDataGeneratorSerializer.OUTPUTHEX_KEYWORD)) {
                    outputInHex = this.retrieveBoolean(line);
                } else if (line.includes(ExpressionDataGeneratorSerializer.VALUES_PER_LINE_KEYWORD)) {
                    valuesPerLine = this.retrieveNumber(line);
                }
            }
        }
        if (parsingVariable) {
            // For the last variable definition
            variables.push(new ExpressionDataVariable(name, startValue, endValue, step));
        }
        let expDataGen = new ExpressionDataGenerator(expression, variables[0]);
        if (outputDataType) {
            expDataGen.setOutputDataType(outputDataType);
        }
        if (valuesPerLine >= 0) {
            expDataGen.setValuesPerLine(valuesPerLine);
        }
        expDataGen.setOutputInHex(outputInHex);
        return expDataGen;
    }
    public retrieveValue(line: string): string {
        let idx = line.indexOf(":");
        if (idx >= 0) {
            return line.substring(idx + 1).trim();
        }
        throw new Error(`No value found in line '${line}'`);
    }
    public retrieveString(line: string): string {
        return this.retrieveValue(line);
    }
    public retrieveBoolean(line: string): boolean {
        let value = this.retrieveValue(line).toLocaleLowerCase();
        if (value === 'true') {
            return true;
        }
        return false;
    }
    public retrieveNumber(line: string): number {
        let value = this.retrieveValue(line);
        if (value.includes(".")) {
            return Number.parseFloat(value);
        } else {
            return Number.parseInt(value);
        }
    }
    public print(expDataGen: ExpressionDataGenerator): string {
        let variable = expDataGen.variable;
        let output = `;${ExpressionDataGeneratorSerializer.START_KEYWORD}----------------\n`;
        output += "; This code was generated by Amiga Assembly extension\n";
        output += ";\n";
        output += ";----- parameters : modify ------\n";
        output += `;${ExpressionDataGeneratorSerializer.EXPRESSION_KEYWORD}(x as variable): ${expDataGen.expression}\n`;
        output += `;${ExpressionDataGeneratorSerializer.VARIABLE_KEYWORD}:\n`;
        output += `;   ${ExpressionDataGeneratorSerializer.VARIABLE_NAME_KEYWORD}:${variable.name}\n`;
        output += `;   ${ExpressionDataGeneratorSerializer.VARIABLE_STARTVALUE_KEYWORD}:${variable.startValue}\n`;
        output += `;   ${ExpressionDataGeneratorSerializer.VARIABLE_ENDVALUE_KEYWORD}:${variable.endValue}\n`;
        output += `;   ${ExpressionDataGeneratorSerializer.VARIABLE_STEP_KEYWORD}:${variable.step}\n`;
        let outputDataTypeStr = 'W';
        if (expDataGen.outputDataType === OutputDataType.BYTE) {
            outputDataTypeStr = 'B';
        } else if (expDataGen.outputDataType === OutputDataType.LONG) {
            outputDataTypeStr = 'L';
        }
        output += `;${ExpressionDataGeneratorSerializer.OUTPUTTYPE_KEYWORD}(B,W,L): ${outputDataTypeStr}\n`;
        output += `;${ExpressionDataGeneratorSerializer.OUTPUTHEX_KEYWORD}: ${expDataGen.outputInHex}\n`;
        output += `;${ExpressionDataGeneratorSerializer.VALUES_PER_LINE_KEYWORD}: ${expDataGen.valuesPerLine}\n`;
        output += ";--------------------------------\n";
        output += ";- DO NOT MODIFY folowing lines -\n";
        for (let line of expDataGen.evalString().split('\n')) {
            output += ` ${line}\n`; // keep the fist space
        }
        output += `;${ExpressionDataGeneratorSerializer.END_KEYWORD}----------------\n`;
        return output;
    }
}

export class DataGeneratorCodeLensProvider implements vscode.CodeLensProvider {
    public provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken):
        vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
        // Search for start keyword
        let codeLensArray = new Array<vscode.CodeLens>();
        let text = document.getText();
        let linePos = 0;
        let startPos: vscode.Position | null = null;
        for (let line of text.split('\n')) {
            if (line.includes(ExpressionDataGeneratorSerializer.START_KEYWORD)) {
                startPos = new vscode.Position(linePos, 0);
            } else if (line.includes(ExpressionDataGeneratorSerializer.END_KEYWORD) && startPos) {
                let range = new vscode.Range(startPos, new vscode.Position(linePos, line.length));
                codeLensArray.push(new vscode.CodeLens(range));
            }
            linePos++;
        }
        return codeLensArray;
    }

    public resolveCodeLens?(codeLens: vscode.CodeLens, token: vscode.CancellationToken):
        vscode.CodeLens | Thenable<vscode.CodeLens> {
        codeLens.command = <vscode.Command>{
            "command": "amiga-assembly.generate-data",
            "title": "Generate data",
            "tooltip": "Generate numerical data from expression",
            "arguments": [codeLens.range]
        };
        return codeLens;
    }

    public onGenerateData(range: vscode.Range): Promise<void> {
        return new Promise(async (resolve, reject) => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                await editor.edit(async (edit) => {
                    try {
                        let serializer = new ExpressionDataGeneratorSerializer();
                        let oldText = editor.document.getText(range);
                        let generator = serializer.parse(oldText);
                        let newText = serializer.print(generator);
                        edit.replace(range, newText);
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                });
            } else {
                reject(new Error("Please select an editing document"));
            }
        });
    }
}