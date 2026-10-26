'use strict';

/**
 * Restructure address fields for users and clients.
 * Replaces the single `adress` (users) / `address` (clients) column
 * with structured fields: address_line1, address_line2, zip_code, city, country.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Fresh databases already get the structured fields from the create-users / create-clients migrations
    const users = await queryInterface.describeTable('users');
    if (!users.adress) return;

    // --- USERS ---
    await queryInterface.removeColumn('users', 'adress');
    await queryInterface.addColumn('users', 'address_line1', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('users', 'address_line2', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('users', 'zip_code',      { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('users', 'city',          { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('users', 'country',       { type: Sequelize.STRING, allowNull: true });

    // --- CLIENTS ---
    await queryInterface.removeColumn('clients', 'address');
    await queryInterface.addColumn('clients', 'address_line1', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('clients', 'address_line2', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('clients', 'zip_code',      { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('clients', 'city',          { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('clients', 'country',       { type: Sequelize.STRING, allowNull: true });
  },

  async down(queryInterface, Sequelize) {
    // --- USERS ---
    await queryInterface.removeColumn('users', 'address_line1');
    await queryInterface.removeColumn('users', 'address_line2');
    await queryInterface.removeColumn('users', 'zip_code');
    await queryInterface.removeColumn('users', 'city');
    await queryInterface.removeColumn('users', 'country');
    await queryInterface.addColumn('users', 'adress', { type: Sequelize.STRING, allowNull: true });

    // --- CLIENTS ---
    await queryInterface.removeColumn('clients', 'address_line1');
    await queryInterface.removeColumn('clients', 'address_line2');
    await queryInterface.removeColumn('clients', 'zip_code');
    await queryInterface.removeColumn('clients', 'city');
    await queryInterface.removeColumn('clients', 'country');
    await queryInterface.addColumn('clients', 'address', { type: Sequelize.TEXT, allowNull: true });
  },
};
