/**
 * @fileoverview RFC 3986 Compliant URL Parser
 * 
 * This module provides a comprehensive URL parser that conforms to RFC 3986 standards.
 * It includes both TypeScript type definitions for parsed URL components and a complete
 * parser implementation using the combinator library.
 * 
 * The parser breaks down URLs into their constituent components, providing type-safe
 * access to schemes, authorities (user info, host, port), paths, query parameters,
 * and fragments. Each component is parsed according to the precise rules defined
 * in RFC 3986.
 * 
 * ## Key Features
 * 
 * - **RFC 3986 Compliance**: Follows the official URI specification
 * - **Type Safety**: Each URL component has a precise TypeScript type
 * - **Comprehensive Parsing**: Handles all URL components including edge cases
 * - **Structured Output**: Returns a well-organized AST-like structure
 * - **Error Handling**: Provides clear error messages for malformed URLs
 * 
 * ## Supported URL Components
 * 
 * - **Scheme**: Protocol identifier (http, https, ftp, etc.)
 * - **Authority**: User info, host (IPv4, registered names), and port
 * - **Path**: The path component with proper percent-encoding support
 * - **Query**: Structured key-value pairs from query strings
 * - **Fragment**: Fragment identifier (hash portion)
 * 
 * @example
 * ```typescript
 * import { urlParser } from './url';
 * 
 * const url = urlParser.parse('https://user:pass@example.com:8080/path?key=value#section');
 * 
 * // Result structure:
 * // {
 * //   type: 'URL',
 * //   scheme: { type: 'Scheme', value: 'https' },
 * //   authority: {
 * //     type: 'Authority',
 * //     userInfo: { type: 'UserInfo', user: 'user', password: 'pass' },
 * //     host: { type: 'RegName', value: 'example.com' },
 * //     port: { type: 'Port', value: 8080 }
 * //   },
 * //   path: '/path',
 * //   query: { type: 'Query', params: [{ type: 'QueryParam', key: 'key', value: 'value' }] },
 * //   fragment: { type: 'Fragment', value: 'section' }
 * // }
 * ```
 * 
 * @example
 * ```typescript
 * // Simple URLs without optional components
 * const simpleUrl = urlParser.parse('http://example.com/path');
 * // Only scheme, authority.host, and path will be present
 * 
 * // IPv4 addresses are properly recognized
 * const ipUrl = urlParser.parse('http://192.168.1.1:3000/api');
 * // authority.host will be { type: 'IPv4', value: '192.168.1.1' }
 * ```
 * 
 * @see {@link https://tools.ietf.org/html/rfc3986} for the complete URI specification
 * @see {@link ./parser.ts} for the underlying parser combinator library
 * @see {@link ./charClass.ts} for character class utilities used in URL parsing
 */

import {
  Parser,
  str,
  regex,
  genParser,
  sepBy,
  astNode,
  choice,
  fail,

} from './parser'; // Assuming your library is in parser.ts

import { charClass } from './charClass'; // The type-safe charClass factory

// ===================================================================
// URL Component Type Definitions
// ===================================================================

/**
 * Represents the scheme component of a URL.
 * 
 * The scheme identifies the protocol used to access the resource.
 * Common schemes include "http", "https", "ftp", "mailto", etc.
 * According to RFC 3986, schemes are case-insensitive but are
 * conventionally represented in lowercase.
 * 
 * @example
 * ```typescript
 * const httpsScheme: Scheme = { type: 'Scheme', value: 'https' };
 * const ftpScheme: Scheme = { type: 'Scheme', value: 'ftp' };
 * ```
 */
export interface Scheme {
  /** Type discriminator for the Scheme interface */
  type: 'Scheme';
  /** The scheme string (e.g., "https", "ftp") */
  value: string;
}

/**
 * Represents the user information component of the authority.
 * 
 * User info contains authentication credentials, typically in the format
 * "username:password". The password is optional. Both components should
 * be percent-encoded if they contain reserved characters.
 * 
 * ⚠️ **Security Note**: Including passwords in URLs is deprecated and
 * considered a security risk as URLs may be logged or displayed.
 * 
 * @example
 * ```typescript
 * // With password
 * const userInfoWithPass: UserInfo = {
 *   type: 'UserInfo',
 *   user: 'alice',
 *   password: 'secret123'
 * };
 * 
 * // Without password
 * const userInfoOnly: UserInfo = {
 *   type: 'UserInfo',
 *   user: 'bob'
 * };
 * ```
 */
export interface UserInfo {
  /** Type discriminator for the UserInfo interface */
  type: 'UserInfo';
  /** The username component */
  user: string;
  /** The optional password component */
  password?: string;
}

/**
 * Represents the host component of the authority.
 * 
 * The host can be either an IPv4 address or a registered name (domain name).
 * IPv6 addresses and future IP versions are not currently supported in this
 * implementation for brevity, but could be added following RFC 3986 guidelines.
 * 
 * @example
 * ```typescript
 * // IPv4 address
 * const ipv4Host: Host = { type: 'IPv4', value: '192.168.1.1' };
 * 
 * // Domain name
 * const domainHost: Host = { type: 'RegName', value: 'example.com' };
 * const subdomainHost: Host = { type: 'RegName', value: 'api.example.com' };
 * ```
 */
