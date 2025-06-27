# JSON Parser Example

This comprehensive example demonstrates building a complete JSON parser using Combi-Parse, showcasing real-world parser construction techniques.

## Basic JSON Parser

Let's build a JSON parser step by step, starting with simple values and building up to complete JSON objects.

### Primitive Values

```typescript
import { 
  str, regex, number, choice, between, 
  sequence, genParser, lazy, many, sepBy 
} from 'combi-parse';

// JSON string with escape sequences
const jsonString = genParser(function* () {
  yield str('"');
  
  const chars = yield many(choice([
    // Escaped characters
    genParser(function* () {
      yield str('\\');
      const escaped = yield choice([
        str('"').map(() => '"'),
        str('\\').map(() => '\\'),
        str('/').map(() => '/'),
        str('b').map(() => '\b'),
        str('f').map(() => '\f'),
        str('n').map(() => '\n'),
        str('r').map(() => '\r'),
        str('t').map(() => '\t'),
        // Unicode escape: \uXXXX
        genParser(function* () {
          yield str('u');
          const hex = yield regex(/[0-9a-fA-F]{4}/);
          return String.fromCharCode(parseInt(hex, 16));
        })
      ]);
      return escaped;
    }),
    // Regular character (not quote or backslash)
    regex(/[^"\\]/)
  ]));
  
  yield str('"');
  return chars.join('');
});

// JSON number with scientific notation
const jsonNumber = regex(/-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/)
  .map(Number);

// JSON boolean
const jsonBoolean = choice([
  str('true').map(() => true),
  str('false').map(() => false)
]);

// JSON null
const jsonNull = str('null').map(() => null);
```

### Whitespace Handling

```typescript
const ws = regex(/\s*/).optional();

const lexeme = <T>(parser: Parser<T>) => 
  parser.keepLeft(ws);

// Wrapper for tokens that need whitespace handling
const token = <T>(parser: Parser<T>) => lexeme(parser);
```

### Arrays and Objects

```typescript
// Forward declaration for recursive structures
const jsonValue: Parser<any> = lazy(() => choice([
  jsonString,
  jsonNumber,
  jsonBoolean,
  jsonNull,
  jsonArray,
  jsonObject
]));

// JSON array: [value, value, ...]
const jsonArray = genParser(function* () {
  yield token(str('['));
  
  const elements = yield jsonValue.sepBy(token(str(',')));
  
  yield token(str(']'));
  return elements;
});

// JSON object: {"key": value, "key": value, ...}
const jsonObject = genParser(function* () {
  yield token(str('{'));
  
  const pairs = yield genParser(function* () {
    const key = yield token(jsonString);
    yield token(str(':'));
    const value = yield jsonValue;
    return [key, value];
  }).sepBy(token(str(',')));
  
  yield token(str('}'));
  
  // Convert array of pairs to object
  return Object.fromEntries(pairs);
});

// Complete JSON parser
const json = genParser(function* () {
  yield ws;
  const value = yield jsonValue;
  yield ws;
  return value;
});
```

## Usage Examples

```typescript
// Parse JSON string
const jsonStr = '{"name": "John", "age": 30, "active": true}';
const result = json.parse(jsonStr);
console.log(result);
// → { name: "John", age: 30, active: true }

// Parse JSON array
const jsonArr = '[1, 2, {"nested": [3, 4]}, null]';
const arrayResult = json.parse(jsonArr);
console.log(arrayResult);
// → [1, 2, { nested: [3, 4] }, null]

// Parse complex JSON
const complexJson = `{
  "users": [
    {
      "id": 1,
      "name": "Alice",
      "email": "alice@example.com",
      "preferences": {
        "theme": "dark",
        "notifications": true
      }
    },
    {
      "id": 2,
      "name": "Bob",
      "email": "bob@example.com",
      "preferences": {
        "theme": "light",
        "notifications": false
      }
    }
  ],
  "meta": {
    "version": "1.0",
    "created": "2023-01-15T10:30:00Z"
  }
}`;

const complexResult = json.parse(complexJson);
console.log(complexResult.users[0].preferences.theme); // → "dark"
```

## Enhanced JSON Parser with Better Errors

Let's improve the parser with better error messages and validation:

