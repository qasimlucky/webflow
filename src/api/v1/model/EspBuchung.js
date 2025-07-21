const mongoose = require('mongoose');

const EspBuchungSchema = new mongoose.Schema({
  ESP_monatliche_Rate: String,
  ESP_Einmalanlage: String,
  ESP_Kontoinhaber: String,
  ESP_IBAN: String,
  ESP_Kreditinstitut: String,
  ESP_Einzugsermaechtigung: String,
  ESP_Vertragsbedingungen: String,
  ESP_Datenschutzbestimmungen: String,
  ESP_Kontakt_Anrede: String,
  ESP_Kontakt_Firma: String,
  ESP_Kontakt_Vorname: String,
  ESP_Kontakt_Nachname: String,
  ESP_Kontakt_Strasse: String,
  ESP_Kontakt_PLZ: String,
  ESP_Kontakt_Ort: String,
  ESP_Kontakt_Land: String,
  ESP_Kontakt_Telefon: String,
  ESP_Kontakt_EMailAdresse: String,
  ESP_Gemeinschaftssparplan: String,
  ESP_GSP_Vorname: String,
  ESP_GSP_Nachname: String,
  ESP_GSP_Email: String,
  ESP_Handelt_auf_eigene_Rechnung: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('EspBuchung', EspBuchungSchema); 