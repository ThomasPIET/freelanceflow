// Configuration sequelize-cli (migrations). SSL activable pour une base hébergée (DB_SSL=true) ;
// la base du docker-compose est sur un réseau interne et n'en a pas besoin.
const ssl =
  process.env.DB_SSL === 'true'
    ? { dialectOptions: { ssl: { require: true, rejectUnauthorized: false } } }
    : {};

const config = { use_env_variable: 'DATABASE_URL', dialect: 'postgres', ...ssl };

module.exports = { development: config, test: config, production: config };
