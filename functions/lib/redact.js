"use strict";
/**
 * Redaction per spec §5.7: raw OCR must never be sent to Gemini.
 * Returns redacted text and a map (in-memory only, never stored).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.redact = redact;
const PLACEHOLDERS = {
    NINEA: '[NINEA]',
    CNI: '[NUM_ID]',
    PHONE: '[TELEPHONE]',
    BIRTH: '[DATE_NAISSANCE]',
    ADDRESS: '[ADRESSE]',
    NAME: '[NOM]',
};
function redact(rawText) {
    let text = rawText;
    const map = {};
    // NINEA: 7 digits + letter + digit (e.g. 1234567A9)
    text = text.replace(/\b(\d{7}[A-Za-z]\d)\b/g, (m) => {
        map[PLACEHOLDERS.NINEA] = map[PLACEHOLDERS.NINEA] ?? m;
        return PLACEHOLDERS.NINEA;
    });
    // CNI: exactly 13 digits
    text = text.replace(/\b(\d{13})\b/g, (m) => {
        map[PLACEHOLDERS.CNI] = map[PLACEHOLDERS.CNI] ?? m;
        return PLACEHOLDERS.CNI;
    });
    // Senegalese phone: +221..., 221..., 7x/3x + 8 digits
    text = text.replace(/(?:\+221|221)?\s*[73]\d[\s.]?\d{3}[\s.]?\d{2}[\s.]?\d{2}/g, (m) => {
        const key = PLACEHOLDERS.PHONE;
        if (!map[key])
            map[key] = m.trim();
        return key;
    });
    // Full birth date dd/mm/yyyy or d/m/yyyy → keep only year
    text = text.replace(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, (_, d, m, y) => {
        const key = `[DATE_XX/XX/${y}]`;
        map[key] = map[key] ?? `${d}/${m}/${y}`;
        return key;
    });
    // Street-style address: lines starting with rue, avenue, av., villa, cité, lot
    text = text.replace(/^(rue|avenue|av\.|villa|cité|lot)\s+.+$/gim, (m) => {
        map[PLACEHOLDERS.ADDRESS] = map[PLACEHOLDERS.ADDRESS] ?? m;
        return PLACEHOLDERS.ADDRESS;
    });
    // Person names after "Nom :", "Prénom :", "Nom de naissance :", "M.", "Mme", etc.
    text = text.replace(/(?:Nom|Prénom|Nom de naissance)\s*:\s*([^\n]+)/gi, (_, name) => {
        const key = PLACEHOLDERS.NAME;
        const val = name.trim();
        if (val && !map[key])
            map[key] = val;
        return `Nom : ${PLACEHOLDERS.NAME}`;
    });
    text = text.replace(/\b(M\.|Mme|Monsieur|Madame)\s+([A-Za-zÀ-ÿ\-'\s]+?)(?=\n|$|M\.|Mme|Monsieur|Madame)/g, (prefix, name) => {
        const key = PLACEHOLDERS.NAME;
        const val = name.trim();
        if (val && !map[key])
            map[key] = val;
        return `${prefix} ${PLACEHOLDERS.NAME}`;
    });
    return { redactedText: text.trim(), redactionMap: map };
}
//# sourceMappingURL=redact.js.map