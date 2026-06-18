import type { ExtractedFields } from "@/lib/types";

const CIG_RE = /\b(?:CIG[:\s-]*)?([A-Z0-9]{10})\b/g;
const CUP_RE = /\b(?:CUP[:\s-]*)?([A-Z][0-9A-Z]{14})\b/g;
const EURO_RE = /(?:€|EUR|euro)\s?[\d.]+(?:,\d{2})?|[\d.]+(?:,\d{2})?\s?(?:€|euro|EUR)/gi;
const DATE_RE = /\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}\s+(?:gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre|january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4})\b/gi;

const REQUIREMENT_TERMS = [
  "requisiti",
  "requisito",
  "abilitazione",
  "iscrizione",
  "soa",
  "fatturato",
  "certificazione",
  "esperienza",
  "operatori economici",
  "requirements",
  "eligibility",
  "eligible",
  "submission",
  "application",
  "applicants",
];

const BENEFICIARY_TERMS = [
  "beneficiari",
  "soggetti beneficiari",
  "destinatari",
  "soggetti ammessi",
  "microimprese",
  "pmi",
  "smes",
  "startups",
  "startup",
  "public administrations",
  "pa",
  "academia",
  "research organisations",
  "research organizations",
  "universities",
  "companies",
  "industry",
  "enti locali",
  "comuni",
  "aziende sanitarie",
  "universita",
];

const DEADLINE_TERMS = [
  "scadenza",
  "scade",
  "termine",
  "termini",
  "entro",
  "proroga",
  "presentazione domande",
  "presentazione offerte",
  "presentazione candidature",
  "deadline",
  "closing date",
  "submission deadline",
  "apply by",
];

export function extractFields(title: string, summary: string): ExtractedFields {
  const text = normalize(`${title}. ${summary}`);
  return {
    deadlines: unique(extractDeadlineSentences(text)),
    amounts: unique(extractMatches(text, EURO_RE)),
    cig: unique(extractMatches(text, CIG_RE)).filter((value) => /[0-9]/.test(value)),
    cup: unique(extractMatches(text, CUP_RE)).filter((value) => value.length === 15),
    requirements: unique(extractSentencesByTerms(text, REQUIREMENT_TERMS)).slice(0, 5),
    beneficiaries: unique(extractSentencesByTerms(text, BENEFICIARY_TERMS)).slice(0, 5),
  };
}

export function fieldsToTags(fields: ExtractedFields) {
  const tags: string[] = [];
  if (fields.deadlines.length > 0) tags.push("scadenza");
  if (fields.amounts.length > 0) tags.push("importo");
  if (fields.cig.length > 0) tags.push("cig");
  if (fields.cup.length > 0) tags.push("cup");
  if (fields.requirements.length > 0) tags.push("requisiti");
  if (fields.beneficiaries.length > 0) tags.push("beneficiari");
  return tags;
}

function extractDeadlineSentences(text: string) {
  const deadlineSentences = extractSentencesByTerms(text, DEADLINE_TERMS);
  const dateMatches = deadlineSentences.flatMap((sentence) => extractMatches(sentence, DATE_RE));
  return [...dateMatches, ...deadlineSentences].slice(0, 8);
}

function extractMatches(text: string, re: RegExp) {
  return Array.from(text.matchAll(re), (match) => cleanMatch(match[1] ?? match[0]));
}

function extractSentencesByTerms(text: string, terms: string[]) {
  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  return sentences.filter((sentence) => {
    const normalized = asciiLower(sentence);
    return terms.some((term) => normalized.includes(asciiLower(term)));
  });
}

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function cleanMatch(value: string) {
  return value.replace(/^[\s:,-]+|[\s:,-]+$/g, "").trim();
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).slice(0, 12);
}

function asciiLower(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
