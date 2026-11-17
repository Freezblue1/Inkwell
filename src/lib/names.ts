/** Offline character-name generator with several naming styles. */

export type NameStyle = 'english' | 'celtic' | 'nordic' | 'romance' | 'slavic' | 'japanese' | 'fantasy';
export type NameGender = 'any' | 'feminine' | 'masculine';

interface StyleData {
  label: string;
  feminine: string[];
  masculine: string[];
  surnames: string[];
}

export const NAME_STYLES: Record<Exclude<NameStyle, 'fantasy'>, StyleData> = {
  english: {
    label: 'English',
    feminine: ['Alice', 'Beatrice', 'Clara', 'Daisy', 'Edith', 'Eleanor', 'Florence', 'Grace', 'Harriet', 'Imogen', 'Iris', 'Jane', 'Lydia', 'Margaret', 'Matilda', 'Nora', 'Olive', 'Penelope', 'Rose', 'Sylvia', 'Violet', 'Winifred'],
    masculine: ['Albert', 'Arthur', 'Benedict', 'Charles', 'Edmund', 'Frederick', 'George', 'Henry', 'Hugh', 'Jasper', 'Leonard', 'Miles', 'Nathaniel', 'Oliver', 'Percy', 'Rupert', 'Samuel', 'Thomas', 'Walter', 'William'],
    surnames: ['Ashdown', 'Blackwood', 'Carter', 'Crane', 'Davenport', 'Fairfax', 'Fletcher', 'Gage', 'Hale', 'Hartley', 'Lockwood', 'Marsh', 'Pembroke', 'Quill', 'Rowe', 'Sallow', 'Thorne', 'Wren', 'Whitlock', 'Yardley'],
  },
  celtic: {
    label: 'Celtic',
    feminine: ['Aisling', 'Bríd', 'Ciara', 'Deirdre', 'Eilidh', 'Fionnuala', 'Gráinne', 'Isla', 'Maeve', 'Niamh', 'Orla', 'Rhiannon', 'Siobhán', 'Tegan'],
    masculine: ['Aodh', 'Bran', 'Cian', 'Declan', 'Eoin', 'Fergus', 'Lorcan', 'Niall', 'Oisín', 'Rhys', 'Ronan', 'Tadhg'],
    surnames: ['Byrne', 'Callaghan', 'Doyle', 'Fitzgerald', 'Gallagher', 'MacLeod', 'Morgan', 'Murphy', 'Nolan', "O'Connell", 'Quinn', 'Reilly', 'Sweeney'],
  },
  nordic: {
    label: 'Nordic',
    feminine: ['Astrid', 'Freya', 'Greta', 'Hilde', 'Ingrid', 'Linnea', 'Sigrid', 'Solveig', 'Thora', 'Ylva'],
    masculine: ['Anders', 'Bjorn', 'Erik', 'Gunnar', 'Halvard', 'Leif', 'Magnus', 'Olaf', 'Sten', 'Torvald'],
    surnames: ['Andersen', 'Berg', 'Dahl', 'Eriksson', 'Holm', 'Lind', 'Nygaard', 'Sandberg', 'Strand', 'Viklund'],
  },
  romance: {
    label: 'Romance (Spanish/Italian/French)',
    feminine: ['Adela', 'Beatriz', 'Camille', 'Chiara', 'Elena', 'Ines', 'Isabeau', 'Lucia', 'Margaux', 'Paloma', 'Rosalind', 'Valentina'],
    masculine: ['Alessandro', 'Bastien', 'Cosimo', 'Diego', 'Étienne', 'Lorenzo', 'Mateo', 'Rafael', 'Thibault', 'Vicente'],
    surnames: ['Arroyo', 'Bellini', 'Castellane', 'Delacroix', 'Esposito', 'Ferrante', 'Morales', 'Navarro', 'Rossi', 'Valcourt'],
  },
  slavic: {
    label: 'Slavic',
    feminine: ['Anya', 'Daria', 'Irina', 'Katya', 'Ludmila', 'Milena', 'Nadia', 'Vera', 'Zora'],
    masculine: ['Bogdan', 'Dmitri', 'Ivan', 'Kazimir', 'Lev', 'Mirko', 'Pavel', 'Stanislav', 'Yuri'],
    surnames: ['Belov', 'Dvorak', 'Horvat', 'Kowalski', 'Novak', 'Orlov', 'Petrova', 'Sokolov', 'Volkov'],
  },
  japanese: {
    label: 'Japanese',
    feminine: ['Aiko', 'Hana', 'Haruka', 'Kaede', 'Mei', 'Rin', 'Sakura', 'Yui', 'Yuki'],
    masculine: ['Daichi', 'Haruto', 'Hiro', 'Kaito', 'Kenji', 'Ren', 'Riku', 'Sora', 'Takumi'],
    surnames: ['Fujita', 'Hayashi', 'Ishikawa', 'Kato', 'Mori', 'Nakamura', 'Sato', 'Takahashi', 'Yamada'],
  },
};

const FANTASY = {
  start: ['Ae', 'Bel', 'Cor', 'Dra', 'El', 'Fen', 'Gal', 'Hal', 'Ith', 'Kae', 'Lor', 'Mor', 'Nym', 'Or', 'Quel', 'Ryn', 'Sar', 'Thal', 'Ul', 'Vey', 'Wyn', 'Zar'],
  mid: ['a', 'e', 'i', 'o', 'ae', 'ia', 'or', 'an', 'el', 'is', 'yr', 'un'],
  endF: ['a', 'ia', 'iel', 'wen', 'ra', 'lyn', 'eth', 'is', 'ae'],
  endM: ['or', 'an', 'ius', 'ric', 'dor', 'mir', 'oth', 'en', 'ar'],
  surnameA: ['Storm', 'Ash', 'Raven', 'Iron', 'Silver', 'Thorn', 'Night', 'Ember', 'Frost', 'Gold'],
  surnameB: ['vale', 'wood', 'crest', 'brook', 'fall', 'hart', 'shade', 'wind', 'forge', 'mere'],
};

function pick<T>(arr: T[], rnd: () => number): T {
  return arr[Math.floor(rnd() * arr.length)];
}

/** Generates `count` unique full names. */
export function generateNames(style: NameStyle, gender: NameGender, count = 12, rnd: () => number = Math.random): string[] {
  const out = new Set<string>();
  let guard = 0;
  while (out.size < count && guard++ < count * 20) {
    const g = gender === 'any' ? (rnd() < 0.5 ? 'feminine' : 'masculine') : gender;
    if (style === 'fantasy') {
      const first = pick(FANTASY.start, rnd) + (rnd() < 0.5 ? pick(FANTASY.mid, rnd) : '') + pick(g === 'feminine' ? FANTASY.endF : FANTASY.endM, rnd);
      out.add(`${first} ${pick(FANTASY.surnameA, rnd)}${pick(FANTASY.surnameB, rnd)}`);
    } else {
      const d = NAME_STYLES[style];
      out.add(`${pick(d[g], rnd)} ${pick(d.surnames, rnd)}`);
    }
  }
  return [...out];
}
