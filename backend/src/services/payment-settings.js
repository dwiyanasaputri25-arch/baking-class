import { pool } from '../db.js';
import { config } from '../config.js';

const settingNames = {
  payment_bank_name: 'bankName',
  payment_account_name: 'accountName',
  payment_account_number: 'accountNumber',
  payment_instructions: 'instructions'
};

export async function getPaymentSettings(connection = pool) {
  const [rows] = await connection.query(
    `SELECT setting_key, setting_value
     FROM app_settings
     WHERE setting_key IN (?, ?, ?, ?)`,
    Object.keys(settingNames)
  );
  const values = { ...config.payment };
  for (const row of rows) {
    const configKey = settingNames[row.setting_key];
    values[configKey] = row.setting_value;
  }
  return {
    bank_name: values.bankName,
    account_name: values.accountName,
    account_number: values.accountNumber,
    instructions: values.instructions,
    configured: Boolean(values.bankName && values.accountName && values.accountNumber)
  };
}

export async function updatePaymentSettings(connection, data, userId) {
  const settings = [
    ['payment_bank_name', data.bank_name],
    ['payment_account_name', data.account_name],
    ['payment_account_number', data.account_number],
    ['payment_instructions', data.instructions || '']
  ];
  for (const [key, value] of settings) {
    await connection.execute(
      `INSERT INTO app_settings (setting_key, setting_value, updated_by)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
      [key, value, userId]
    );
  }
}
