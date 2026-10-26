'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'role', {
      type: Sequelize.STRING(16),
      allowNull: false,
      defaultValue: 'standard',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'role');
  },
};
