#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

let inputFile = '';
let outputFile = '';
let importFrom = '';
let exportAs = 'rizzolver';

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
	console.log(`Usage: npx kysely-rizzolver-codegen --input <path> --output <path> [--import-from <path>]

Options:
  --input <path>    The path the kysely-codegen tool wrote the DB interface to.
  --output <path>   The output file to write this tool's generated code to.
  --import-from <path>  The path that is used in this tool's generated code
                        to import the DB interface from. Defaults to the
                        relative path between the output and input files.
  --export-as <name>    The name for the exported KyselyRizzolver instance.
                        Defaults to 'rizzolver'.
  --help, -h        Show this help message and exit.
`);
	process.exit(0);
}

for (let i = 0; i < args.length; i++) {
	const arg = args[i];
	const nextArg = args[i + 1];
	switch (arg) {
		case '--input':
			inputFile = nextArg;
			i++;
			break;
		case '--output':
			outputFile = nextArg;
			i++;
			break;
		case '--import-from':
			importFrom = nextArg;
			i++;
			break;
		case '--export-as':
			exportAs = nextArg;
			i++;
			break;
	}
}

if (!inputFile) {
	throw new Error('--input must be specified');
}
if (!outputFile) {
	throw new Error('--output must be specified');
}

if (!importFrom) {
	const inputAbs = path.resolve(inputFile);
	const outputAbs = path.resolve(outputFile);
	importFrom = path.relative(path.dirname(outputAbs), inputAbs);
	if (!importFrom.startsWith('../')) {
		importFrom = `./${importFrom}`;
	}
}

const source = ts.createSourceFile(
	inputFile,
	fs.readFileSync(inputFile, 'utf-8'),
	ts.ScriptTarget.ES2015,
	true
);

const dbInterface = source.statements.find(
	(statement) => ts.isInterfaceDeclaration(statement) && statement.name.text === 'DB'
);

if (!dbInterface) {
	throw new Error('Could not find DB interface');
}

const toGenerate = [];
for (const member of dbInterface.members) {
	if (ts.isPropertySignature(member)) {
		const value = member.type;
		if (ts.isTypeReferenceNode(value)) {
			const typeName = value.typeName.text;
			const tableType = source.statements.find(
				(statement) => ts.isInterfaceDeclaration(statement) && statement.name.text === typeName
			);
			if (!tableType) {
				throw new Error('Could not find the type for ' + typeName);
			}
			const columns = tableType.members
				.filter((member) => ts.isPropertySignature(member))
				.map((column) => column.name.text);
			toGenerate.push({ table: member.name.text, columns: columns });
		}
	}
}

if (toGenerate.length > 0) {
	let result = `// This file was generated by kysely-rizzolver-codegen. Do not edit it manually.

import type { DB } from '${importFrom}';
import { KyselyRizzolver } from 'kysely-rizzolver';

export const ${exportAs} = KyselyRizzolver.builderForSchema<DB>()
`;

	for (const { table, columns } of toGenerate) {
		const columnsStr = columns.map((column) => `'${column}'`).join(', ');
		result += `    .table('${table}', [${columnsStr}] as const)
`;
	}

	result += `    .build();
`;

	fs.writeFileSync(outputFile, result);
}
