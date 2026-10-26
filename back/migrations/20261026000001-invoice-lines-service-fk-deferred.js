'use strict';

/**
 * RESTRICT (et NO ACTION non différé) est vérifié à la fin de chaque instruction en cascade :
 * lors de la suppression d'un utilisateur, la cascade vers `services` échouait tant que la
 * cascade `clients → invoices → invoice_lines` n'avait pas encore supprimé les lignes.
 * Différée, la contrainte n'est vérifiée qu'au commit : la suppression d'un compte passe,
 * et supprimer une prestation encore utilisée par une facture reste refusé.
 */
const CONSTRAINT = 'invoice_lines_service_id_fkey';

async function setServiceForeignKey(queryInterface, rule) {
  await queryInterface.sequelize.query(
    `ALTER TABLE invoice_lines DROP CONSTRAINT ${CONSTRAINT};
     ALTER TABLE invoice_lines ADD CONSTRAINT ${CONSTRAINT}
       FOREIGN KEY (service_id) REFERENCES services(id) ${rule};`
  );
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await setServiceForeignKey(queryInterface, 'ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED');
  },

  async down(queryInterface) {
    await setServiceForeignKey(queryInterface, 'ON DELETE RESTRICT');
  },
};
