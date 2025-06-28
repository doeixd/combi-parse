// Debug script to check SQL parsing
import { str, regex, sequence, choice, many } from './dist/parser.js';
import { recover } from './dist/primitives/recover.js';

const selectStmt = sequence([str('SELECT'), regex(/[^;]+/)]);
const insertStmt = sequence([str('INSERT'), regex(/[^;]+/)]);
const updateStmt = sequence([str('UPDATE'), regex(/[^;]+/)]);

const validStatement = choice([selectStmt, insertStmt, updateStmt]);

const statement = recover(validStatement, {
  patterns: str(';'),
  fallback: { type: 'syntax_error', query: 'malformed' },
  strategy: 'consume'
});

const script = many(statement);

const input = `SELECT * FROM users;INVALID SYNTAX HERE;UPDATE users SET name = 'John';`;
const result = script.parse(input);

console.log('Result length:', result.length);
console.log('Result:', JSON.stringify(result, null, 2));
