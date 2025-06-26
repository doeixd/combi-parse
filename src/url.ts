// url-parser.ts
// This file contains both the TypeScript type definitions for a parsed URL
// and the full parser implementation.

import {
  Parser,
  str,
  regex,
  genParser,
  sepBy,
  astNode,
  choice,
  fail,
  charClass2,
} from './parser'; // Assuming your library is in parser.ts

import { charClass } from './charClass'; // The type-safe charClass factory
import { UrlUnreserved, Digit, HexDigit, Alpha } from './master-char-classes';

// =================================================================
// 1. URL Component Type Definitions
// =================================================================

/** Represents the `scheme` of a URL (e.g., "https" or "ftp"). */
export interface Scheme {
  type: 'Scheme';
  value: string;
}

/** Represents the `userinfo` part of the authority (e.g., "user:pass"). */
export interface UserInfo {
  type: 'UserInfo';
  user: string;
  password?: string;
}

/** Represents the `host` which can be an IP address or a registered name. */
export type Host =
  | { type: 'IPv4'; value: string }
  | { type: 'RegName'; value: string }; // IPv6/Future not handled for brevity

/** Represents the `port` number. */
export interface Port {
  type: 'Port';
  value: number;
}

/** Represents the `authority` part of a URL (userinfo, host, port). */
export interface Authority {
  type: 'Authority';
  userInfo?: UserInfo;
  host: Host;
  port?: Port;
}

/** Represents a single key-value pair in a query string. */
export interface QueryParam {
  type: 'QueryParam';
  key: string;
  value: string;
}

/** Represents the full `query` string, parsed into key-value pairs. */
export interface Query {
  type: 'Query';
  params: QueryParam[];
}

/** Represents the `fragment` identifier. */
export interface Fragment {
  type: 'Fragment';
  value: string;
}

/** The final, fully parsed and structured URL object. */
export interface ParsedUrl {
  type: 'URL';
  scheme: Scheme;
  authority: Authority;
  path: string;
  query?: Query;
  fragment?: Fragment;
}


// =================================================================
// 2. Low-Level RFC 3986 Character Parsers
// =================================================================

const percentEncoded: Parser<string> = genParser(function* () {
  yield str('%');
  const h1 = yield charClass('HexDigit');
  const h2 = yield charClass('HexDigit');
  return `%${h1}${h2}`;
});

const pchar: Parser<string> = choice([
  charClass2('UrlUnreserved'),
  percentEncoded,
  charClass(':@&=+$,'), // sub-delims
]);


// =================================================================
// 3. Parsers for URL Components
// =================================================================

const scheme: Parser<Scheme> = genParser(function* () {
  const first = yield charClass('Alpha');
  const rest = yield regex(/[a-zA-Z0-9+\-.]*/);
  return { type: 'Scheme', value: first + rest };
});

const userInfo: Parser<UserInfo> = genParser(function* () {
  const userChars = choice([charClass('UrlUnreserved'), percentEncoded, charClass(';=$,')]).many1();
  const user = (yield userChars).join('');

  const maybePassword = yield genParser(function* () {
    yield str(':');
    return (yield userChars).join('');
  }).optional();

  return {
    type: 'UserInfo',
    user,
    ...(maybePassword && { password: maybePassword }),
  };
});

const host: Parser<Host> = choice([
  astNode('IPv4', regex(/[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/)),
  astNode('RegName', choice([charClass('UrlUnreserved'), percentEncoded, charClass(';,&=+$')]).many1().map(parts => parts.join(''))),
]);

const port: Parser<Port> = genParser(function* () {
  yield str(':');
  const portStr = yield charClass('Digit').many1().map(digits => digits.join(''));
  const portNum = parseInt(portStr, 10);

  if (portNum > 65535) {
    return yield fail('Port number cannot exceed 65535');
  }

  return { type: 'Port', value: portNum };
});

const authority: Parser<Authority> = genParser(function* () {
  const maybeUserInfo = yield genParser(function* () {
    const ui = yield userInfo;
    yield str('@');
    return ui;
  }).optional();

  const parsedHost = yield host;
  const maybePort = yield port.optional();

  return {
    type: 'Authority',
    ...(maybeUserInfo && { userInfo: maybeUserInfo }),
    host: parsedHost,
    ...(maybePort && { port: maybePort }),
  };
});

const path: Parser<string> = pchar.many1().map(chars => chars.join(''));

const queryParam: Parser<QueryParam> = genParser(function* () {
  const key = (yield pchar.many1()).join('');
  yield str('=');
  const value = (yield pchar.many1()).join('');
  return { type: 'QueryParam', key, value };
});

const query: Parser<Query> = genParser(function* () {
  yield str('?');
  const params = yield sepBy(queryParam, str('&'));
  return { type: 'Query', params };
});

const fragment: Parser<Fragment> = genParser(function* () {
  yield str('#');
  const value = (yield choice([pchar, charClass('/?')]).many1()).join('');
  return { type: 'Fragment', value };
});


// =================================================================
// 4. The Top-Level URL Parser
// =================================================================

/**
 * The main URL parser. It combines all component parsers to parse a full URL string
 * into a structured, type-safe `ParsedUrl` object.
 *
 * URL = scheme ":" "//" authority path [ "?" query ] [ "#" fragment ]
 */
export const urlParser = genParser(function* () {
  const parsedScheme = yield scheme;
  yield str('://');
  const parsedAuthority = yield authority;
  const parsedPath = yield path.optional().map(p => p ?? '');
  const parsedQuery = yield query.optional();
  const parsedFragment = yield fragment.optional();

  return {
    type: 'URL',
    scheme: parsedScheme,
    authority: parsedAuthority,
    path: parsedPath,
    ...(parsedQuery && { query: parsedQuery }),
    ...(parsedFragment && { fragment: parsedFragment }),
  };
});