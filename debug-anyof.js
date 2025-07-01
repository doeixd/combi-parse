const { anyOf } = require('./dist/index.js');

try {
  const empty = anyOf([]);
  const result = empty.parse('anything');
  console.log('Success:', result);
} catch (e) {
  console.log('Error:', e.message);
}
