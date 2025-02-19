# kysely-rizzolver-codegen

Generates a ready-to-use KyselyRizzolver instance from the output of the kysely-codegen tool.

## Usage

You can use this tool via `npx`:

```sh
npx kysely-rizzolver-codegen --schema-from <path> --output <path> [additional opts]
```

### Options

- `--schema-from <path>`: The path the kysely-codegen tool wrote the DB interface to.
- `--output <path>`: The output file to write this tool's generated code to.
- `--import-from <path>`: The path that is used in this tool's generated code to import the DB interface from. Defaults to the relative path between the output and input files.
- `--export-as <name>`: The name for the exported KyselyRizzolver instance. Defaults to 'rizzolver'.
- `--fks-from <path>`: The path that is used in this tool's generated code to import a function that defines the foreign keys for the schema. See [Defining foreign keys](#defining-foreign-keys) for more information.
- `--help, -h`: Show the help message and exit.

## Example

```sh
npx kysely-rizzolver-codegen --schema-from src/generated/db-schema.ts --output src/generated/rizzolver.ts
```

This will generate a file `src/generated/rizzolver.ts` with the following content:

```typescript
// This file was generated by kysely-rizzolver-codegen. Do not edit it manually.

import type { DB } from './db-schema';
import { KyselyRizzolver } from 'kysely-rizzolver';

export const rizzolver = KyselyRizzolver.builder<DB>()
	.table('tableName', ['column1', 'column2'] as const)
	.build();
```

## Defining foreign keys

> [!WARNING]
> This feature is very early in development. To keep things simple as it takes shape I made some heavy assumptions:
>
> - Only simple, numeric foreign keys are supported (no composite keys, no string keys, etc.)
> - It is assumed every table has a numeric primary key named `id`.
> - It is assumed the `id` column is never 0.
>
> I plan on getting rid of these assumptions in the future.

KyselyRizzolver provides useful functions to gather a table and its foreign keys recursively.

However, `kysely-codegen` does not output the foreign keys, so you have to define them yourself.

Create a file that has a default export for a function that takes in a `FkDefsBuilder<DB>` instance and returns the foreign key definitions.

Consider the following schema:

_`path/to/db-schema.ts`:_

```typescript
interface User {
	id: Generated<number>;
	username: string;
}

interface Post {
	id: Generated<number>;
	title: string;
	author_id: number;
	pinned_comment_id: number | null;
}

interface Comment {
	id: Generated<number>;
	content: string;
	author_id: number;
	post_id: number;
}

export interface DB {
	user: User;
	post: Post;
	comment: Comment;
}
```

You can define the foreign keys like this:

_`path/to/fks.ts`:_

```typescript
import type { FkDefsBuilder } from 'kysely-rizzolver';
import type { DB } from './db-schema';

export default (fks: FkDefsBuilder<DB>) => fks
	// arguments are:
	// - from table
	// - from column
	// - to table
	// - to column
	.add('post', 'author_id', 'user', 'id')
	.add('post', 'pinned_comment_id', 'comment', 'id', true) // true for nullable
	.add('comment', 'author_id', 'user', 'id')
	.add('comment', 'post_id', 'post', 'id')
	.build();
```

Then, you can generate the Rizzolver instance with the following command:

```sh
npx kysely-rizzolver-codegen --schema-from path/to/db-schema.ts --output path/to/rizzolver.ts --fks-from './fks'
```

This will generate `path/to/rizzolver.ts` with the following content:

```typescript
import type { DB } from './db-schema';
import { KyselyRizzolver } from 'kysely-rizzolver';
import defineFks from './fks';

export const rizzolver = KyselyRizzolver.builder<DB>()
	.table('user', ['id', 'username'] as const)
	.table('post', ['id', 'title', 'author_id', 'pinned_comment_Id'] as const)
	.table('comment', ['id', 'content', 'author_id', 'post_id'] as const)
	.build(defineFks);
```

## License

This project is licensed under the MIT License.
