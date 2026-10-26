const NodeCache = require('node-cache');

// TTL par défaut : 60 secondes
const cache = new NodeCache({ stdTTL: 60 });

module.exports = cache;
