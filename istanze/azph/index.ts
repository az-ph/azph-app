/**
 * Dati dell'istanza AZ-ph: impostazioni, testi della pagina Sposi, contratto.
 * Caricati una volta con l'importazione; poi si modificano dall'app.
 */
import impostazioni from "./impostazioni.json";
import pagina from "./pagina.json";
import messaggi from "./messaggi.json";

export const ISTANZA_AZPH = {
  impostazioni,
  blocchi: pagina,
  messaggi,
  // Contatti dei collaboratori (per codice): servono alle mail di conferma.
  collaboratori: [
    { codice: "MBA", email: "videomaker.mattiabatalocco@gmail.com", telefono: "+39 393 598 9345" },
  ],
  contratto: `# Contratto di servizio fotografico di Matrimonio

Tra Alessandro Zaniboni, fotografo professionista, con sede in Via Don Vito Bignotti 3 - 46014 Castellucchio MN, C.F. ZNBLSN79B22D150K, P.IVA IT02595690203, di seguito denominato “Fotografo”, e gli Sposi i cui dati sono indicati al momento della conferma, di seguito denominati congiuntamente “Clienti”, si conviene e stipula quanto segue.

## 1. Oggetto del contratto

Il Fotografo si impegna a realizzare un servizio fotografico in occasione del Matrimonio dei Clienti, che si terrà nel giorno e nei luoghi indicati nella sezione Servizio fotografico, secondo la Timeline proposta.

## 2. Servizi inclusi

- La copertura fotografica dalla fase dei preparativi al termine del ricevimento, secondo la Timeline indicata

- La selezione e la post-produzione delle immagini (almeno 700 foto post-prodotte)

- La consegna delle foto tramite link web privato UpYourShoot temporaneo (validità di minimo tre mesi)

- Gli eventuali altri servizi opzionali selezionati in questa pagina, tra quelli direttamente riferibili al Fotografo

## 3. Durata del servizio

Il servizio avrà una durata massima del totale ore previsto dalla Timeline indicata. Eventuali ore extra eccedenti (a partire dalla seconda) dovranno essere concordate e avranno un costo aggiuntivo di € 60,00/ora.

## 4. Spese di trasferta

Le spese di trasferta sono da considerarsi incluse nel corrispettivo proposto.

## 5. Corrispettivo e modalità di pagamento

Il compenso pattuito è il totale dei servizi fotografici confermato in questa pagina. Alla conferma non è richiesto alcun versamento. Il pagamento è così suddiviso:

- 50% dei servizi fotografici a titolo di acconto, al kick-off meeting (previsto 2-3 settimane prima del Matrimonio)

- il saldo dei servizi contestualmente alla consegna delle foto tramite link web privato

- l’eventuale Album (e Album genitori) alla consegna dell’album

Gli eventuali servizi video del videomaker esterno sono esclusi dal presente contratto: contratto e pagamenti sono gestiti direttamente dal videomaker. Fa eccezione il secondo operatore foto e video, se selezionato in questa pagina: è un servizio del Fotografo e rientra nel presente contratto.

## 6. Consegna del materiale

Le foto verranno consegnate entro 6 mesi dal Matrimonio in formato digitale ad alta risoluzione. L’eventuale Album - se previsto - sarà realizzato successivamente in base alle scelte dei Clienti.

## 7. Diritti d’autore

Il Fotografo mantiene la titolarità dei diritti d’autore sulle immagini realizzate, nel rispetto della Legge 633/1941. I Clienti ricevono una licenza d’uso personale delle immagini, con possibilità di stamparle e condividerle privatamente. Con il consenso dei Clienti (opzionale, indicato al momento della conferma), il Fotografo potrà utilizzare alcune immagini per scopi promozionali (portfolio, sito web, social, mostre, concorsi).

## 8. Clausola di cancellazione

In caso di cancellazione da parte dei Clienti non è prevista alcuna penale e l’eventuale acconto versato sarà restituito. In caso di disdetta da parte del Fotografo per causa di forza maggiore (malattia grave, eventi imprevisti), il Fotografo si impegna a restituire integralmente le somme versate o, ove possibile, trovare un collega sostituto con caratteristiche professionali simili.

## 9. Responsabilità

Il Fotografo non è responsabile per eventi al di fuori del suo controllo che possano compromettere il servizio (ritardi, maltempo, restrizioni, location buie o inaccessibili). Eventuali danni all’attrezzatura causati da ospiti o clienti saranno a carico dei responsabili.

## 10. Trattamento dei dati personali

Ai sensi del Regolamento UE 679/2016 (GDPR), i dati forniti dalle parti saranno trattati esclusivamente per finalità connesse all’esecuzione del presente contratto.

## 11. Foro competente

Per ogni controversia relativa all’interpretazione e/o esecuzione del presente contratto sarà competente in via esclusiva il foro di Mantova.
`,
};
