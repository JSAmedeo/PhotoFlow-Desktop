import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const sourcePath = path.resolve('src/ingest/filenameParser.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`;
const { parsePhotoFilename } = await import(moduleUrl);
const cases = [
  ['XYZ123456_01.jpg', 'XYZ123456', 1, '01'],
  ['XYZ123456_001.jpg', 'XYZ123456', 1, '001'],
  ['XYZ123456-02.jpg', 'XYZ123456', 2, '02'],
  ['XYZ123456 03.jpg', 'XYZ123456', 3, '03'],
  ['XYZ123456_04_IMG_4021.jpg', 'XYZ123456', 4, '04'],
  ['IMG_4021_XYZ123456_05.jpg', 'XYZ123456', 5, '05'],
  ['abc123456_06.jpg', 'ABC123456', 6, '06'],
  ['IMG_4021.jpg', null, null, null],
  ['XYZ12345.jpg', null, null, null],
  ['XY123456.jpg', null, null, null],
  ['XYZ123456.jpg', 'XYZ123456', null, null],
  ['XYZ123456_final.jpg', 'XYZ123456', null, null],
];

for (const [filename, sessionKey, sequenceNumber, sequenceLabel] of cases) {
  const parsed = parsePhotoFilename(filename);
  if (
    parsed.sessionKey !== sessionKey ||
    parsed.sequenceNumber !== sequenceNumber ||
    parsed.sequenceLabel !== sequenceLabel
  ) {
    throw new Error(`${filename} parsed as ${JSON.stringify(parsed)}`);
  }
}

console.log(`Validated ${cases.length} filename parser cases.`);
