'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'logo_url');
    await queryInterface.addColumn('users', 'logo_data', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'logo_data');
    await queryInterface.addColumn('users', 'logo_url', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
};
