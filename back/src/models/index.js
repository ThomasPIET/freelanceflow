const sequelize = require('../config/database');
const User = require('./user.model');
const Client = require('./client.model');
const Service = require('./service.model');
const Invoice = require('./invoice.model');
const InvoiceLine = require('./invoiceLine.model');

User.hasMany(Client, { foreignKey: 'user_id', onDelete: 'CASCADE' });
Client.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(Service, { foreignKey: 'user_id', onDelete: 'CASCADE' });
Service.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(Invoice, { foreignKey: 'user_id', onDelete: 'CASCADE' });
Invoice.belongsTo(User, { foreignKey: 'user_id' });

Client.hasMany(Invoice, { foreignKey: 'client_id', onDelete: 'CASCADE' });
Invoice.belongsTo(Client, { foreignKey: 'client_id' });

Invoice.hasMany(InvoiceLine, { foreignKey: 'invoice_id', onDelete: 'CASCADE' });
InvoiceLine.belongsTo(Invoice, { foreignKey: 'invoice_id' });

Service.hasMany(InvoiceLine, { foreignKey: 'service_id', onDelete: 'RESTRICT' });
InvoiceLine.belongsTo(Service, { foreignKey: 'service_id' });

module.exports = {
  sequelize,
  User,
  Client,
  Service,
  Invoice,
  InvoiceLine,
};
