// The module 'chai' provides assertion methods from node
import { expect } from 'chai';
import { ExpressionDataGenerator, ExpressionDataVariable, OutputDataType, ExpressionDataGeneratorSerializer } from '../expressionDataGenerator';

describe.only("Expression data generator", function () {
    it("should generate a line expression data", function () {
        let expVar = new ExpressionDataVariable("x", 1, 10, 1);
        let expDGen = new ExpressionDataGenerator("x+2", expVar);
        expect(expDGen.eval()).to.be.eql([3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    });
    it("should throw an exception on invalid function", function () {
        let expVar = new ExpressionDataVariable("x", 1, 10, 1);
        let expDGen = new ExpressionDataGenerator("x/2)", expVar);
        expect(() => expDGen.eval()).to.throw("Parsing error at 3: Unmatched paren");
    });
    it("should throw an exception on eval runtime", function () {
        let expVar = new ExpressionDataVariable("x", 0, 10, 1);
        let expDGen = new ExpressionDataGenerator("foo(x)", expVar);
        expect(() => expDGen.eval()).to.throw();
    });
    it("should generate a sinus expression data", function () {
        let expVar = new ExpressionDataVariable("x", 0, 5, 1);
        let expDGen = new ExpressionDataGenerator("round(sin(x*pi/180)*pow(2,14))", expVar);
        let values = expDGen.eval();
        for (let x = 0; x <= 5; x++) {
            let p = Math.pow(2, 14);
            let s = Math.sin(x * Math.PI / 180);
            let v = Math.round(s * p);
            expect(values[x]).to.be.equal(v);
        }
    });
    it("should generate a string output for all output types", function () {
        let expVar = new ExpressionDataVariable("x", 0, 3, 1);
        let expDGen = new ExpressionDataGenerator("round(sin(x*pi/180)*pow(2,14))", expVar);
        // default values WORD / 10 per line
        expDGen.setValuesPerLine(1);
        let output = expDGen.evalString();
        let expected = "dc.w 0\ndc.w 286\ndc.w 572\ndc.w 857";
        expect(output).to.be.equal(expected);
        expDGen.setOutputDataType(OutputDataType.LONG);
        expDGen.setValuesPerLine(1);
        expected = "dc.l 0\ndc.l 286\ndc.l 572\ndc.l 857";
        output = expDGen.evalString();
        expect(output).to.be.equal(expected);
        expDGen = new ExpressionDataGenerator("x", expVar);
        expDGen.setOutputDataType(OutputDataType.BYTE);
        expDGen.setValuesPerLine(1);
        output = expDGen.evalString();
        expected = "dc.b 0\ndc.b 1\ndc.b 2\ndc.b 3";
        expect(output).to.be.equal(expected);
    });
    it("should generate a string output for hex format", function () {
        let expVar = new ExpressionDataVariable("x", 10, 11, 1);
        let expDGen = new ExpressionDataGenerator("x", expVar);
        expDGen.setOutputDataType(OutputDataType.BYTE);
        expDGen.setOutputInHex(true);
        expDGen.setValuesPerLine(2);
        let output = expDGen.evalString();
        let expected = "dc.b $a, $b";
        expect(output).to.be.equal(expected);
    });
    it("should throw an exception on override", function () {
        let expVar = new ExpressionDataVariable("x", 1, 2, 1);
        let expDGen = new ExpressionDataGenerator("x+300", expVar);
        expDGen.setOutputDataType(OutputDataType.BYTE);
        expect(() => expDGen.evalString()).to.throw();
        expDGen = new ExpressionDataGenerator("x+pow(2,15)", expVar);
        expDGen.setOutputDataType(OutputDataType.WORD);
        expect(() => expDGen.evalString()).to.throw();
        expDGen = new ExpressionDataGenerator("x+pow(2,31)", expVar);
        expDGen.setOutputDataType(OutputDataType.LONG);
        expect(() => expDGen.evalString()).to.throw();
    });
    it("should parse and print a comment data generator", function () {
        let expression = "round(sin(x*pi/180)*pow(2,14))";
        let name = "x";
        let startValue = 0;
        let endValue = 3;
        let step = 1;
        let outputType = "W";
        let outputHex = false;
        let valuesPerLine = 1;
        let comment = `;${ExpressionDataGeneratorSerializer.START_KEYWORD}----------------\n`;
        comment += "; This code was generated by Amiga Assembly extension\n";
        comment += ";\n";
        comment += ";----- parameters : modify ------\n";
        comment += `;${ExpressionDataGeneratorSerializer.EXPRESSION_KEYWORD}(x as variable): ${expression}\n`;
        comment += `;${ExpressionDataGeneratorSerializer.VARIABLE_KEYWORD}:\n`;
        comment += `;   ${ExpressionDataGeneratorSerializer.VARIABLE_NAME_KEYWORD}:${name}\n`;
        comment += `;   ${ExpressionDataGeneratorSerializer.VARIABLE_STARTVALUE_KEYWORD}:${startValue}\n`;
        comment += `;   ${ExpressionDataGeneratorSerializer.VARIABLE_ENDVALUE_KEYWORD}:${endValue}\n`;
        comment += `;   ${ExpressionDataGeneratorSerializer.VARIABLE_STEP_KEYWORD}:${step}\n`;
        comment += `;${ExpressionDataGeneratorSerializer.OUTPUTTYPE_KEYWORD}(B,W,L): ${outputType}\n`;
        comment += `;${ExpressionDataGeneratorSerializer.OUTPUTHEX_KEYWORD}: ${outputHex}\n`;
        comment += `;${ExpressionDataGeneratorSerializer.VALUES_PER_LINE_KEYWORD}: ${valuesPerLine}\n`;
        comment += ";--------------------------------\n";
        comment += ";- DO NOT MODIFY folowing lines -\n";
        comment += " dc.w 0\n dc.w 286\n dc.w 572\n dc.w 857\n";
        comment += `;${ExpressionDataGeneratorSerializer.END_KEYWORD}----------------\n`;
        let serializer = new ExpressionDataGeneratorSerializer();
        let result = serializer.parse(comment);
        expect(result.expression).to.be.equal(expression);
        expect(result.outputInHex).to.be.equal(outputHex);
        expect(result.outputDataType).to.be.equal(OutputDataType.WORD);
        expect(result.valuesPerLine).to.be.equal(valuesPerLine);
        let variable = result.variable;
        expect(variable.name).to.be.equal(name);
        expect(variable.startValue).to.be.equal(startValue);
        expect(variable.endValue).to.be.equal(endValue);
        expect(variable.step).to.be.equal(step);
        let output = serializer.print(result);
        expect(comment).to.be.equal(output);
    });
});