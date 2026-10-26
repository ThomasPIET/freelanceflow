const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const InvoiceLine = sequelize.define(
  'InvoiceLine',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    invoice_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'invoices', key: 'id' },
    },
    service_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'services', key: 'id' },
    },
    quantity: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    unit_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    total: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
  },
  {
    tableName: 'invoice_lines',
    underscored: true,
    createdAt: false,
    updatedAt: false,
    timestamps: false,
  }
);

module.exports = InvoiceLine;