```typescript
import { label, context } from 'combi-parse';

// Enhanced string parser with better error messages
const enhancedJsonString = label(
  genParser(function* () {
    yield str('"');
    
    const chars = yield many(choice([
      context(
        genParser(function* () {
          yield str('\\');
          const escaped = yield choice([
            str('"').map(() => '"'),
            str('\\').map(() => '\\'),
            str('/').map(() => '/'),
            str('b').map(() => '\b'),
            str('f').map(() => '\f'),
            str('n').map(() => '\n'),
            str('r').map(() => '\r'),
            str('t').map(() => '\t'),
            genParser(function* () {
              yield str('u');
              const hex = yield label(
                regex(/[0-9a-fA-F]{4}/),
                'four hexadecimal digits'
              );
              return String.fromCharCode(parseInt(hex, 16));
            })
          ]);
          return escaped;
        }),
        'parsing escape sequence'
      ),
      regex(/[^"\\]/)
    ]));
    
    yield str('"');
    return chars.join('');
  }),
  'a JSON string'
);

// Enhanced number parser with validation
const enhancedJsonNumber = label(
  regex(/-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/)
    .map(str => {
      const num = Number(str);
      if (!isFinite(num)) {
        throw new Error(`Invalid number: ${str}`);
      }
      return num;
    }),
  'a valid JSON number'
);

// Enhanced array parser
const enhancedJsonArray = context(
  genParser(function* () {
    yield token(str('['));
    const elements = yield enhancedJsonValue.sepBy(token(str(',')));
    yield token(str(']'));
    return elements;
  }),
  'parsing JSON array'
);

// Enhanced object parser with duplicate key detection
const enhancedJsonObject = context(
  genParser(function* () {
    yield token(str('{'));
    
    const pairs = yield genParser(function* () {
      const key = yield token(enhancedJsonString);
      yield token(str(':'));
      const value = yield enhancedJsonValue;
      return [key, value];
    }).sepBy(token(str(',')));
    
    yield token(str('}'));
    
    // Check for duplicate keys
    const keys = pairs.map(([key]) => key);
    const uniqueKeys = new Set(keys);
    if (keys.length !== uniqueKeys.size) {
      const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
      throw new Error(`Duplicate keys found: ${duplicates.join(', ')}`);
    }
    
    return Object.fromEntries(pairs);
  }),
  'parsing JSON object'
);

const enhancedJsonValue: Parser<any> = lazy(() => choice([
  enhancedJsonString,
  enhancedJsonNumber,
  jsonBoolean,
  jsonNull,
  enhancedJsonArray,
  enhancedJsonObject
]));

const enhancedJson = context(
  genParser(function* () {
    yield ws;
    const value = yield enhancedJsonValue;
    yield ws;
    return value;
  }),
  'parsing JSON'
);
```

## JSON Schema Validation Parser

Create a parser that validates JSON against a schema:

```typescript
interface JsonSchema {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null';
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
}

const createSchemaParser = (schema: JsonSchema): Parser<any> => {
  switch (schema.type) {
    case 'string':
      return genParser(function* () {
        const value = yield jsonString;
        if (schema.minLength && value.length < schema.minLength) {
          throw new Error(`String too short: ${value.length} < ${schema.minLength}`);
        }
        if (schema.maxLength && value.length > schema.maxLength) {
          throw new Error(`String too long: ${value.length} > ${schema.maxLength}`);
        }
        return value;
      });
      
    case 'number':
      return genParser(function* () {
        const value = yield jsonNumber;
        if (schema.minimum !== undefined && value < schema.minimum) {
          throw new Error(`Number too small: ${value} < ${schema.minimum}`);
        }
        if (schema.maximum !== undefined && value > schema.maximum) {
          throw new Error(`Number too large: ${value} > ${schema.maximum}`);
        }
        return value;
      });
      
    case 'boolean':
      return jsonBoolean;
      
    case 'null':
      return jsonNull;
      
    case 'array':
      return genParser(function* () {
        yield token(str('['));
        const elements = schema.items 
          ? yield createSchemaParser(schema.items).sepBy(token(str(',')))
          : yield jsonValue.sepBy(token(str(',')));
        yield token(str(']'));
        return elements;
      });
      
    case 'object':
      return genParser(function* () {
        yield token(str('{'));
        
        const pairs = yield genParser(function* () {
          const key = yield token(jsonString);
          yield token(str(':'));
          
          const propertySchema = schema.properties?.[key];
          const value = propertySchema 
            ? yield createSchemaParser(propertySchema)
            : yield jsonValue;
            
          return [key, value];
        }).sepBy(token(str(',')));
        
        yield token(str('}'));
        
        const obj = Object.fromEntries(pairs);
        
        // Check required properties
        if (schema.required) {
          const missing = schema.required.filter(key => !(key in obj));
          if (missing.length > 0) {
            throw new Error(`Missing required properties: ${missing.join(', ')}`);
          }
        }
        
        return obj;
      });
      
    default:
      throw new Error(`Unsupported schema type: ${(schema as any).type}`);
  }
};

// Usage example
const userSchema: JsonSchema = {
  type: 'object',
  required: ['name', 'email'],
  properties: {
    name: { type: 'string', minLength: 1 },
    email: { type: 'string', minLength: 5 },
    age: { type: 'number', minimum: 0, maximum: 150 },
    active: { type: 'boolean' }
  }
};

const userParser = createSchemaParser(userSchema);

// Valid user
const validUser = userParser.parse('{"name": "John", "email": "john@example.com", "age": 25}');
console.log(validUser); // → { name: "John", email: "john@example.com", age: 25 }

// Invalid user (missing email)
try {
  userParser.parse('{"name": "John"}');
} catch (error) {
  console.error(error.message); // → "Missing required properties: email"
}
```