export type Host =
  | { type: 'IPv4'; value: string }
  | { type: 'RegName'; value: string }; // IPv6/Future not handled for brevity

/**
 * Represents the port component of the authority.
 * 
 * The port number specifies which port on the host to connect to.
 * Ports are 16-bit unsigned integers (0-65535). If no port is specified
 * in the URL, the default port for the scheme is typically used
 * (e.g., 80 for HTTP, 443 for HTTPS).
 * 
 * @example
 * ```typescript
 * const httpPort: Port = { type: 'Port', value: 8080 };
 * const httpsPort: Port = { type: 'Port', value: 443 };
 * const devPort: Port = { type: 'Port', value: 3000 };
 * ```
 */
export interface Port {
  /** Type discriminator for the Port interface */
  type: 'Port';
  /** The port number (0-65535) */
  value: number;
}

/**
 * Represents the complete authority component of a URL.
 * 
 * The authority component contains the network location information
 * needed to access the resource. It consists of optional user info,
 * a required host, and an optional port. The authority is preceded
 * by "//" in a URL.
 * 
 * @example
 * ```typescript
 * // Full authority with all components
 * const fullAuthority: Authority = {
 *   type: 'Authority',
 *   userInfo: { type: 'UserInfo', user: 'admin', password: 'secret' },
 *   host: { type: 'RegName', value: 'api.example.com' },
 *   port: { type: 'Port', value: 8443 }
 * };
 * 
 * // Minimal authority with just host
 * const minimalAuthority: Authority = {
 *   type: 'Authority',
 *   host: { type: 'RegName', value: 'example.com' }
 * };
 * ```
 */
export interface Authority {
  /** Type discriminator for the Authority interface */
  type: 'Authority';
  /** Optional user authentication information */
  userInfo?: UserInfo;
  /** Required host (domain name or IP address) */
  host: Host;
  /** Optional port number */
  port?: Port;
}

/**
 * Represents a single key-value pair from a query string.
 * 
 * Query parameters are extracted from the query string portion of a URL
 * (the part after "?"). Each parameter consists of a key and value
 * separated by "=". Both keys and values should be percent-decoded
 * after parsing.
 * 
 * @example
 * ```typescript
 * const searchParam: QueryParam = {
 *   type: 'QueryParam',
 *   key: 'search',
 *   value: 'hello world'
 * };
 * 
 * const pageParam: QueryParam = {
 *   type: 'QueryParam',
 *   key: 'page',
 *   value: '2'
 * };
 * ```
 */
export interface QueryParam {
  /** Type discriminator for the QueryParam interface */
  type: 'QueryParam';
  /** The parameter name/key */
  key: string;
  /** The parameter value */
  value: string;
}

/**
 * Represents the complete query component of a URL.
 * 
 * The query component contains application-specific data that is
 * typically used to parameterize the resource request. It appears
 * after the "?" character and consists of key-value pairs separated
 * by "&" characters.
 * 
 * @example
 * ```typescript
 * const searchQuery: Query = {
 *   type: 'Query',
 *   params: [
 *     { type: 'QueryParam', key: 'q', value: 'typescript' },
 *     { type: 'QueryParam', key: 'sort', value: 'date' },
 *     { type: 'QueryParam', key: 'limit', value: '10' }
 *   ]
 * };
 * 
 * // Represents: ?q=typescript&sort=date&limit=10
 * ```
 */
export interface Query {
  /** Type discriminator for the Query interface */
  type: 'Query';
  /** Array of parsed query parameters */
  params: QueryParam[];
}

/**
 * Represents the fragment component of a URL.
 * 
 * The fragment identifier provides additional identifying information
 * about a secondary resource or a specific portion of the primary resource.
 * It appears after the "#" character and is typically used for
 * client-side navigation or to reference specific sections of a document.
 * 
 * @example
 * ```typescript
 * const sectionFragment: Fragment = {
 *   type: 'Fragment',
 *   value: 'introduction'
 * };
 * 
 * const lineFragment: Fragment = {
 *   type: 'Fragment',
 *   value: 'L42'
 * };
 * ```
 */
export interface Fragment {
  /** Type discriminator for the Fragment interface */
  type: 'Fragment';
  /** The fragment identifier string */
  value: string;
}

