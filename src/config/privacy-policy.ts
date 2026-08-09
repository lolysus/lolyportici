/**
 * La versione dell'informativa privacy in vigore.
 *
 * Va alzata **ogni volta che il testo dell'informativa cambia in modo
 * sostanziale**, non a ogni correzione di battitura. È il valore che finisce
 * accanto al consenso di ogni cliente: serve a poter dire, fra un anno, quale
 * testo esatto quella persona ha accettato. Se resta indietro rispetto al testo
 * pubblicato, i consensi risultano riferiti a un'informativa che nessuno ha
 * letto — cioè non sono dimostrabili, che è come non averli.
 *
 * Il formato è la data di entrata in vigore: si ordina da sé e si riconosce
 * senza consultare una tabella di corrispondenze.
 */
export const privacyPolicyVersion = "2026-08-09";