## Streaming JSON Parser

Parse large JSON files incrementally:

```typescript
interface JsonStreamEvent {
  type: 'startObject' | 'endObject' | 'startArray' | 'endArray' | 'property' | 'value';
  key?: string;
  value?: any;
  path: string[];
}

const createJsonStreamer = () => {
  const events: JsonStreamEvent[] = [];
  const pathStack: string[] = [];
  
  const emitEvent = (event: Omit<JsonStreamEvent, 'path'>) => {
    events.push({ ...event, path: [...pathStack] });
  };
  
  const streamingJsonValue: Parser<void> = lazy(() => choice([
    // String value
    jsonString.map(value => emitEvent({ type: 'value', value })),
    
    // Number value
    jsonNumber.map(value => emitEvent({ type: 'value', value })),
    
    // Boolean value
    jsonBoolean.map(value => emitEvent({ type: 'value', value })),
    
    // Null value
    jsonNull.map(value => emitEvent({ type: 'value', value })),
    
    // Array
    genParser(function* () {
      yield token(str('['));
      emitEvent({ type: 'startArray' });
      
      let index = 0;
      const elements = yield streamingJsonValue.sepBy(
        genParser(function* () {
          yield token(str(','));
          pathStack.push((index++).toString());
          return undefined;
        })
      );
      
      yield token(str(']'));
      emitEvent({ type: 'endArray' });
      return undefined;
    }),
    
    // Object
    genParser(function* () {
      yield token(str('{'));
      emitEvent({ type: 'startObject' });
      
      yield genParser(function* () {
        const key = yield token(jsonString);
        pathStack.push(key);
        emitEvent({ type: 'property', key });
        
        yield token(str(':'));
        yield streamingJsonValue;
        
        pathStack.pop();
        return undefined;
      }).sepBy(token(str(',')));
      
      yield token(str('}'));
      emitEvent({ type: 'endObject' });
      return undefined;
    })
  ]));
  
  return {
    parse: (jsonText: string) => {
      events.length = 0;
      pathStack.length = 0;
      
      const parser = genParser(function* () {
        yield ws;
        yield streamingJsonValue;
        yield ws;
      });
      
      parser.parse(jsonText);
      return events;
    },
    
    getEvents: () => [...events]
  };
};

// Usage
const streamer = createJsonStreamer();
const events = streamer.parse('{"users": [{"name": "Alice"}, {"name": "Bob"}]}');

events.forEach(event => {
  console.log(`${event.path.join('.')}: ${event.type}${event.value !== undefined ? ` = ${JSON.stringify(event.value)}` : ''}`);
});

// Output:
// : startObject
// users: property
// users: startArray
// users.0: startObject
// users.0.name: property
// users.0.name: value = "Alice"
// users.0: endObject
// users.1: startObject
// users.1.name: property
// users.1.name: value = "Bob"
// users.1: endObject
// users: endArray
// : endObject
```

## Performance Comparison

Compare different JSON parsing approaches:

```typescript
const benchmarkJson = (jsonString: string, iterations = 1000) => {
  // Native JSON.parse
  const nativeStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    JSON.parse(jsonString);
  }
  const nativeTime = performance.now() - nativeStart;
  
  // Combi-Parse JSON parser
  const combiStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    json.parse(jsonString);
  }
  const combiTime = performance.now() - combiStart;
  
  console.log(`Native JSON.parse: ${nativeTime.toFixed(2)}ms`);
  console.log(`Combi-Parse: ${combiTime.toFixed(2)}ms`);
  console.log(`Ratio: ${(combiTime / nativeTime).toFixed(2)}x slower`);
};

const testJson = '{"name": "John", "age": 30, "hobbies": ["reading", "programming"]}';
benchmarkJson(testJson);
```

## Error Recovery

Implement error recovery for malformed JSON:

```typescript
const recoverableJson = genParser(function* () {
  const errors: string[] = [];
  
  const tryParse = <T>(parser: Parser<T>, fallback: T, errorMsg: string): Promise<T> =>
    genParser(function* () {
      try {
        return yield parser;
      } catch (error) {
        errors.push(`${errorMsg}: ${error.message}`);
        return fallback;
      }
    });
  
  const result = yield tryParse(
    enhancedJsonValue,
    null,
    'Failed to parse JSON'
  );
  
  return { value: result, errors };
});

// Parse malformed JSON with recovery
const malformedJson = '{"name": "John", "age": 30, "hobbies": [reading", "programming"]}';
try {
  const result = recoverableJson.parse(malformedJson);
  console.log('Parsed with errors:', result);
} catch (error) {
  console.error('Complete parsing failure:', error.message);
}
```

This comprehensive JSON parser example demonstrates how Combi-Parse can be used to build real-world parsers with features like error recovery, schema validation, streaming, and performance optimization. The modular approach allows you to start simple and add complexity as needed.