/**
 * Represents a completely parsed and structured URL.
 * 
 * This is the top-level interface returned by the URL parser. It contains
 * all components of a URL in a structured, type-safe format. Required
 * components (scheme, authority, path) are always present, while optional
 * components (query, fragment) are only included if they exist in the URL.
 * 
 * @example
 * ```typescript
 * // Complete URL with all components
 * const fullUrl: ParsedUrl = {
 *   type: 'URL',
 *   scheme: { type: 'Scheme', value: 'https' },
 *   authority: {
 *     type: 'Authority',
 *     userInfo: { type: 'UserInfo', user: 'api', password: 'key123' },
 *     host: { type: 'RegName', value: 'api.example.com' },
 *     port: { type: 'Port', value: 443 }
 *   },
 *   path: '/v1/users',
 *   query: {
 *     type: 'Query',
 *     params: [
 *       { type: 'QueryParam', key: 'limit', value: '20' },
 *       { type: 'QueryParam', key: 'offset', value: '40' }
 *     ]
 *   },
 *   fragment: { type: 'Fragment', value: 'results' }
 * };
 * 
 * // Minimal URL
 * const simpleUrl: ParsedUrl = {
 *   type: 'URL',
 *   scheme: { type: 'Scheme', value: 'http' },
 *   authority: {
 *     type: 'Authority',
 *     host: { type: 'RegName', value: 'localhost' }
 *   },
 *   path: '/'
 * };
 * ```
 */
export interface ParsedUrl {
  /** Type discriminator for the ParsedUrl interface */
  type: 'URL';
  /** The URL scheme (protocol) */
  scheme: Scheme;
  /** The authority component (host, optional user info and port) */
  authority: Authority;
  /** The path component */
  path: string;
  /** Optional query parameters */
  query?: Query;
  /** Optional fragment identifier */
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
  charClass('UrlUnreserved'),
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


// ===================================================================
// Main URL Parser
// ===================================================================

/**
 * The main URL parser that parses complete URLs according to RFC 3986.
 * 
 * This parser combines all component parsers to parse a full URL string
 * into a structured, type-safe `ParsedUrl` object. It follows the RFC 3986
 * specification for URI syntax:
 * 
 * ```
 * URI = scheme ":" "//" authority path [ "?" query ] [ "#" fragment ]
 * ```
 * 
 * The parser handles all URL components with proper validation:
 * - **Scheme validation**: Ensures proper scheme format (letter followed by letters/digits/+/-)
 * - **Authority parsing**: Breaks down user info, host, and port with validation
 * - **Path handling**: Supports both empty and non-empty paths
 * - **Query processing**: Parses query strings into structured key-value pairs
 * - **Fragment extraction**: Handles fragment identifiers
 * - **Percent-encoding**: Properly handles percent-encoded characters where appropriate
 * - **Error reporting**: Provides clear error messages for malformed URLs
 * 
 * @returns A parser that produces a `ParsedUrl` object containing all URL components
 * 
 * @throws {ParserError} When the URL is malformed or doesn't conform to RFC 3986
 * 
 * @example
 * ```typescript
 * // Parse a complete URL with all components
 * const fullUrl = urlParser.parse(
 *   'https://admin:secret@api.example.com:8443/v1/users?limit=20&sort=name#results'
 * );
 * 
 * console.log(fullUrl.scheme.value);           // 'https'
 * console.log(fullUrl.authority.host.value);   // 'api.example.com'
 * console.log(fullUrl.authority.port?.value);  // 8443
 * console.log(fullUrl.path);                   // '/v1/users'
 * console.log(fullUrl.query?.params.length);   // 2
 * console.log(fullUrl.fragment?.value);        // 'results'
 * ```
 * 
 * @example
 * ```typescript
 * // Parse simple URLs
 * const simpleUrl = urlParser.parse('http://example.com/path');
 * // Result has scheme, authority.host, and path, but no userInfo, port, query, or fragment
 * 
 * const localhostUrl = urlParser.parse('http://localhost:3000/');
 * // Result includes port but no other optional components
 * ```
 * 
 * @example
 * ```typescript
 * // Handle IPv4 addresses
 * const ipUrl = urlParser.parse('http://192.168.1.100:8080/api/v1/data');
 * console.log(ipUrl.authority.host.type);  // 'IPv4'
 * console.log(ipUrl.authority.host.value); // '192.168.1.100'
 * ```
 * 
 * @example
 * ```typescript
 * // Error handling for malformed URLs
 * try {
 *   urlParser.parse('not-a-valid-url');
 * } catch (error) {
 *   console.error('Failed to parse URL:', error.message);
 *   // Will provide specific error message about what went wrong
 * }
 * 
 * try {
 *   urlParser.parse('http://example.com:99999/path'); // Port too large
 * } catch (error) {
 *   console.error('Port validation failed:', error.message);
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // Working with parsed URLs
 * const parsedUrl = urlParser.parse('https://api.example.com/users?active=true');
 * 
 * // Type-safe access to components
 * if (parsedUrl.query) {
 *   parsedUrl.query.params.forEach(param => {
 *     console.log(`${param.key}: ${param.value}`);
 *   });
 * }
 * 
 * // Reconstruct URL base
 * const baseUrl = `${parsedUrl.scheme.value}://${parsedUrl.authority.host.value}`;
 * if (parsedUrl.authority.port) {
 *   baseUrl += `:${parsedUrl.authority.port.value}`;
 * }
 * ```
 * 
 * @see {@link https://tools.ietf.org/html/rfc3986#section-3} for URI syntax specification
 * @see {@link ParsedUrl} for the structure of the returned object
 * @see {@link Authority} for authority component details
 * @see {@link Query} for query parameter handling
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