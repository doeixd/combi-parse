# Combi-Parse Documentation

Welcome to the comprehensive documentation for Combi-Parse - a friendly, type-safe parser combinator library for TypeScript.

## 📖 Table of Contents

### Getting Started
- [Installation & Quick Start](../README.md#installation)
- [Core Concepts](core-concepts.md)
- [Your First Parser](tutorial.md)

### Guides & Tutorials
- [Parser Combinators Explained](parser-combinators.md)
- [Advanced Parsing Techniques](advanced-techniques.md)
- [Error Handling & Debugging](error-handling.md)
- [Performance Optimization](performance.md)

### API Reference
- [Core API](api/core.md)
- [Parser Combinators](api/combinators.md)
- [Generator-based Parsing](api/generators.md)
- [Specialized Parsers](api/specialized.md)
- [Character Classes](character-classes.md)
- [Type System](api/types.md)

### Advanced Topics
- [Binary Data Parsing](advanced/binary.md)
- [Stream Processing](advanced/streaming.md)
- [Security Considerations](advanced/security.md)
- [Editor Integration](advanced/editor.md)
- [Testing Parsers](advanced/testing.md)

### Examples
- [JSON Parser](examples/json.md)
- [Configuration Files](examples/config.md)
- [Programming Languages](examples/language.md)
- [Data Formats](examples/formats.md)

### Reference
- [Grammar Theory](reference/grammar.md)
- [Best Practices](reference/best-practices.md)
- [Troubleshooting](reference/troubleshooting.md)
- [Migration Guide](reference/migration.md)

## 🚀 Quick Navigation

**New to parser combinators?** Start with [Core Concepts](core-concepts.md)

**Want to jump right in?** Check out the [Tutorial](tutorial.md)

**Looking for specific functionality?** Browse the [API Reference](api/core.md)

**Need help with a specific use case?** Check the [Examples](examples/json.md)

**Having issues?** See [Troubleshooting](reference/troubleshooting.md)

## 🎯 Library Overview

Combi-Parse provides several parsing approaches:

### 🧩 Traditional Combinators
The classic functional approach with composable parser functions.

### 🔄 Generator-based Parsing
An imperative-style syntax using JavaScript generators for more readable code.

### ⚡ Specialized Parsers
- **Binary parsers** for structured binary data
- **Stream parsers** for real-time data processing  
- **Incremental parsers** for editor integration
- **Secure parsers** with DoS protection

### 🛠️ Advanced Features
- **Type-level regex engine** for compile-time validation
- **Left-recursion handling** for complex grammars
- **Comprehensive error recovery** with detailed diagnostics
- **Performance optimization** with memoization and analysis

## 📊 Architecture

```
src/
├── index.ts              # Main entry point
├── parser.ts             # Core parser implementation
├── charClass.ts          # Character class utilities
├── regex.ts              # Type-level regex engine
├── url.ts                # URL parsing utilities
├── parsers/              # Specialized parser implementations
│   ├── async.ts          # Async/streaming parsers
│   ├── binary.ts         # Binary data parsers
│   ├── contextual.ts     # Context-aware parsers
│   ├── incremental.ts    # Editor-optimized parsers
│   ├── secure.ts         # Security-hardened parsers
│   ├── stream.ts         # Real-time stream parsers
│   └── generator/        # Generator-based parsing
├── primitives/           # Core parsing primitives
│   ├── algebra.ts        # Parser algebra operations
│   ├── ast.ts            # AST construction utilities
│   ├── debug.ts          # Debugging and visualization
│   ├── grammar.ts        # Grammar analysis and optimization
│   ├── pattern.ts        # Advanced pattern matching
│   ├── recover.ts        # Error recovery mechanisms
│   └── testing.ts        # Comprehensive testing utilities
```

## 🤝 Community

- **GitHub Issues**: Report bugs and request features
- **Discussions**: Ask questions and share examples
- **Contributing**: See our contribution guidelines

## 📄 License

MIT License - see LICENSE file for details.
